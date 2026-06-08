import { removeAccents } from './utils'

/**
 * BOSS Warehouse System (HungLead) — 44-column CSV export
 * Only exports customers with FULL address (postal + pref + city + street)
 * Names and memos are removeAccents'd (no Vietnamese diacritics)
 */

const BOSS_HEADERS = [
  '注文番号',          // 01 - order number
  'お届け先郵便番号',   // 02 - postal
  'お届け先都道府県',   // 03 - pref
  'お届け先市区町村',   // 04 - city
  'お届け先番地',       // 05 - street
  'お届け先建物名',     // 06 - building (empty)
  'お届け先名',         // 07 - recipient name (no accents)
  'お届け先名カナ',     // 08 - kana (empty)
  'お届け先電話番号',   // 09 - phone
  '依頼主郵便番号',     // 10 - sender postal (shop)
  '依頼主都道府県',     // 11 - sender pref
  '依頼主市区町村',     // 12 - sender city
  '依頼主番地',         // 13 - sender street
  '依頼主建物名',       // 14 - sender building
  '依頼主名',           // 15 - sender name
  '依頼主電話番号',     // 16 - sender phone
  '品名1',             // 17 - item name 1
  '品名2',             // 18 - item name 2
  '品名3',             // 19 - item name 3
  '品名4',             // 20 - item name 4
  '品名5',             // 21 - item name 5
  '数量1',             // 22 - qty 1
  '数量2',             // 23 - qty 2
  '数量3',             // 24 - qty 3
  '数量4',             // 25 - qty 4
  '数量5',             // 26 - qty 5
  '重量',              // 27 - weight (empty)
  'サイズ区分',         // 28 - size category
  '発送予定日',         // 29 - ship date
  '配達希望日',         // 30 - requested delivery date (empty)
  '配達希望時間帯',     // 31 - delivery time slot (empty)
  '代引き金額',         // 32 - COD amount (empty)
  '消費税',            // 33 - tax (empty)
  '送料',              // 34 - shipping fee
  'メモ1',             // 35 - memo 1 (order details, no accents)
  'メモ2',             // 36 - memo 2
  '請求書フラグ',       // 37 - invoice flag
  '発送方法',          // 38 - shipping method
  '便種',              // 39 - service type
  '冷凍冷蔵区分',       // 40 - temperature zone
  '時間帯指定コード',   // 41 - time code
  '受取方法',          // 42 - receive method
  '特記事項',          // 43 - special notes
  '予備',              // 44 - spare
]

const SENDER = {
  postal: '',
  pref: 'BOSS Warehouse',
  city: '',
  street: '',
  building: '',
  name: 'SHOP MAM / HUNGLEAD',
  phone: '',
}

/**
 * @param {Array} groups - [{customer, orders, shipFee}]
 * @returns {{csv: string, skipped: string[]}}
 */
export function buildBossCSV(groups) {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '/')
  const rows = [BOSS_HEADERS]
  const skipped = []

  groups.forEach(({ customer, orders, shipFee }) => {
    const { postal, pref, city, street, phone, name } = customer
    const hasAddr = postal && pref && city && street

    if (!hasAddr) {
      skipped.push(name)
      return
    }

    const orderNum = `MAM-${Date.now()}-${removeAccents(name).replace(/\s+/g, '').slice(0, 6).toUpperCase()}`

    // Build item names (up to 5 slots)
    const itemNames = orders.slice(0, 5).map(o =>
      removeAccents(`${o.code} ${o.size} ${o.color}`).slice(0, 30)
    )
    const itemQtys = orders.slice(0, 5).map(o => String(o.qty || 1))

    // Memo: all order details in one line
    const memoLines = orders.map(o =>
      removeAccents(`${o.code} ${o.name || ''} ${o.size} ${o.color} x${o.qty}`)
    )
    const memo = memoLines.join(' / ').slice(0, 100)

    const totalItems = orders.reduce((s, o) => s + (Number(o.qty) || 1), 0)
    const sizeCategory = totalItems <= 2 ? '60' : totalItems <= 5 ? '80' : '100'

    const row = [
      orderNum,                              // 01
      postal.replace('-', ''),               // 02
      pref,                                  // 03
      city,                                  // 04
      street,                                // 05
      '',                                    // 06 building
      removeAccents(name).toUpperCase(),     // 07 recipient name
      '',                                    // 08 kana
      phone || '',                           // 09 phone
      SENDER.postal,                         // 10
      SENDER.pref,                           // 11
      SENDER.city,                           // 12
      SENDER.street,                         // 13
      SENDER.building,                       // 14
      SENDER.name,                           // 15
      SENDER.phone,                          // 16
      itemNames[0] || '',                    // 17
      itemNames[1] || '',                    // 18
      itemNames[2] || '',                    // 19
      itemNames[3] || '',                    // 20
      itemNames[4] || '',                    // 21
      itemQtys[0] || '',                     // 22
      itemQtys[1] || '',                     // 23
      itemQtys[2] || '',                     // 24
      itemQtys[3] || '',                     // 25
      itemQtys[4] || '',                     // 26
      '',                                    // 27 weight
      sizeCategory,                          // 28 size
      today,                                 // 29 ship date
      '',                                    // 30
      '',                                    // 31
      '',                                    // 32
      '',                                    // 33
      String(shipFee || 0),                  // 34 ship fee
      memo,                                  // 35 memo
      '',                                    // 36
      '0',                                   // 37 no invoice
      'YAMATO',                              // 38 carrier
      '通常',                                // 39
      '常温',                                // 40
      '',                                    // 41
      '手渡し',                              // 42
      '',                                    // 43
      '',                                    // 44
    ]
    rows.push(row)
  })

  const csv = rows
    .map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))
    .join('\n')

  return { csv: '\uFEFF' + csv, skipped }
}

export function downloadCSV(csv, filename) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

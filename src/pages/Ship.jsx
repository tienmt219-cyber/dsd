import { useState, useMemo, useCallback } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { LoadingScreen } from '@/components/ui/Loading'
import { EmptyState } from '@/components/ui/EmptyState'
import { useAPI } from '@/hooks/useAPI'
import { shipItems } from '@/lib/api'
import { buildBossCSV, downloadCSV } from '@/lib/bossCSV'
import { formatJPY, cn } from '@/lib/utils'
import { BANK_INFO, STATUS } from '@/lib/constants'
import {
  Truck, MapPin, CheckCircle, AlertTriangle, Copy, FileDown,
  Package, ChevronDown, ChevronUp, Send, X
} from 'lucide-react'

/* ─── helpers ─── */
function getAddrStatus(c) {
  if (!c) return { full: false, missing: ['địa chỉ'] }
  const missing = []
  if (!c.postal) missing.push('postal')
  if (!c.pref) missing.push('tỉnh/TP')
  if (!c.city) missing.push('quận/huyện')
  if (!c.street) missing.push('số nhà')
  return { full: missing.length === 0, missing }
}

function buildShipMessage(customerName, items, shipFee) {
  const lines = items.map(i => `• ${i.name || i.code} ${i.color} x${i.qty || 1} — ¥${((Number(i.price) || 0) * (Number(i.qty) || 1)).toLocaleString('ja-JP')}`)
  const goods = items.reduce((s, i) => s + (Number(i.price) || 0) * (Number(i.qty) || 1), 0)
  const total = goods + (Number(shipFee) || 0)
  return `Hàng c về rồi!\n\n${lines.join('\n')}\n📮 Ship: ¥${Number(shipFee || 0).toLocaleString('ja-JP')}\n\n💰 Tổng CK: ¥${total.toLocaleString('ja-JP')}\n\n━━━━━━━━━━━━\n💜 PayPay: ${BANK_INFO.paypay}\n🇻🇳 VNĐ:\n${BANK_INFO.techcombank.name}\nTechcombank\n${BANK_INFO.techcombank.account}\n(không ghi nội dung CK)\n🇯🇵 MUFJ:\n${BANK_INFO.mufj.branch}\nSTK: ${BANK_INFO.mufj.account}\n${BANK_INFO.mufj.name}\n━━━━━━━━━━━━\nCK xong báo t nhé.`
}

/* ─── Address badge ─── */
function AddrBadge({ addrStatus }) {
  if (addrStatus.full) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-success bg-success/10 px-2 py-0.5 rounded-full">
        <MapPin className="w-3 h-3" /> ĐC đủ
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-danger bg-danger/10 px-2 py-0.5 rounded-full" title={`Thiếu: ${addrStatus.missing.join(', ')}`}>
      <MapPin className="w-3 h-3" /> Thiếu {addrStatus.missing.join(', ')}
    </span>
  )
}

/* ─── Customer ship card ─── */
function CustomerShipCard({ group, onShipped, customers }) {
  const { name, orders } = group
  const [selectedItems, setSelectedItems] = useState(new Set(orders.map(o => o._row)))
  const [shipFee, setShipFee] = useState('')
  const [shipping, setShipping] = useState(false)
  const [copied, setCopied] = useState(false)
  const [expanded, setExpanded] = useState(true)

  const custData = customers.find(c => c[0] === name)
  const addrStatus = getAddrStatus(custData ? {
    postal: custData[7], pref: custData[8], city: custData[9], street: custData[10]
  } : null)

  const toggleItem = row => {
    setSelectedItems(prev => {
      const next = new Set(prev)
      next.has(row) ? next.delete(row) : next.add(row)
      return next
    })
  }

  const selectedOrders = orders.filter(o => selectedItems.has(o._row))
  const goodsTotal = selectedOrders.reduce((s, o) => s + (Number(o.price) || 0) * (Number(o.qty) || 1), 0)
  const totalCK = goodsTotal + (Number(shipFee) || 0)
  const canSend = selectedItems.size > 0

  const handleShip = async () => {
    if (!canSend) return
    setShipping(true)
    try {
      await shipItems({
        rows: Array.from(selectedItems),
        shipFee: Number(shipFee) || 0,
        customerName: name,
      })
      onShipped()
    } catch (err) {
      alert('Lỗi: ' + err.message)
    } finally {
      setShipping(false)
    }
  }

  const copyMessage = () => {
    const msg = buildShipMessage(name, selectedOrders, shipFee)
    navigator.clipboard.writeText(msg)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Card className={cn(
      'transition-all',
      !addrStatus.full && 'border-warning/40'
    )}>
      {/* Card header */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-bg-hover/50 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold">{name}</span>
            <AddrBadge addrStatus={addrStatus} />
            <span className="text-xs text-text-muted">{orders.length} SP</span>
          </div>
          {addrStatus.full && custData && (
            <p className="text-xs text-text-muted mt-0.5 truncate">
              〒{custData[7]} {custData[8]} {custData[9]} {custData[10]}
            </p>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-bold">{formatJPY(goodsTotal)}</p>
          <p className="text-xs text-text-muted">{selectedItems.size}/{orders.length} chọn</p>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-text-muted shrink-0" /> : <ChevronDown className="w-4 h-4 text-text-muted shrink-0" />}
      </div>

      {expanded && (
        <>
          {/* Items list */}
          <div className="border-t border-border">
            {orders.map(o => (
              <label
                key={o._row}
                className={cn(
                  'flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors',
                  'hover:bg-bg-hover/50 border-b border-border/30 last:border-0',
                  selectedItems.has(o._row) ? 'bg-primary/5' : ''
                )}
              >
                <input
                  type="checkbox"
                  checked={selectedItems.has(o._row)}
                  onChange={() => toggleItem(o._row)}
                  className="w-4 h-4 accent-primary shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 text-sm">
                    <span className="font-mono text-xs text-text-secondary">{o.code}</span>
                    <span className="font-medium truncate">{o.name}</span>
                  </div>
                  <p className="text-xs text-text-muted">{o.size} · {o.color} · x{o.qty || 1}</p>
                </div>
                <span className="text-sm font-semibold shrink-0">
                  {formatJPY((Number(o.price) || 0) * (Number(o.qty) || 1))}
                </span>
              </label>
            ))}
          </div>

          {/* Actions */}
          <div className="px-4 py-3 space-y-3 border-t border-border bg-bg-hover/30">
            <div className="flex items-center gap-3">
              <Input
                value={shipFee}
                onChange={e => setShipFee(e.target.value)}
                type="number"
                placeholder="Ship fee (¥)"
                className="w-36"
              />
              <div className="flex-1 text-right">
                <p className="text-xs text-text-secondary">Tổng CK</p>
                <p className="text-lg font-bold text-primary">{formatJPY(totalCK)}</p>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={copyMessage}
                className="flex-1"
                disabled={!canSend}
              >
                {copied ? <><CheckCircle className="w-4 h-4" /> Đã copy!</> : <><Copy className="w-4 h-4" /> Copy tin nhắn</>}
              </Button>
              <Button
                size="sm"
                onClick={handleShip}
                disabled={!canSend || !addrStatus.full || shipping}
                className="flex-1"
                variant={addrStatus.full ? 'success' : 'secondary'}
                title={!addrStatus.full ? 'Cần bổ sung địa chỉ trước khi gửi' : ''}
              >
                {shipping
                  ? 'Đang gửi...'
                  : <><Send className="w-4 h-4" /> Gửi hàng</>}
              </Button>
            </div>

            {!addrStatus.full && (
              <p className="text-xs text-warning flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                Vào tab Đơn hàng → bấm tên khách để bổ sung địa chỉ
              </p>
            )}
          </div>
        </>
      )}
    </Card>
  )
}

/* ─── Main page ─── */
export default function Ship() {
  const { orders, customers, loading, refresh } = useAPI()
  const [exportingCSV, setExportingCSV] = useState(false)
  const [bossResult, setBossResult] = useState(null)

  // Group "Về kho" orders by customer
  const groups = useMemo(() => {
    const veKhoOrders = orders.filter(o => o[8] === STATUS.VE_KHO)
    const map = {}

    veKhoOrders.forEach(o => {
      const name = o[0]
      if (!map[name]) map[name] = []
      map[name].push({
        _row: o._row,
        name: o[1],
        code: o[2],
        size: o[3],
        color: o[4],
        qty: Number(o[5]) || 1,
        price: Number(o[6]) || 0,
        orderDate: o[7],
      })
    })

    return Object.entries(map).map(([name, items]) => ({
      name,
      orders: items,
    }))
  }, [orders])

  // Split into full / partial
  const { fullGroups, partialGroups, missingAddr } = useMemo(() => {
    const full = []
    const partial = []
    const missing = []

    groups.forEach(g => {
      const cust = customers.find(c => c[0] === g.name)
      const addrOk = cust && cust[7] && cust[8] && cust[9] && cust[10]
      if (addrOk) full.push(g)
      else {
        partial.push(g)
        missing.push(g.name)
      }
    })

    return { fullGroups: full, partialGroups: partial, missingAddr: missing }
  }, [groups, customers])

  const handleExportBoss = () => {
    setExportingCSV(true)
    try {
      const csvGroups = groups.map(g => {
        const cust = customers.find(c => c[0] === g.name)
        return {
          customer: {
            name: g.name,
            postal: cust?.[7] || '',
            pref: cust?.[8] || '',
            city: cust?.[9] || '',
            street: cust?.[10] || '',
            phone: cust?.[11] || '',
          },
          orders: g.orders,
          shipFee: 200, // default BOSS multi-item fee
        }
      })

      const { csv, skipped } = buildBossCSV(csvGroups)
      const date = new Date().toISOString().slice(0, 10)
      downloadCSV(csv, `BOSS_${date}.csv`)
      setBossResult({
        exported: csvGroups.length - skipped.length,
        skipped,
      })
    } finally {
      setExportingCSV(false)
    }
  }

  if (loading) return <LoadingScreen />

  if (groups.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl lg:text-2xl font-bold">Chờ gửi</h1>
        <EmptyState
          icon={Truck}
          title="Không có đơn Về kho"
          description="Chưa có đơn nào sẵn sàng để gửi"
        />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold flex items-center gap-2">
            <Truck className="w-6 h-6 text-primary" /> Chờ gửi
          </h1>
          <p className="text-sm text-text-secondary mt-0.5">
            {groups.length} khách · {groups.reduce((s, g) => s + g.orders.length, 0)} kiện
          </p>
        </div>
        <Button onClick={handleExportBoss} disabled={exportingCSV} variant="secondary">
          <FileDown className="w-4 h-4" />
          BOSS CSV ({fullGroups.length} đơn)
        </Button>
      </div>

      {/* BOSS export result */}
      {bossResult && (
        <Card className="border-success/30 bg-success/5">
          <CardContent className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-success shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-success">
                Đã xuất {bossResult.exported} đơn vào BOSS CSV
              </p>
              {bossResult.skipped.length > 0 && (
                <p className="text-xs text-warning mt-1">
                  Bỏ qua (thiếu ĐC): {bossResult.skipped.join(', ')}
                </p>
              )}
            </div>
            <button onClick={() => setBossResult(null)} className="text-text-muted hover:text-text">
              <X className="w-4 h-4" />
            </button>
          </CardContent>
        </Card>
      )}

      {/* Missing address banner */}
      {missingAddr.length > 0 && (
        <Card className="border-warning/40 bg-warning/5">
          <CardContent>
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-warning">
                  {missingAddr.length} khách thiếu địa chỉ — không xuất được BOSS CSV
                </p>
                <p className="text-xs text-text-secondary mt-1">
                  {missingAddr.join(' · ')}
                </p>
                <p className="text-xs text-text-muted mt-1">
                  Vào tab <strong>Đơn hàng</strong> → bấm tên khách → điền địa chỉ
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Full address group */}
      {fullGroups.length > 0 && (
        <div className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-success">
            <CheckCircle className="w-4 h-4" />
            Đủ hàng — gửi ngay ({fullGroups.length} khách)
          </h2>
          {fullGroups.map(g => (
            <CustomerShipCard
              key={g.name}
              group={g}
              onShipped={refresh}
              customers={customers}
            />
          ))}
        </div>
      )}

      {/* Missing address group */}
      {partialGroups.length > 0 && (
        <div className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-warning">
            <AlertTriangle className="w-4 h-4" />
            Thiếu địa chỉ ({partialGroups.length} khách)
          </h2>
          {partialGroups.map(g => (
            <CustomerShipCard
              key={g.name}
              group={g}
              onShipped={refresh}
              customers={customers}
            />
          ))}
        </div>
      )}
    </div>
  )
}

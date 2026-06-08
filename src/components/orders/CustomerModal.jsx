import { useState, useEffect } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Spinner } from '@/components/ui/Loading'
import { saveAddress } from '@/lib/api'
import { formatJPY, getCustomerRank } from '@/lib/utils'

export function CustomerModal({ open, onClose, customer, orders, onSaved }) {
  const [addr, setAddr] = useState({ postal: '', pref: '', city: '', street: '', phone: '' })
  const [saving, setSaving] = useState(false)
  const [lookingUp, setLookingUp] = useState(false)

  useEffect(() => {
    if (customer) {
      setAddr({
        postal: customer[7] || '',
        pref: customer[8] || '',
        city: customer[9] || '',
        street: customer[10] || '',
        phone: customer[11] || '',
      })
    }
  }, [customer])

  if (!customer) return null

  const name = customer[0]
  const orderCount = Number(customer[1]) || 0
  const totalRevenue = Number(customer[3]) || 0
  const rank = getCustomerRank(orderCount)
  const fbLink = customer[5]

  const custOrders = orders.filter(o => o[0] === name)

  const lookupPostal = async () => {
    if (!addr.postal || addr.postal.length < 7) return
    setLookingUp(true)
    try {
      const clean = addr.postal.replace('-', '')
      const res = await fetch(`https://zipcloud.ibsnet.co.jp/api/search?zipcode=${clean}`)
      const data = await res.json()
      if (data.results && data.results[0]) {
        const r = data.results[0]
        setAddr(prev => ({
          ...prev,
          pref: r.address1,
          city: r.address2 + r.address3,
        }))
      }
    } catch {
      // ignore
    } finally {
      setLookingUp(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await saveAddress(name, addr)
      onSaved?.()
      onClose()
    } catch (err) {
      alert('Lỗi lưu địa chỉ: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={`${rank.emoji} ${name}`} size="lg">
      <div className="space-y-4">
        {/* Customer info */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-bg-hover rounded-lg p-3">
            <p className="text-xs text-text-secondary">Hạng</p>
            <p className="font-semibold text-sm mt-0.5">{rank.emoji} {rank.label}</p>
          </div>
          <div className="bg-bg-hover rounded-lg p-3">
            <p className="text-xs text-text-secondary">Số đơn</p>
            <p className="font-semibold text-sm mt-0.5">{orderCount}</p>
          </div>
          <div className="bg-bg-hover rounded-lg p-3">
            <p className="text-xs text-text-secondary">Doanh thu</p>
            <p className="font-semibold text-sm mt-0.5">{formatJPY(totalRevenue)}</p>
          </div>
          <div className="bg-bg-hover rounded-lg p-3">
            <p className="text-xs text-text-secondary">FB</p>
            {fbLink ? (
              <a href={fbLink} target="_blank" rel="noopener noreferrer" className="text-primary text-sm font-medium hover:underline truncate block mt-0.5">
                Link
              </a>
            ) : (
              <p className="text-text-muted text-sm mt-0.5">—</p>
            )}
          </div>
        </div>

        {/* Address */}
        <div className="space-y-3">
          <h4 className="font-semibold text-sm">Địa chỉ giao hàng</h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex gap-2">
              <Input
                label="〒 Postal"
                value={addr.postal}
                onChange={e => setAddr(p => ({ ...p, postal: e.target.value }))}
                placeholder="1600022"
                className="flex-1"
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={lookupPostal}
                disabled={lookingUp}
                className="self-end"
              >
                {lookingUp ? <Spinner size="sm" /> : '検索'}
              </Button>
            </div>
            <Input
              label="都道府県"
              value={addr.pref}
              onChange={e => setAddr(p => ({ ...p, pref: e.target.value }))}
              placeholder="東京都"
            />
          </div>
          <Input
            label="市区町村"
            value={addr.city}
            onChange={e => setAddr(p => ({ ...p, city: e.target.value }))}
            placeholder="新宿区新宿"
          />
          <Input
            label="番地"
            value={addr.street}
            onChange={e => setAddr(p => ({ ...p, street: e.target.value }))}
            placeholder="3-1-24"
          />
          <Input
            label="電話"
            value={addr.phone}
            onChange={e => setAddr(p => ({ ...p, phone: e.target.value }))}
            placeholder="09012345678"
          />
          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? <><Spinner size="sm" /> Đang lưu...</> : 'Lưu địa chỉ'}
          </Button>
        </div>

        {/* Order history */}
        <div className="space-y-2">
          <h4 className="font-semibold text-sm">Lịch sử đơn hàng ({custOrders.length})</h4>
          <div className="max-h-48 overflow-y-auto space-y-1.5">
            {custOrders.map((o, i) => (
              <div key={i} className="flex items-center gap-2 text-sm bg-bg-hover rounded-lg px-3 py-2">
                <span className="font-medium">{o[2]}</span>
                <span className="text-text-secondary">{o[3]} {o[4]}</span>
                <span className="text-text-secondary">x{o[5] || 1}</span>
                <span className="ml-auto font-medium">{formatJPY(o[6])}</span>
                <StatusBadge status={o[8]} size="sm" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  )
}

import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { Spinner } from '@/components/ui/Loading'
import { useAPI } from '@/hooks/useAPI'
import { addBatchOrders } from '@/lib/api'
import { formatJPY, getCustomerRank, cn } from '@/lib/utils'
import { SIZES, BANK_INFO } from '@/lib/constants'
import {
  Plus, Trash2, ShoppingCart, Send, Package, UserCheck,
  MapPin, CheckCircle, AlertCircle, Copy, ChevronDown, ChevronUp
} from 'lucide-react'

/* ─── AutoSuggest ─── */
function AutoSuggest({ value, onChange, suggestions, placeholder, renderItem, onSelect }) {
  const [open, setOpen] = useState(false)
  const [filtered, setFiltered] = useState([])
  const ref = useRef(null)

  useEffect(() => {
    if (value && open) {
      const q = value.toLowerCase()
      setFiltered(suggestions.filter(s => {
        const text = typeof s === 'string' ? s : s.label
        return text.toLowerCase().includes(q)
      }).slice(0, 8))
    } else {
      setFiltered([])
    }
  }, [value, suggestions, open])

  useEffect(() => {
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <input
        type="text"
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className="w-full h-10 px-3 text-sm rounded-lg border border-border bg-bg-input text-text placeholder:text-text-muted focus:border-border-focus focus:outline-none focus:ring-2 focus:ring-primary/20"
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-bg-card border border-border rounded-lg shadow-xl max-h-52 overflow-y-auto">
          {filtered.map((item, i) => (
            <button
              key={i}
              className="w-full text-left px-3 py-2.5 text-sm hover:bg-bg-hover transition-colors min-h-[44px] border-b border-border/30 last:border-0"
              onMouseDown={() => { onSelect(item); setOpen(false) }}
            >
              {renderItem ? renderItem(item) : (typeof item === 'string' ? item : item.label)}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/* ─── Address section ─── */
function AddressSection({ addr, onChange }) {
  const [lookingUp, setLookingUp] = useState(false)
  const [expanded, setExpanded] = useState(false)

  const hasAddr = addr.postal || addr.pref || addr.city || addr.street
  const fullAddr = addr.postal && addr.pref && addr.city && addr.street

  const lookupPostal = async () => {
    if (!addr.postal || addr.postal.replace('-', '').length < 7) return
    setLookingUp(true)
    try {
      const clean = addr.postal.replace('-', '')
      const res = await fetch(`https://zipcloud.ibsnet.co.jp/api/search?zipcode=${clean}`)
      const data = await res.json()
      if (data.results?.[0]) {
        const r = data.results[0]
        onChange({ ...addr, pref: r.address1, city: r.address2 + r.address3 })
        setExpanded(true)
      }
    } catch { /* ignore */ }
    finally { setLookingUp(false) }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        className="flex items-center gap-2 text-sm font-medium text-text-secondary hover:text-text"
        onClick={() => setExpanded(e => !e)}
      >
        <MapPin className={cn('w-4 h-4', fullAddr ? 'text-success' : hasAddr ? 'text-warning' : 'text-text-muted')} />
        Địa chỉ giao hàng
        {fullAddr && <span className="text-xs text-success font-normal">(đủ)</span>}
        {hasAddr && !fullAddr && <span className="text-xs text-warning font-normal">(thiếu)</span>}
        {expanded ? <ChevronUp className="w-3.5 h-3.5 ml-1" /> : <ChevronDown className="w-3.5 h-3.5 ml-1" />}
      </button>

      {expanded && (
        <div className="space-y-2.5 pl-6">
          <div className="flex gap-2">
            <Input
              value={addr.postal}
              onChange={e => onChange({ ...addr, postal: e.target.value })}
              placeholder="〒 1600022"
              className="flex-1"
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={lookupPostal}
              disabled={lookingUp}
            >
              {lookingUp ? <Spinner size="sm" /> : '検索'}
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Input
              value={addr.pref}
              onChange={e => onChange({ ...addr, pref: e.target.value })}
              placeholder="東京都"
            />
            <Input
              value={addr.city}
              onChange={e => onChange({ ...addr, city: e.target.value })}
              placeholder="新宿区新宿"
            />
          </div>
          <Input
            value={addr.street}
            onChange={e => onChange({ ...addr, street: e.target.value })}
            placeholder="番地 3-1-24"
          />
          <Input
            value={addr.phone}
            onChange={e => onChange({ ...addr, phone: e.target.value })}
            placeholder="📞 09012345678"
          />
        </div>
      )}
    </div>
  )
}

/* ─── Confirmation message ─── */
function buildConfirmMsg(customerName, items) {
  const lines = items.map(i => `${i.name || i.code} ${i.size} ${i.color} x${i.qty || 1}`)
  const total = items.reduce((s, i) => s + (Number(i.price) || 0) * (Number(i.qty) || 1), 0)
  return `${customerName} ơi em xác nhận đơn nha!
${lines.join('\n')}
Giá: ¥${total.toLocaleString('ja-JP')}
Hàng sẽ về trong 7-14 ngày. Về kho em báo ${customerName} CK nhé! 💜`
}

const emptyItem = () => ({ code: '', name: '', size: '', color: '', qty: 1, price: '' })
const emptyAddr = () => ({ postal: '', pref: '', city: '', street: '', phone: '' })

export default function AddOrder() {
  const { customers, catalog, surplus, refresh } = useAPI()
  const [customerName, setCustomerName] = useState('')
  const [fbLink, setFbLink] = useState('')
  const [addr, setAddr] = useState(emptyAddr())
  const [items, setItems] = useState([emptyItem()])
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(null) // holds last submitted order info
  const [copied, setCopied] = useState(false)

  /* ── suggestions ── */
  const custSuggestions = useMemo(() =>
    customers.map(c => ({ label: c[0], data: c })), [customers])

  const catalogSuggestions = useMemo(() =>
    catalog.map(c => ({
      label: `${c[0]} - ${c[1]}`,
      code: c[0], name: c[1], price: c[2],
    })), [catalog])

  /* ── surplus check ── */
  const surplusMatches = useMemo(() => {
    const matches = {}
    items.forEach((item, idx) => {
      if (!item.code) return
      const m = surplus.filter(s =>
        s[0] === item.code &&
        (!item.size || s[1] === item.size) &&
        (!item.color || s[2] === item.color) &&
        s[4] === 'Về kho' &&
        Number(s[3]) > 0
      )
      if (m.length) matches[idx] = m
    })
    return matches
  }, [items, surplus])

  const selectedCustomer = useMemo(() =>
    customers.find(c => c[0] === customerName), [customers, customerName])

  const rank = selectedCustomer ? getCustomerRank(Number(selectedCustomer[1]) || 0) : null

  /* ── item helpers ── */
  const updateItem = (idx, field, value) =>
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it))

  const removeItem = idx => setItems(prev => prev.filter((_, i) => i !== idx))
  const addItem = () => setItems(prev => [...prev, emptyItem()])

  const total = items.reduce((s, i) => s + (Number(i.price) || 0) * (Number(i.qty) || 1), 0)

  const canSubmit = customerName.trim() &&
    items.every(i => i.code.trim() && i.size.trim() && i.color.trim() && i.price)

  /* ── submit ── */
  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    try {
      const orders = items.map(item => ({
        name: customerName.trim(),
        productName: item.name,
        productCode: item.code.trim(),
        size: item.size,
        color: item.color,
        qty: Number(item.qty) || 1,
        price: Number(item.price),
        fbLink: fbLink.trim(),
        postal: addr.postal,
        pref: addr.pref,
        city: addr.city,
        street: addr.street,
        phone: addr.phone,
      }))
      await addBatchOrders(orders)
      const confirmMsg = buildConfirmMsg(customerName, items)
      setSubmitted({ customerName, items: [...items], confirmMsg })
      setCustomerName('')
      setFbLink('')
      setAddr(emptyAddr())
      setItems([emptyItem()])
      refresh()
    } catch (err) {
      alert('Lỗi tạo đơn: ' + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const copyConfirm = () => {
    if (!submitted) return
    navigator.clipboard.writeText(submitted.confirmMsg)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <h1 className="text-xl lg:text-2xl font-bold">Tạo đơn hàng</h1>

      {/* Success banner */}
      {submitted && (
        <Card className="border-success/30 bg-success/5">
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2 text-success font-medium">
              <CheckCircle className="w-5 h-5" />
              Đã tạo {submitted.items.length} đơn cho {submitted.customerName}!
            </div>
            <div className="bg-bg-card rounded-lg p-3 text-sm whitespace-pre-wrap text-text-secondary border border-border">
              {submitted.confirmMsg}
            </div>
            <div className="flex gap-2">
              <Button variant="success" size="sm" onClick={copyConfirm}>
                {copied ? <><CheckCircle className="w-4 h-4" /> Đã copy!</> : <><Copy className="w-4 h-4" /> Copy tin xác nhận</>}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setSubmitted(null)}>
                Đóng
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Customer */}
      <Card>
        <CardHeader>
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-primary" /> Thông tin khách
          </h3>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              Tên khách
              {rank && <span className={cn('ml-2 text-xs', rank.color)}>{rank.emoji} {rank.label} · {selectedCustomer[1]} đơn</span>}
            </label>
            <AutoSuggest
              value={customerName}
              onChange={setCustomerName}
              suggestions={custSuggestions}
              placeholder="Nhập tên khách..."
              renderItem={item => {
                const r = getCustomerRank(Number(item.data[1]) || 0)
                return (
                  <div className="flex items-center gap-2">
                    <span>{r.emoji}</span>
                    <span className="font-medium">{item.label}</span>
                    <span className="text-text-muted text-xs ml-auto">{item.data[1]} đơn</span>
                  </div>
                )
              }}
              onSelect={item => {
                setCustomerName(item.label)
                if (item.data[5]) setFbLink(item.data[5])
                // auto-fill address from customer sheet
                if (item.data[7] || item.data[8] || item.data[9] || item.data[10]) {
                  setAddr({
                    postal: item.data[7] || '',
                    pref: item.data[8] || '',
                    city: item.data[9] || '',
                    street: item.data[10] || '',
                    phone: item.data[11] || '',
                  })
                }
              }}
            />
          </div>
          <Input
            label="Link Facebook"
            value={fbLink}
            onChange={e => setFbLink(e.target.value)}
            placeholder="https://facebook.com/..."
          />
          <AddressSection addr={addr} onChange={setAddr} />
        </CardContent>
      </Card>

      {/* Cart */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-primary" />
              Giỏ hàng ({items.length} món)
            </h3>
            <Button variant="ghost" size="sm" onClick={addItem}>
              <Plus className="w-4 h-4" /> Thêm
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {items.map((item, idx) => (
            <div key={idx} className="space-y-3 pb-4 border-b border-border/50 last:border-0 last:pb-0">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-text-secondary uppercase tracking-wide">
                  Sản phẩm {idx + 1}
                </span>
                {items.length > 1 && (
                  <button onClick={() => removeItem(idx)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-danger/10 text-text-muted hover:text-danger transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Surplus badge */}
              {surplusMatches[idx] && (
                <div className="flex items-center gap-2 px-3 py-2 bg-success/10 border border-success/30 rounded-lg text-success text-xs font-semibold">
                  <Package className="w-4 h-4 shrink-0" />
                  CÓ HÀNG DƯ — Ship ngay! ({surplusMatches[idx].reduce((s, d) => s + Number(d[3]), 0)} SP trong kho)
                </div>
              )}

              {/* Product code */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Mã SP</label>
                <AutoSuggest
                  value={item.code}
                  onChange={v => updateItem(idx, 'code', v)}
                  suggestions={catalogSuggestions}
                  placeholder="#AK01"
                  renderItem={cat => (
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs bg-bg-hover px-1.5 py-0.5 rounded font-semibold">{cat.code}</span>
                      <span className="flex-1 truncate">{cat.name}</span>
                      <span className="text-text-secondary shrink-0">{formatJPY(cat.price)}</span>
                    </div>
                  )}
                  onSelect={cat => {
                    updateItem(idx, 'code', cat.code)
                    updateItem(idx, 'name', cat.name)
                    if (cat.price) updateItem(idx, 'price', cat.price)
                  }}
                />
              </div>

              {item.name && (
                <p className="text-sm text-text-secondary bg-bg-hover px-3 py-1.5 rounded-lg">{item.name}</p>
              )}

              <div className="grid grid-cols-3 gap-2">
                <Select label="Size" value={item.size} onChange={e => updateItem(idx, 'size', e.target.value)}>
                  <option value="">Chọn...</option>
                  {SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                </Select>
                <Input label="Màu" value={item.color}
                  onChange={e => updateItem(idx, 'color', e.target.value)} placeholder="Đen" />
                <Input label="SL" type="number" min="1" value={item.qty}
                  onChange={e => updateItem(idx, 'qty', e.target.value)} />
              </div>
              <Input label="Giá (¥)" type="number" value={item.price}
                onChange={e => updateItem(idx, 'price', e.target.value)} placeholder="2500" />

              {/* Per-item subtotal */}
              {item.price && (
                <div className="text-right text-sm font-semibold text-text-secondary">
                  Tổng: <span className="text-text">{formatJPY((Number(item.price) || 0) * (Number(item.qty) || 1))}</span>
                </div>
              )}
            </div>
          ))}

          <Button variant="secondary" onClick={addItem} className="w-full">
            <Plus className="w-4 h-4" /> Thêm sản phẩm
          </Button>
        </CardContent>
      </Card>

      {/* Sticky footer */}
      <div className="sticky bottom-4 z-10">
        <Card className="shadow-xl border-primary/30 bg-bg-card/95 backdrop-blur-sm">
          <CardContent className="flex items-center gap-4">
            <div>
              <p className="text-xs text-text-muted">Tổng cộng</p>
              <p className="text-xl font-bold text-primary">{formatJPY(total)}</p>
            </div>
            <Button
              onClick={handleSubmit}
              disabled={!canSubmit || submitting}
              className="flex-1"
              size="lg"
            >
              {submitting
                ? <><Spinner size="sm" /> Đang tạo...</>
                : <><Send className="w-5 h-5" /> Tạo đơn ({items.length} SP)</>}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

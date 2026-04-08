import { useState, useMemo, useRef, useEffect } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { Spinner } from '@/components/ui/Loading'
import { useAPI } from '@/hooks/useAPI'
import { addBatchOrders } from '@/lib/api'
import { formatJPY, getCustomerRank, cn } from '@/lib/utils'
import { SIZES } from '@/lib/constants'
import {
  Plus, Trash2, ShoppingCart, Send, Package, UserCheck, Search
} from 'lucide-react'

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
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
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
        className="w-full h-10 px-3 text-sm rounded-lg border border-border bg-bg-input text-text placeholder:text-text-muted focus:border-border-focus focus:outline-none"
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-bg-card border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {filtered.map((item, i) => (
            <button
              key={i}
              className="w-full text-left px-3 py-2.5 text-sm hover:bg-bg-hover transition-colors min-h-[44px]"
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

const emptyItem = () => ({ code: '', name: '', size: '', color: '', qty: 1, price: '' })

export default function AddOrder() {
  const { customers, catalog, surplus, refresh, loading } = useAPI()
  const [customerName, setCustomerName] = useState('')
  const [fbLink, setFbLink] = useState('')
  const [items, setItems] = useState([emptyItem()])
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  // Customer suggestions
  const custSuggestions = useMemo(() => {
    return customers.map(c => ({
      label: c[0],
      data: c,
    }))
  }, [customers])

  // Catalog suggestions
  const catalogSuggestions = useMemo(() => {
    return catalog.map(c => ({
      label: `${c[0]} - ${c[1]}`,
      code: c[0],
      name: c[1],
      price: c[2],
      sizes: c[6]?.split(',').map(s => s.trim()) || [],
      colors: c[7]?.split(',').map(s => s.trim()) || [],
    }))
  }, [catalog])

  // Check surplus for current items
  const surplusMatches = useMemo(() => {
    const matches = {}
    items.forEach((item, idx) => {
      if (!item.code) return
      const match = surplus.filter(s =>
        s[0] === item.code &&
        (!item.size || s[1] === item.size) &&
        (!item.color || s[2] === item.color) &&
        s[4] === 'Về kho' &&
        Number(s[3]) > 0
      )
      if (match.length > 0) matches[idx] = match
    })
    return matches
  }, [items, surplus])

  const selectedCustomer = useMemo(() => {
    return customers.find(c => c[0] === customerName)
  }, [customers, customerName])

  const customerRank = selectedCustomer ? getCustomerRank(Number(selectedCustomer[1]) || 0) : null

  const updateItem = (idx, field, value) => {
    setItems(prev => {
      const next = [...prev]
      next[idx] = { ...next[idx], [field]: value }
      return next
    })
  }

  const removeItem = (idx) => {
    if (items.length <= 1) return
    setItems(prev => prev.filter((_, i) => i !== idx))
  }

  const addItem = () => {
    setItems(prev => [...prev, emptyItem()])
  }

  const total = items.reduce((sum, item) => {
    return sum + (Number(item.price) || 0) * (Number(item.qty) || 1)
  }, 0)

  const canSubmit = customerName.trim() && items.every(item =>
    item.code.trim() && item.size.trim() && item.color.trim() && item.price
  )

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
      }))
      await addBatchOrders(orders)
      setSuccess(true)
      setCustomerName('')
      setFbLink('')
      setItems([emptyItem()])
      refresh()
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      alert('Lỗi tạo đơn: ' + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <h1 className="text-xl lg:text-2xl font-bold">Tạo đơn hàng</h1>

      {success && (
        <div className="flex items-center gap-2 px-4 py-3 bg-success/10 border border-success/30 rounded-lg text-success text-sm font-medium">
          <Package className="w-5 h-5" /> Đã tạo đơn thành công!
        </div>
      )}

      {/* Customer info */}
      <Card>
        <CardHeader>
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <UserCheck className="w-4 h-4" /> Thông tin khách
          </h3>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              Tên khách {customerRank && (
                <span className={cn('ml-2', customerRank.color)}>
                  {customerRank.emoji} {customerRank.label}
                </span>
              )}
            </label>
            <AutoSuggest
              value={customerName}
              onChange={setCustomerName}
              suggestions={custSuggestions}
              placeholder="Nhập tên khách..."
              renderItem={item => {
                const rank = getCustomerRank(Number(item.data[1]) || 0)
                return (
                  <span className="flex items-center gap-2">
                    <span>{rank.emoji}</span>
                    <span className="font-medium">{item.label}</span>
                    <span className="text-text-secondary text-xs">{item.data[1]} đơn</span>
                  </span>
                )
              }}
              onSelect={item => {
                setCustomerName(item.label)
                if (item.data[5]) setFbLink(item.data[5])
              }}
            />
          </div>
          <Input
            label="Link Facebook"
            value={fbLink}
            onChange={e => setFbLink(e.target.value)}
            placeholder="https://facebook.com/..."
          />
        </CardContent>
      </Card>

      {/* Cart items */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <ShoppingCart className="w-4 h-4" /> Giỏ hàng ({items.length} món)
            </h3>
            <Button variant="ghost" size="sm" onClick={addItem}>
              <Plus className="w-4 h-4" /> Thêm SP
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {items.map((item, idx) => (
            <div key={idx} className="space-y-3 pb-4 border-b border-border/50 last:border-0 last:pb-0">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-text-secondary">
                  SP {idx + 1}
                </span>
                {items.length > 1 && (
                  <button
                    onClick={() => removeItem(idx)}
                    className="w-8 h-8 flex items-center justify-center rounded hover:bg-danger/10 text-text-muted hover:text-danger"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Surplus badge */}
              {surplusMatches[idx] && (
                <div className="flex items-center gap-2 px-3 py-2 bg-success/10 border border-success/30 rounded-lg text-success text-xs font-medium">
                  <Package className="w-4 h-4" />
                  CÓ HÀNG DƯ — Ship ngay!
                  ({surplusMatches[idx].reduce((s, d) => s + Number(d[3]), 0)} SP)
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Mã SP</label>
                <AutoSuggest
                  value={item.code}
                  onChange={v => updateItem(idx, 'code', v)}
                  suggestions={catalogSuggestions}
                  placeholder="#AK01"
                  renderItem={item => (
                    <span className="flex items-center gap-2">
                      <span className="font-mono text-xs font-medium">{item.code}</span>
                      <span>{item.name}</span>
                      <span className="ml-auto text-text-secondary">{formatJPY(item.price)}</span>
                    </span>
                  )}
                  onSelect={cat => {
                    updateItem(idx, 'code', cat.code)
                    updateItem(idx, 'name', cat.name)
                    updateItem(idx, 'price', cat.price)
                  }}
                />
              </div>

              {item.name && (
                <div className="text-sm text-text-secondary bg-bg-hover px-3 py-1.5 rounded">
                  {item.name}
                </div>
              )}

              <div className="grid grid-cols-3 gap-3">
                <Select
                  label="Size"
                  value={item.size}
                  onChange={e => updateItem(idx, 'size', e.target.value)}
                >
                  <option value="">Chọn...</option>
                  {SIZES.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </Select>
                <Input
                  label="Màu"
                  value={item.color}
                  onChange={e => updateItem(idx, 'color', e.target.value)}
                  placeholder="Đen"
                />
                <Input
                  label="Số lượng"
                  type="number"
                  min="1"
                  value={item.qty}
                  onChange={e => updateItem(idx, 'qty', e.target.value)}
                />
              </div>

              <Input
                label="Giá (JPY)"
                type="number"
                value={item.price}
                onChange={e => updateItem(idx, 'price', e.target.value)}
                placeholder="2500"
              />
            </div>
          ))}

          <Button variant="secondary" onClick={addItem} className="w-full">
            <Plus className="w-4 h-4" /> Thêm sản phẩm
          </Button>
        </CardContent>
      </Card>

      {/* Summary & Submit */}
      <Card className="sticky bottom-4 shadow-lg border-primary/20">
        <CardContent>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-text-secondary">Tổng cộng</span>
            <span className="text-xl font-bold text-primary">{formatJPY(total)}</span>
          </div>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit || submitting}
            className="w-full"
            size="lg"
          >
            {submitting ? (
              <><Spinner size="sm" /> Đang tạo đơn...</>
            ) : (
              <><Send className="w-5 h-5" /> Tạo đơn ({items.length} SP)</>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

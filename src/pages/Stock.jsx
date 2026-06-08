import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { LoadingScreen } from '@/components/ui/Loading'
import { EmptyState } from '@/components/ui/EmptyState'
import { useAPI } from '@/hooks/useAPI'
import { addStock } from '@/lib/api'
import { Spinner } from '@/components/ui/Loading'
import { STATUS, SIZES } from '@/lib/constants'
import { formatDate, cn } from '@/lib/utils'
import {
  Package, Plus, Trash2, ArrowRight, CheckCircle, Clock, Search
} from 'lucide-react'

const emptyStockItem = () => ({ code: '', size: '', color: '', qty: 1 })

export default function Stock() {
  const { orders, stock, catalog, loading, refresh } = useAPI()
  const [items, setItems] = useState([emptyStockItem()])
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState(null)
  const [search, setSearch] = useState('')

  const updateItem = (idx, field, value) =>
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it))
  const addItem = () => setItems(prev => [...prev, emptyStockItem()])
  const removeItem = idx => setItems(prev => prev.filter((_, i) => i !== idx))

  // Preview match: what orders would match each item
  const matchPreviews = useMemo(() => {
    return items.map(item => {
      if (!item.code) return []
      return orders.filter(o =>
        (o[8] === STATUS.CHO_HANG || o[8] === STATUS.DANG_SHIP) &&
        o[2] === item.code &&
        (!item.size || o[3] === item.size) &&
        (!item.color || o[4] === item.color)
      )
    })
  }, [items, orders])

  const handleSubmit = async () => {
    const valid = items.filter(i => i.code.trim() && Number(i.qty) > 0)
    if (valid.length === 0) return
    setSubmitting(true)
    try {
      const res = await addStock(valid.map(i => ({
        code: i.code.trim(),
        size: i.size.trim(),
        color: i.color.trim(),
        qty: Number(i.qty),
      })))
      setResult(res)
      setItems([emptyStockItem()])
      refresh()
    } catch (err) {
      alert('Lỗi nhập kho: ' + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  // Stock history
  const stockHistory = useMemo(() => {
    return [...stock].reverse().filter(s => {
      if (!search) return true
      const q = search.toLowerCase()
      return (s[0] || '').toLowerCase().includes(q)
    })
  }, [stock, search])

  if (loading) return <LoadingScreen />

  const canSubmit = items.some(i => i.code.trim() && Number(i.qty) > 0)

  return (
    <div className="space-y-4">
      <h1 className="text-xl lg:text-2xl font-bold flex items-center gap-2">
        <Package className="w-6 h-6 text-primary" /> Kho
      </h1>

      {/* Result banner */}
      {result && (
        <Card className="border-success/30 bg-success/5">
          <CardContent>
            <div className="flex items-start gap-2">
              <CheckCircle className="w-5 h-5 text-success shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-success">Nhập kho thành công!</p>
                {result.matched !== undefined && (
                  <p className="text-xs text-text-secondary mt-1">
                    {result.matched} đơn được match → Về kho
                    {result.surplus > 0 && ` · ${result.surplus} SP dư`}
                  </p>
                )}
              </div>
              <button onClick={() => setResult(null)} className="text-text-muted hover:text-text text-sm">✕</button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add stock form */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm">Nhập kho</h3>
            <Button variant="ghost" size="sm" onClick={addItem}>
              <Plus className="w-4 h-4" /> Thêm dòng
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {items.map((item, idx) => (
            <div key={idx} className="space-y-2 pb-3 border-b border-border/30 last:border-0 last:pb-0">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-text-secondary">#{idx + 1}</span>
                {items.length > 1 && (
                  <button onClick={() => removeItem(idx)}
                    className="w-7 h-7 flex items-center justify-center rounded hover:bg-danger/10 text-text-muted hover:text-danger">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-4 gap-2">
                <Input
                  value={item.code}
                  onChange={e => updateItem(idx, 'code', e.target.value)}
                  placeholder="Mã SP"
                />
                <Select value={item.size} onChange={e => updateItem(idx, 'size', e.target.value)}>
                  <option value="">Size</option>
                  {SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                </Select>
                <Input
                  value={item.color}
                  onChange={e => updateItem(idx, 'color', e.target.value)}
                  placeholder="Màu"
                />
                <Input
                  type="number"
                  min="1"
                  value={item.qty}
                  onChange={e => updateItem(idx, 'qty', e.target.value)}
                  placeholder="SL"
                />
              </div>
              {/* Match preview */}
              {matchPreviews[idx]?.length > 0 && (
                <div className="bg-success/5 border border-success/20 rounded-lg px-3 py-2">
                  <p className="text-xs font-medium text-success flex items-center gap-1">
                    <ArrowRight className="w-3 h-3" />
                    Sẽ match {matchPreviews[idx].length} đơn → Về kho:
                  </p>
                  <div className="mt-1 space-y-0.5">
                    {matchPreviews[idx].slice(0, 5).map((o, i) => (
                      <p key={i} className="text-xs text-text-secondary">
                        {o[0]} — {o[2]} {o[3]} {o[4]} x{o[5] || 1}
                      </p>
                    ))}
                    {matchPreviews[idx].length > 5 && (
                      <p className="text-xs text-text-muted">+{matchPreviews[idx].length - 5} đơn nữa...</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}

          <Button onClick={handleSubmit} disabled={!canSubmit || submitting} className="w-full">
            {submitting
              ? <><Spinner size="sm" /> Đang nhập...</>
              : <><Package className="w-4 h-4" /> Nhập kho</>}
          </Button>
        </CardContent>
      </Card>

      {/* Stock history */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm">Lịch sử nhập kho</h3>
            <div className="relative w-40">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Tìm mã SP..."
                className="w-full h-8 pl-8 pr-2 text-xs rounded-md border border-border bg-bg-input focus:border-border-focus focus:outline-none"
              />
            </div>
          </div>
        </CardHeader>
        {stockHistory.length === 0 ? (
          <CardContent>
            <p className="text-sm text-text-muted text-center py-4">Chưa có lịch sử</p>
          </CardContent>
        ) : (
          <div className="max-h-80 overflow-y-auto divide-y divide-border/30">
            {stockHistory.slice(0, 50).map((s, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <span className="font-mono text-xs text-primary font-semibold">{s[0]}</span>
                <span className="text-text-secondary text-xs">{s[1]} · {s[2]}</span>
                <span className="font-medium">x{s[3]}</span>
                <span className="ml-auto text-xs text-text-muted flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {formatDate(s[4])}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { LoadingScreen } from '@/components/ui/Loading'
import { EmptyState } from '@/components/ui/EmptyState'
import { useAPI } from '@/hooks/useAPI'
import { addProduct, updateProduct } from '@/lib/api'
import { Spinner } from '@/components/ui/Loading'
import { PRODUCT_PREFIXES } from '@/lib/constants'
import { formatJPY, cn, debounce } from '@/lib/utils'
import {
  Tag, Plus, Pencil, Search, ArrowUpDown, TrendingUp, Package
} from 'lucide-react'

const emptyProduct = () => ({
  code: '', name: '', sellPrice: '', buyPrice: '',
  sizes: '', colors: '', category: '',
})

function ProductModal({ open, onClose, product, onSaved }) {
  const [form, setForm] = useState(emptyProduct())
  const [saving, setSaving] = useState(false)
  const isEdit = !!product

  useState(() => {
    if (product) {
      setForm({
        code: product[0] || '',
        name: product[1] || '',
        sellPrice: product[2] || '',
        buyPrice: product[3] || '',
        sizes: product[6] || '',
        colors: product[7] || '',
        category: product[9] || '',
      })
    } else {
      setForm(emptyProduct())
    }
  }, [product])

  const profit = (Number(form.sellPrice) || 0) - (Number(form.buyPrice) || 0) - 100 - 80
  const margin = Number(form.sellPrice) > 0 ? ((profit / Number(form.sellPrice)) * 100).toFixed(1) : 0

  const handleSave = async () => {
    if (!form.code || !form.name || !form.sellPrice) return
    setSaving(true)
    try {
      if (isEdit) {
        await updateProduct(product._row, {
          code: form.code,
          name: form.name,
          sellPrice: Number(form.sellPrice),
          buyPrice: Number(form.buyPrice) || 0,
          sizes: form.sizes,
          colors: form.colors,
          category: form.category,
        })
      } else {
        await addProduct({
          code: form.code,
          name: form.name,
          sellPrice: Number(form.sellPrice),
          buyPrice: Number(form.buyPrice) || 0,
          sizes: form.sizes,
          colors: form.colors,
          category: form.category,
        })
      }
      onSaved()
      onClose()
    } catch (err) {
      alert('Lỗi: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? `Sửa ${form.code}` : 'Thêm sản phẩm'}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Input label="Mã SP" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} placeholder="#AK01" />
          <Select label="Loại" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
            <option value="">Chọn...</option>
            {Object.entries(PRODUCT_PREFIXES).map(([k, v]) => (
              <option key={k} value={k}>{k} — {v}</option>
            ))}
          </Select>
        </div>
        <Input label="Tên SP" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Áo khoác lông cừu" />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Giá bán (¥)" type="number" value={form.sellPrice} onChange={e => setForm(f => ({ ...f, sellPrice: e.target.value }))} />
          <Input label="Giá nhập (¥)" type="number" value={form.buyPrice} onChange={e => setForm(f => ({ ...f, buyPrice: e.target.value }))} />
        </div>
        {form.sellPrice && form.buyPrice && (
          <div className="flex gap-4 bg-bg-hover rounded-lg px-3 py-2 text-sm">
            <span>Lợi nhuận: <strong className={profit > 0 ? 'text-success' : 'text-danger'}>{formatJPY(profit)}</strong></span>
            <span>Margin: <strong>{margin}%</strong></span>
          </div>
        )}
        <Input label="Sizes (cách dấu phẩy)" value={form.sizes} onChange={e => setForm(f => ({ ...f, sizes: e.target.value }))} placeholder="S, M, L, XL" />
        <Input label="Màu (cách dấu phẩy)" value={form.colors} onChange={e => setForm(f => ({ ...f, colors: e.target.value }))} placeholder="Đen, Trắng, Be" />
        <Button onClick={handleSave} disabled={saving || !form.code || !form.name} className="w-full">
          {saving ? <><Spinner size="sm" /> Đang lưu...</> : isEdit ? 'Cập nhật' : 'Thêm sản phẩm'}
        </Button>
      </div>
    </Modal>
  )
}

export default function Products() {
  const { catalog, orders, loading, refresh } = useAPI()
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('sold') // sold | margin | name
  const [modalOpen, setModalOpen] = useState(false)
  const [editProduct, setEditProduct] = useState(null)

  const debouncedSearch = useMemo(() => debounce(setSearch, 300), [])

  // Enrich catalog with order stats
  const products = useMemo(() => {
    const orderMap = {}
    orders.forEach(o => {
      const code = o[2]
      if (!code) return
      const qty = Number(o[5]) || 1
      if (!orderMap[code]) orderMap[code] = { sold: 0, pending: 0, revenue: 0 }
      orderMap[code].sold += qty
      orderMap[code].revenue += (Number(o[6]) || 0) * qty
      if (o[8] === 'Chờ hàng' || o[8] === 'Đang ship') orderMap[code].pending += qty
    })

    return catalog.map(c => {
      const stats = orderMap[c[0]] || { sold: 0, pending: 0, revenue: 0 }
      const profit = (Number(c[2]) || 0) - (Number(c[3]) || 0) - 100 - 80
      const margin = Number(c[2]) > 0 ? (profit / Number(c[2]) * 100) : 0
      return { raw: c, code: c[0], name: c[1], sellPrice: c[2], buyPrice: c[3],
        profit, margin, sizes: c[6], colors: c[7], category: c[9], thumbnail: c[10],
        ...stats, _row: c._row }
    })
  }, [catalog, orders])

  const filtered = useMemo(() => {
    let result = products
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(p =>
        p.code?.toLowerCase().includes(q) ||
        p.name?.toLowerCase().includes(q) ||
        p.category?.toLowerCase().includes(q)
      )
    }
    result.sort((a, b) => {
      if (sortBy === 'sold') return b.sold - a.sold
      if (sortBy === 'margin') return b.margin - a.margin
      return (a.name || '').localeCompare(b.name || '')
    })
    return result
  }, [products, search, sortBy])

  const openAdd = () => { setEditProduct(null); setModalOpen(true) }
  const openEdit = (p) => { setEditProduct(p.raw); setModalOpen(true) }

  if (loading) return <LoadingScreen />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl lg:text-2xl font-bold flex items-center gap-2">
          <Tag className="w-6 h-6 text-primary" /> Sản phẩm
        </h1>
        <Button size="sm" onClick={openAdd}>
          <Plus className="w-4 h-4" /> Thêm SP
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            type="text"
            onChange={e => debouncedSearch(e.target.value)}
            placeholder="Tìm mã, tên SP..."
            className="w-full h-10 pl-10 pr-3 text-sm rounded-lg border border-border bg-bg-input focus:border-border-focus focus:outline-none"
          />
        </div>
        <Select value={sortBy} onChange={e => setSortBy(e.target.value)} className="w-36">
          <option value="sold">Bán chạy</option>
          <option value="margin">Margin cao</option>
          <option value="name">Tên A-Z</option>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Package} title="Không tìm thấy SP" />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(p => (
            <Card key={p.code} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => openEdit(p)}>
              <CardContent className="flex gap-3">
                {/* Thumbnail */}
                {p.thumbnail ? (
                  <img src={p.thumbnail} alt="" className="w-14 h-14 rounded-lg object-cover shrink-0 bg-bg-hover" />
                ) : (
                  <div className="w-14 h-14 rounded-lg bg-bg-hover flex items-center justify-center shrink-0">
                    <Package className="w-6 h-6 text-text-muted" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded font-semibold">{p.code}</span>
                    {p.category && <span className="text-xs text-text-muted">{PRODUCT_PREFIXES[p.category] || p.category}</span>}
                  </div>
                  <p className="text-sm font-medium mt-0.5 truncate">{p.name}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs">
                    <span className="font-semibold">{formatJPY(p.sellPrice)}</span>
                    <span className={cn('font-medium', p.margin >= 30 ? 'text-success' : p.margin >= 15 ? 'text-warning' : 'text-danger')}>
                      {p.margin.toFixed(0)}%
                    </span>
                    <span className="text-text-muted flex items-center gap-0.5">
                      <TrendingUp className="w-3 h-3" /> {p.sold}
                    </span>
                    {p.pending > 0 && <span className="text-blue-500">{p.pending} chờ</span>}
                  </div>
                </div>
                <Pencil className="w-4 h-4 text-text-muted shrink-0 self-center" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ProductModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditProduct(null) }}
        product={editProduct}
        onSaved={() => { refresh(); setModalOpen(false); setEditProduct(null) }}
      />
    </div>
  )
}

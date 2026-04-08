import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { LoadingScreen } from '@/components/ui/Loading'
import { EmptyState } from '@/components/ui/EmptyState'
import { useAPI } from '@/hooks/useAPI'
import { bulkUpdateStatus } from '@/lib/api'
import { STATUS } from '@/lib/constants'
import { formatJPY, cn } from '@/lib/utils'
import {
  Plane, Package, Copy, CheckCircle, Plus, Trash2,
  ChevronDown, ChevronUp, FileText, Send
} from 'lucide-react'

/* ── Build packing list text ── */
function buildPackingText(selectedGroups, emsCode) {
  const lines = [`📦 KIỆN EMS: ${emsCode || '___'}`, `📅 ${new Date().toLocaleDateString('ja-JP')}`, '']

  // Part 1: overview
  lines.push('═══ TỔNG QUAN ═══')
  selectedGroups.forEach(g => {
    lines.push(`${g.code} ${g.size} ${g.color} x${g.selectedQty} — ${g.customers.map(c => c.name).join(', ')}`)
  })
  lines.push('')

  // Part 2: by customer
  lines.push('═══ PHÂN KHÁCH ═══')
  const custMap = {}
  selectedGroups.forEach(g => {
    g.customers.forEach(c => {
      if (!custMap[c.name]) custMap[c.name] = []
      custMap[c.name].push({ code: g.code, size: g.size, color: g.color, qty: c.qty, name: g.name })
    })
  })
  Object.entries(custMap).forEach(([name, items]) => {
    lines.push(`\n👤 ${name}`)
    items.forEach(it => lines.push(`  • ${it.code} ${it.name} ${it.size} ${it.color} x${it.qty}`))
  })

  return lines.join('\n')
}

/* ── SKU row with checkbox ── */
function SKURow({ group, selected, onToggle, onQtyChange }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="border-b border-border/30 last:border-0">
      <div className="flex items-center gap-3 px-4 py-2.5">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          className="w-4 h-4 accent-primary shrink-0"
        />
        <div className="flex-1 min-w-0" onClick={() => setExpanded(e => !e)}>
          <div className="flex items-center gap-2 cursor-pointer">
            <span className="font-mono text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded font-semibold">{group.code}</span>
            <span className="text-sm truncate">{group.name}</span>
            <span className="text-xs text-text-muted">{group.size} · {group.color}</span>
            {expanded ? <ChevronUp className="w-3 h-3 text-text-muted" /> : <ChevronDown className="w-3 h-3 text-text-muted" />}
          </div>
          {group.thumbnail && (
            <img src={group.thumbnail} alt="" className="w-10 h-10 rounded mt-1 object-cover" />
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-text-muted">đơn: {group.totalQty}</span>
          <input
            type="number"
            value={group.selectedQty}
            onChange={e => onQtyChange(Number(e.target.value) || 0)}
            className="w-14 h-8 text-center text-sm border border-border rounded bg-bg-input"
            min={0}
          />
        </div>
      </div>
      {expanded && (
        <div className="px-10 pb-2 space-y-1">
          {group.customers.map((c, i) => (
            <div key={i} className="text-xs flex gap-2 text-text-secondary">
              <span className="font-medium text-text">{c.name}</span>
              <span>x{c.qty}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Manual item add ── */
function ManualItemRow({ item, onChange, onRemove }) {
  return (
    <div className="flex items-center gap-2">
      <Input
        value={item.code}
        onChange={e => onChange({ ...item, code: e.target.value })}
        placeholder="Mã SP"
        className="w-24"
      />
      <Input
        value={item.size}
        onChange={e => onChange({ ...item, size: e.target.value })}
        placeholder="Size"
        className="w-16"
      />
      <Input
        value={item.color}
        onChange={e => onChange({ ...item, color: e.target.value })}
        placeholder="Màu"
        className="w-20"
      />
      <Input
        type="number"
        value={item.qty}
        onChange={e => onChange({ ...item, qty: e.target.value })}
        placeholder="SL"
        className="w-14"
        min="1"
      />
      <button onClick={onRemove} className="w-8 h-8 flex items-center justify-center rounded hover:bg-danger/10 text-text-muted hover:text-danger">
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  )
}

export default function EMS() {
  const { orders, catalog, loading, refresh } = useAPI()
  const [emsCode, setEmsCode] = useState('')
  const [selected, setSelected] = useState(new Set())
  const [qtyOverrides, setQtyOverrides] = useState({})
  const [manualItems, setManualItems] = useState([])
  const [shipping, setShipping] = useState(false)
  const [copied, setCopied] = useState(false)

  // All "Chờ hàng" orders grouped by SKU
  const skuGroups = useMemo(() => {
    const choHang = orders.filter(o => o[8] === STATUS.CHO_HANG)
    const map = {}
    choHang.forEach(o => {
      const key = `${o[2]}|${o[3]}|${o[4]}`
      if (!map[key]) {
        const cat = catalog.find(c => c[0] === o[2])
        map[key] = {
          key,
          code: o[2], name: o[1] || cat?.[1] || '',
          size: o[3], color: o[4],
          thumbnail: cat?.[10] || null,
          totalQty: 0,
          selectedQty: 0,
          customers: [],
          rows: [],
        }
      }
      const qty = Number(o[5]) || 1
      map[key].totalQty += qty
      map[key].selectedQty = map[key].totalQty
      map[key].customers.push({ name: o[0], qty })
      map[key].rows.push(o._row)
    })
    return Object.values(map)
  }, [orders, catalog])

  // Init selected all
  useMemo(() => {
    if (skuGroups.length > 0 && selected.size === 0) {
      setSelected(new Set(skuGroups.map(g => g.key)))
    }
  }, [skuGroups.length])

  const toggleSKU = key => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  const setQty = (key, qty) => {
    setQtyOverrides(prev => ({ ...prev, [key]: qty }))
  }

  const selectedGroups = skuGroups
    .filter(g => selected.has(g.key))
    .map(g => ({
      ...g,
      selectedQty: qtyOverrides[g.key] ?? g.totalQty,
    }))

  const totalItems = selectedGroups.reduce((s, g) => s + g.selectedQty, 0)

  const handleShip = async () => {
    if (!emsCode.trim() || selectedGroups.length === 0) return
    setShipping(true)
    try {
      const allRows = selectedGroups.flatMap(g => g.rows)
      await bulkUpdateStatus(allRows, STATUS.DANG_SHIP, { ems: emsCode.trim() })
      setEmsCode('')
      setSelected(new Set())
      setQtyOverrides({})
      refresh()
    } catch (err) {
      alert('Lỗi: ' + err.message)
    } finally {
      setShipping(false)
    }
  }

  const copyPacking = () => {
    const text = buildPackingText(selectedGroups, emsCode)
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Manual item helpers
  const addManual = () => setManualItems(prev => [...prev, { code: '', size: '', color: '', qty: 1 }])
  const removeManual = idx => setManualItems(prev => prev.filter((_, i) => i !== idx))
  const updateManual = (idx, item) => setManualItems(prev => prev.map((it, i) => i === idx ? item : it))

  if (loading) return <LoadingScreen />

  if (skuGroups.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl lg:text-2xl font-bold flex items-center gap-2">
          <Plane className="w-6 h-6 text-primary" /> Kiện EMS
        </h1>
        <EmptyState
          icon={Package}
          title="Không có đơn Chờ hàng"
          description="Chưa có đơn nào đang chờ hàng từ GZ"
        />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl lg:text-2xl font-bold flex items-center gap-2">
        <Plane className="w-6 h-6 text-primary" /> Kiện EMS
      </h1>
      <p className="text-sm text-text-secondary">
        Tick chọn SP có trong kiện, chỉnh SL nếu khác, nhập mã EMS rồi bấm Ship.
      </p>

      {/* EMS code input */}
      <Input
        label="Mã EMS tracking"
        value={emsCode}
        onChange={e => setEmsCode(e.target.value)}
        placeholder="EJ123456789JP"
      />

      {/* SKU list */}
      <Card className="overflow-hidden">
        <CardHeader>
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm">
              Chọn SP trong kiện ({selected.size}/{skuGroups.length} SKU · {totalItems} SP)
            </h3>
            <button
              className="text-xs text-primary font-medium"
              onClick={() => {
                if (selected.size === skuGroups.length) setSelected(new Set())
                else setSelected(new Set(skuGroups.map(g => g.key)))
              }}
            >
              {selected.size === skuGroups.length ? 'Bỏ chọn hết' : 'Chọn hết'}
            </button>
          </div>
        </CardHeader>
        {skuGroups.map(g => (
          <SKURow
            key={g.key}
            group={{ ...g, selectedQty: qtyOverrides[g.key] ?? g.totalQty }}
            selected={selected.has(g.key)}
            onToggle={() => toggleSKU(g.key)}
            onQtyChange={qty => setQty(g.key, qty)}
          />
        ))}
      </Card>

      {/* Manual items */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm">Thêm SP thủ công (ngoài danh sách)</h3>
            <Button variant="ghost" size="sm" onClick={addManual}>
              <Plus className="w-4 h-4" /> Thêm
            </Button>
          </div>
        </CardHeader>
        {manualItems.length > 0 && (
          <CardContent className="space-y-2">
            {manualItems.map((item, i) => (
              <ManualItemRow
                key={i}
                item={item}
                onChange={v => updateManual(i, v)}
                onRemove={() => removeManual(i)}
              />
            ))}
          </CardContent>
        )}
      </Card>

      {/* Actions */}
      <Card>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={copyPacking} className="flex-1" disabled={selectedGroups.length === 0}>
              {copied
                ? <><CheckCircle className="w-4 h-4" /> Đã copy!</>
                : <><FileText className="w-4 h-4" /> Copy packing list</>}
            </Button>
            <Button
              size="sm"
              onClick={handleShip}
              disabled={shipping || !emsCode.trim() || selectedGroups.length === 0}
              className="flex-1"
            >
              {shipping
                ? 'Đang xử lý...'
                : <><Send className="w-4 h-4" /> Ship ({totalItems} SP)</>}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

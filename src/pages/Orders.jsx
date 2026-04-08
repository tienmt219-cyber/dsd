import { useState, useMemo, useCallback } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { LoadingScreen } from '@/components/ui/Loading'
import { EmptyState } from '@/components/ui/EmptyState'
import { CustomerModal } from '@/components/orders/CustomerModal'
import { useAPI } from '@/hooks/useAPI'
import { STATUS, STATUS_FLOW, STATUS_COLORS } from '@/lib/constants'
import { formatJPY, formatDate, debounce, cn } from '@/lib/utils'
import { updateCell, bulkUpdateStatus, cancelOrder } from '@/lib/api'
import {
  Search, Filter, ChevronDown, ChevronUp, Check, X, Trash2,
  Download, ClipboardList, ArrowUpDown
} from 'lucide-react'

function InlineEdit({ value, onSave, type = 'text' }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(value)

  if (!editing) {
    return (
      <span
        className="cursor-pointer hover:bg-primary/10 px-1 py-0.5 rounded transition-colors"
        onClick={() => { setVal(value); setEditing(true) }}
      >
        {value || '—'}
      </span>
    )
  }

  const save = () => {
    if (val !== value) onSave(val)
    setEditing(false)
  }

  return (
    <span className="inline-flex items-center gap-1">
      <input
        type={type}
        value={val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }}
        onBlur={save}
        autoFocus
        className="w-20 h-7 px-1.5 text-sm border border-border-focus rounded bg-bg-input focus:outline-none"
      />
    </span>
  )
}

export default function Orders() {
  const { orders, customers, catalog, loading, refresh } = useAPI()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortCol, setSortCol] = useState(null)
  const [sortDir, setSortDir] = useState('asc')
  const [selected, setSelected] = useState(new Set())
  const [bulkStatus, setBulkStatus] = useState('')
  const [customerModal, setCustomerModal] = useState(null)
  const [updating, setUpdating] = useState(false)

  const debouncedSearch = useMemo(() => debounce(setSearch, 300), [])

  // Filter active orders (exclude archived/deleted)
  const activeOrders = useMemo(() => {
    return orders.filter(o => o[8] !== STATUS.LUU_TRU && o[8] !== STATUS.DA_XOA)
  }, [orders])

  // Apply filters
  const filtered = useMemo(() => {
    let result = activeOrders

    if (statusFilter !== 'all') {
      result = result.filter(o => o[8] === statusFilter)
    }

    if (search) {
      const q = search.toLowerCase()
      result = result.filter(o =>
        (o[0] || '').toLowerCase().includes(q) ||
        (o[2] || '').toLowerCase().includes(q) ||
        (o[1] || '').toLowerCase().includes(q)
      )
    }

    return result
  }, [activeOrders, statusFilter, search])

  // Sort
  const sorted = useMemo(() => {
    if (sortCol === null) return filtered
    const arr = [...filtered]
    arr.sort((a, b) => {
      let va = a[sortCol] || ''
      let vb = b[sortCol] || ''
      // Try numeric comparison
      const na = Number(va)
      const nb = Number(vb)
      if (!isNaN(na) && !isNaN(nb)) {
        return sortDir === 'asc' ? na - nb : nb - na
      }
      return sortDir === 'asc'
        ? String(va).localeCompare(String(vb))
        : String(vb).localeCompare(String(va))
    })
    return arr
  }, [filtered, sortCol, sortDir])

  const toggleSort = (col) => {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortCol(col)
      setSortDir('asc')
    }
  }

  const toggleSelect = (rowIdx) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(rowIdx)) next.delete(rowIdx)
      else next.add(rowIdx)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selected.size === sorted.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(sorted.map(o => o._row)))
    }
  }

  const handleInlineEdit = async (row, col, value) => {
    try {
      await updateCell('NHẬP ĐƠN', row, col, value)
      refresh()
    } catch (err) {
      alert('Lỗi cập nhật: ' + err.message)
    }
  }

  const handleBulkUpdate = async () => {
    if (!bulkStatus || selected.size === 0) return
    setUpdating(true)
    try {
      await bulkUpdateStatus(Array.from(selected), bulkStatus)
      setSelected(new Set())
      setBulkStatus('')
      refresh()
    } catch (err) {
      alert('Lỗi: ' + err.message)
    } finally {
      setUpdating(false)
    }
  }

  const handleDelete = async (row) => {
    if (!confirm('Xoá đơn này? (Soft delete)')) return
    try {
      await cancelOrder(row)
      refresh()
    } catch (err) {
      alert('Lỗi: ' + err.message)
    }
  }

  const exportCSV = () => {
    const headers = ['Tên khách', 'Tên SP', 'Mã SP', 'Size', 'Color', 'SL', 'Giá', 'Ngày OD', 'Trạng thái']
    const rows = sorted.map(o => [o[0], o[1], o[2], o[3], o[4], o[5], o[6], o[7], o[8]])
    const csv = [headers, ...rows].map(r => r.map(c => `"${(c || '').toString().replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `orders_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const openCustomer = (name) => {
    const cust = customers.find(c => c[0] === name)
    if (cust) setCustomerModal(cust)
  }

  if (loading) return <LoadingScreen />

  const columns = [
    { key: 0, label: 'Khách', sortable: true },
    { key: 1, label: 'Tên SP', sortable: true },
    { key: 2, label: 'Mã', sortable: true },
    { key: 3, label: 'Size', sortable: false },
    { key: 4, label: 'Màu', sortable: false },
    { key: 5, label: 'SL', sortable: true },
    { key: 6, label: 'Giá', sortable: true },
    { key: 7, label: 'Ngày', sortable: true },
    { key: 8, label: 'TT', sortable: true },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl lg:text-2xl font-bold">Đơn hàng</h1>
        <Button variant="secondary" size="sm" onClick={exportCSV}>
          <Download className="w-4 h-4" /> Export CSV
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input
              type="text"
              placeholder="Tìm tên khách, mã SP..."
              onChange={e => debouncedSearch(e.target.value)}
              className="w-full h-10 pl-10 pr-3 text-sm rounded-lg border border-border bg-bg-input text-text placeholder:text-text-muted focus:border-border-focus focus:outline-none"
            />
          </div>
          <Select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="w-40"
          >
            <option value="all">Tất cả TT</option>
            {STATUS_FLOW.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </Select>
          <span className="text-sm text-text-secondary">
            {sorted.length} đơn
          </span>
        </CardContent>
      </Card>

      {/* Bulk actions */}
      {selected.size > 0 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-primary">
              Đã chọn {selected.size} đơn
            </span>
            <Select
              value={bulkStatus}
              onChange={e => setBulkStatus(e.target.value)}
              className="w-40"
            >
              <option value="">Đổi trạng thái...</option>
              {STATUS_FLOW.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </Select>
            <Button
              size="sm"
              onClick={handleBulkUpdate}
              disabled={!bulkStatus || updating}
            >
              <Check className="w-4 h-4" /> Áp dụng
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelected(new Set())}
            >
              <X className="w-4 h-4" /> Bỏ chọn
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Table */}
      {sorted.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Không có đơn hàng"
          description={search || statusFilter !== 'all'
            ? 'Thử đổi bộ lọc hoặc từ khoá tìm kiếm'
            : 'Chưa có đơn hàng nào'
          }
        />
      ) : (
        <Card className="overflow-hidden">
          {/* Desktop table */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-bg-hover/50">
                  <th className="px-3 py-2.5 w-10">
                    <input
                      type="checkbox"
                      checked={selected.size === sorted.length && sorted.length > 0}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded"
                    />
                  </th>
                  {columns.map(col => (
                    <th
                      key={col.key}
                      className={cn(
                        'px-3 py-2.5 text-left font-medium text-text-secondary text-xs uppercase tracking-wider',
                        col.sortable && 'cursor-pointer hover:text-text select-none'
                      )}
                      onClick={() => col.sortable && toggleSort(col.key)}
                    >
                      <span className="inline-flex items-center gap-1">
                        {col.label}
                        {col.sortable && sortCol === col.key && (
                          sortDir === 'asc'
                            ? <ChevronUp className="w-3 h-3" />
                            : <ChevronDown className="w-3 h-3" />
                        )}
                      </span>
                    </th>
                  ))}
                  <th className="px-3 py-2.5 w-10" />
                </tr>
              </thead>
              <tbody>
                {sorted.map((order, idx) => {
                  const rowIdx = order._row
                  return (
                    <tr
                      key={idx}
                      className={cn(
                        'border-b border-border/50 hover:bg-bg-hover/50 transition-colors',
                        selected.has(rowIdx) && 'bg-primary/5'
                      )}
                    >
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={selected.has(rowIdx)}
                          onChange={() => toggleSelect(rowIdx)}
                          className="w-4 h-4 rounded"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <button
                          className="text-primary font-medium hover:underline text-left"
                          onClick={() => openCustomer(order[0])}
                        >
                          {order[0]}
                        </button>
                      </td>
                      <td className="px-3 py-2">
                        <InlineEdit
                          value={order[1]}
                          onSave={v => handleInlineEdit(rowIdx, 1, v)}
                        />
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">{order[2]}</td>
                      <td className="px-3 py-2">
                        <InlineEdit
                          value={order[3]}
                          onSave={v => handleInlineEdit(rowIdx, 3, v)}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <InlineEdit
                          value={order[4]}
                          onSave={v => handleInlineEdit(rowIdx, 4, v)}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <InlineEdit
                          value={order[5] || '1'}
                          onSave={v => handleInlineEdit(rowIdx, 5, v)}
                          type="number"
                        />
                      </td>
                      <td className="px-3 py-2 font-medium">
                        <InlineEdit
                          value={order[6]}
                          onSave={v => handleInlineEdit(rowIdx, 6, v)}
                          type="number"
                        />
                      </td>
                      <td className="px-3 py-2 text-text-secondary text-xs">
                        {formatDate(order[7])}
                      </td>
                      <td className="px-3 py-2">
                        <StatusBadge status={order[8]} />
                      </td>
                      <td className="px-3 py-2">
                        <button
                          onClick={() => handleDelete(rowIdx)}
                          className="w-8 h-8 flex items-center justify-center rounded hover:bg-danger/10 text-text-muted hover:text-danger transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="lg:hidden divide-y divide-border">
            {sorted.map((order, idx) => {
              const rowIdx = order._row
              return (
                <div
                  key={idx}
                  className={cn(
                    'p-3 space-y-2',
                    selected.has(rowIdx) && 'bg-primary/5'
                  )}
                >
                  <div className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={selected.has(rowIdx)}
                      onChange={() => toggleSelect(rowIdx)}
                      className="w-4 h-4 rounded mt-1"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <button
                          className="text-primary font-medium text-sm hover:underline"
                          onClick={() => openCustomer(order[0])}
                        >
                          {order[0]}
                        </button>
                        <StatusBadge status={order[8]} />
                      </div>
                      <p className="text-sm mt-1">
                        <span className="font-mono text-xs text-text-secondary">{order[2]}</span>
                        {' '}{order[1]}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-text-secondary mt-1">
                        <span>{order[3]}</span>
                        <span>{order[4]}</span>
                        <span>x{order[5] || 1}</span>
                        <span className="ml-auto font-semibold text-text">{formatJPY(order[6])}</span>
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-xs text-text-muted">{formatDate(order[7])}</span>
                        <button
                          onClick={() => handleDelete(rowIdx)}
                          className="w-8 h-8 flex items-center justify-center rounded hover:bg-danger/10 text-text-muted hover:text-danger"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      <CustomerModal
        open={!!customerModal}
        onClose={() => setCustomerModal(null)}
        customer={customerModal}
        orders={orders}
        onSaved={refresh}
      />
    </div>
  )
}

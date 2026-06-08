import { useState, useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { LoadingScreen } from '@/components/ui/Loading'
import { EmptyState } from '@/components/ui/EmptyState'
import { useAPI } from '@/hooks/useAPI'
import { pauseAutoRefresh, resumeAutoRefresh, updateGlobalOrders, syncGlobalData } from '@/hooks/useAPI'
import { batchMarkCK, batchUnmarkCK } from '@/lib/api'
import { STATUS } from '@/lib/constants'
import { formatJPY, daysSince, cn, parseNotes } from '@/lib/utils'
import {
  CreditCard, CheckCircle, Clock, AlertTriangle, ChevronDown, ChevronUp, Undo2
} from 'lucide-react'

function urgencyLevel(days) {
  if (days === null) return 'green'
  if (days > 7) return 'red'
  if (days > 3) return 'yellow'
  return 'green'
}

const urgencyStyles = {
  red: { bg: 'border-danger/40 bg-danger/5', badge: 'bg-danger text-white', label: 'Quá hạn' },
  yellow: { bg: 'border-warning/40 bg-warning/5', badge: 'bg-warning text-white', label: 'Nên nhắc' },
  green: { bg: 'border-success/40', badge: 'bg-success text-white', label: 'Mới gửi' },
}

function CustomerCKCard({ group, onMarkCK }) {
  const [expanded, setExpanded] = useState(true)
  const [marking, setMarking] = useState(false)

  const days = group.oldestDays
  const urgency = urgencyLevel(days)
  const style = urgencyStyles[urgency]
  const total = group.total

  const handleMark = async () => {
    setMarking(true)
    try {
      await onMarkCK(group)
    } catch (err) {
      alert('Lỗi: ' + err.message)
    } finally {
      setMarking(false)
    }
  }

  return (
    <Card className={cn('transition-all', style.bg)}>
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold">{group.name}</span>
            <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full', style.badge)}>
              {style.label}
            </span>
            {days !== null && (
              <span className="text-xs text-text-muted">{days} ngày</span>
            )}
          </div>
          <p className="text-xs text-text-secondary mt-0.5">
            {group.orders.length} đơn · {formatJPY(total)}
          </p>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-text-muted" /> : <ChevronDown className="w-4 h-4 text-text-muted" />}
      </div>

      {expanded && (
        <>
          <div className="border-t border-border/30 divide-y divide-border/20">
            {group.orders.map(o => (
              <div key={o._rowIndex} className="flex items-center gap-2 px-4 py-2 text-sm">
                <span className="font-mono text-xs text-text-secondary">{o["Mã SP"]}</span>
                <span className="truncate flex-1">{o["Tên Sp"] || o["Mã SP"]}</span>
                <span className="text-xs text-text-muted">{o["SIZE"]} {o["COLOR"]} x{o["Số lượng"] || 1}</span>
                <span className="font-medium shrink-0">{formatJPY((Number(o["Giá sp"]) || 0) * Number(o["Số lượng"] || 1))}</span>
              </div>
            ))}
          </div>
          <div className="px-4 py-3 border-t border-border/30">
            <Button
              size="sm"
              variant="success"
              onClick={handleMark}
              disabled={marking}
              className="w-full"
            >
              {marking ? 'Đang lưu...' : <><CheckCircle className="w-4 h-4" /> Đã CK — {formatJPY(total)}</>}
            </Button>
          </div>
        </>
      )}
    </Card>
  )
}

function PaidCustomerCard({ group, onUnmarkCK }) {
  const [expanded, setExpanded] = useState(false)
  const [unmarking, setUnmarking] = useState(false)

  const handleUnmark = async () => {
    setUnmarking(true)
    try {
      await onUnmarkCK(group)
    } catch (err) {
      alert('Lỗi: ' + err.message)
    } finally {
      setUnmarking(false)
    }
  }

  return (
    <Card>
      <CardContent>
        <div
          className="flex items-center gap-2 cursor-pointer"
          onClick={() => setExpanded(e => !e)}
        >
          <CheckCircle className="w-4 h-4 text-success" />
          <span className="font-medium flex-1">{group.name}</span>
          <span className="text-xs text-text-muted">{group.orders.length} đơn · {formatJPY(group.total)}</span>
          {expanded ? <ChevronUp className="w-3 h-3 text-text-muted" /> : <ChevronDown className="w-3 h-3 text-text-muted" />}
        </div>
        {expanded && (
          <>
            <div className="space-y-1 mt-2">
              {group.orders.map(o => (
                <div key={o._rowIndex} className="flex items-center gap-2 text-xs text-text-secondary">
                  <span className="font-mono">{o["Mã SP"]}</span>
                  <span className="truncate flex-1">{o["Tên Sp"]} {o["SIZE"]} {o["COLOR"]}</span>
                  <span className="font-medium text-text">{formatJPY((Number(o["Giá sp"]) || 0) * Number(o["Số lượng"] || 1))}</span>
                </div>
              ))}
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={handleUnmark}
              disabled={unmarking}
              className="w-full mt-2"
            >
              {unmarking ? 'Đang xử lý...' : <><Undo2 className="w-3 h-3" /> Bỏ CK</>}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}

export default function CK() {
  const { orders, loading, refresh } = useAPI()
  const [tab, setTab] = useState('chua-ck')

  const { unpaidGroups, paidGroups } = useMemo(() => {
    const unpaid = {}
    const paid = {}

    orders.forEach(o => {
      const status = String(o["TRẠNG THÁI"] || '').trim()
      if (status !== STATUS.DA_GUI) return

      const name = String(o["Tên khách"] || '').trim()
      if (!name) return

      const note = o._note || ''
      const hasCK = note.includes('💰CK')
      const qty = Number(o["Số lượng"]) || 1
      const price = Number(o["Giá sp"]) || 0

      if (hasCK) {
        if (!paid[name]) paid[name] = { name, orders: [], oldestDays: 0, total: 0 }
        paid[name].orders.push(o)
        paid[name].total += price * qty
      } else {
        if (!unpaid[name]) unpaid[name] = { name, orders: [], oldestDays: 0, total: 0 }
        unpaid[name].orders.push(o)
        unpaid[name].total += price * qty
        const sentMatch = note.match(/📮SENT (\d{4}-\d{2}-\d{2})/)
        const dateStr = sentMatch ? sentMatch[1] : String(o["NGÀY OD"] || '').slice(0, 10)
        const d = daysSince(dateStr)
        if (d !== null && d > (unpaid[name].oldestDays || 0)) {
          unpaid[name].oldestDays = d
        }
      }
    })

    const sortByDays = (a, b) => (b.oldestDays || 0) - (a.oldestDays || 0)
    return {
      unpaidGroups: Object.values(unpaid).sort(sortByDays),
      paidGroups: Object.values(paid),
    }
  }, [orders])

  const handleMarkCK = async (group) => {
    const today = new Date().toISOString().slice(0, 10)
    const rowSet = new Set(group.orders.map(o => o._rowIndex))

    pauseAutoRefresh()

    updateGlobalOrders(prev =>
      prev.map(o => rowSet.has(o._rowIndex)
        ? { ...o, _note: (o._note || '') + ' 💰CK ' + today }
        : o
      )
    )

    try {
      const items = group.orders.map(o => ({
        rowIndex: o._rowIndex,
        tenKhach: String(o["Tên khách"] || '').trim(),
        maSP: String(o["Mã SP"] || ''),
      }))
      const r = await batchMarkCK(items)
      if (r.data) {
        syncGlobalData(r.data)
      }
      if (r.marked === 0) {
        refresh()
      }
    } catch {
      refresh()
    } finally {
      resumeAutoRefresh()
    }
  }

  const handleUnmarkCK = async (group) => {
    const rowSet = new Set(group.orders.map(o => o._rowIndex))

    pauseAutoRefresh()

    updateGlobalOrders(prev =>
      prev.map(o => rowSet.has(o._rowIndex)
        ? { ...o, _note: (o._note || '').replace(/\s*💰CK\s*\d{4}-\d{2}-\d{2}/, '') }
        : o
      )
    )

    try {
      const items = group.orders.map(o => ({
        rowIndex: o._rowIndex,
        tenKhach: String(o["Tên khách"] || '').trim(),
        maSP: String(o["Mã SP"] || ''),
      }))
      const r = await batchUnmarkCK(items)
      if (r.data) {
        syncGlobalData(r.data)
      }
      if (r.unmarked === 0) {
        refresh()
      }
    } catch {
      refresh()
    } finally {
      resumeAutoRefresh()
    }
  }

  if (loading) return <LoadingScreen />

  const stats = {
    red: unpaidGroups.filter(g => urgencyLevel(g.oldestDays) === 'red').length,
    yellow: unpaidGroups.filter(g => urgencyLevel(g.oldestDays) === 'yellow').length,
    green: unpaidGroups.filter(g => urgencyLevel(g.oldestDays) === 'green').length,
    totalDebt: unpaidGroups.reduce((s, g) => s + g.total, 0),
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl lg:text-2xl font-bold flex items-center gap-2">
        <CreditCard className="w-6 h-6 text-primary" /> CK Tracking
      </h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardContent className="text-center py-3">
            <p className="text-2xl font-bold text-danger">{stats.red}</p>
            <p className="text-xs text-text-secondary">Quá hạn &gt;7 ngày</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="text-center py-3">
            <p className="text-2xl font-bold text-warning">{stats.yellow}</p>
            <p className="text-xs text-text-secondary">Nên nhắc 3-7 ngày</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="text-center py-3">
            <p className="text-2xl font-bold text-success">{stats.green}</p>
            <p className="text-xs text-text-secondary">Mới gửi &lt;3 ngày</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="text-center py-3">
            <p className="text-2xl font-bold text-primary">{formatJPY(stats.totalDebt)}</p>
            <p className="text-xs text-text-secondary">Tổng nợ CK</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-1 bg-bg-hover rounded-lg p-1">
        <button
          onClick={() => setTab('chua-ck')}
          className={cn('flex-1 py-2.5 text-sm font-medium rounded-md transition-all min-h-[44px]',
            tab === 'chua-ck' ? 'bg-bg-card text-text shadow-sm' : 'text-text-secondary')}
        >
          Chưa CK ({unpaidGroups.length})
        </button>
        <button
          onClick={() => setTab('da-ck')}
          className={cn('flex-1 py-2.5 text-sm font-medium rounded-md transition-all min-h-[44px]',
            tab === 'da-ck' ? 'bg-bg-card text-text shadow-sm' : 'text-text-secondary')}
        >
          Đã CK ({paidGroups.length})
        </button>
      </div>

      {tab === 'chua-ck' && (
        unpaidGroups.length === 0 ? (
          <EmptyState icon={CheckCircle} title="Tất cả đã CK!" description="Không còn đơn chờ thanh toán" />
        ) : (
          <div className="space-y-3">
            {unpaidGroups.map(g => (
              <CustomerCKCard key={g.name} group={g} onMarkCK={handleMarkCK} />
            ))}
          </div>
        )
      )}

      {tab === 'da-ck' && (
        paidGroups.length === 0 ? (
          <EmptyState icon={CreditCard} title="Chưa có lịch sử" description="Chưa có khách nào CK" />
        ) : (
          <div className="space-y-3">
            {paidGroups.map(g => (
              <PaidCustomerCard key={g.name} group={g} onUnmarkCK={handleUnmarkCK} />
            ))}
          </div>
        )
      )}
    </div>
  )
}

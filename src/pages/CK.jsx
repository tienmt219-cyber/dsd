import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { LoadingScreen } from '@/components/ui/Loading'
import { EmptyState } from '@/components/ui/EmptyState'
import { useAPI } from '@/hooks/useAPI'
import { markCK } from '@/lib/api'
import { STATUS } from '@/lib/constants'
import { formatJPY, daysSince, cn } from '@/lib/utils'
import {
  CreditCard, CheckCircle, Clock, AlertTriangle, ChevronDown, ChevronUp
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

function CustomerCKCard({ group, onMarked }) {
  const [expanded, setExpanded] = useState(true)
  const [marking, setMarking] = useState(false)

  const days = group.oldestDays
  const urgency = urgencyLevel(days)
  const style = urgencyStyles[urgency]
  const total = group.orders.reduce((s, o) => s + (Number(o.price) || 0) * (Number(o.qty) || 1), 0)

  const handleMark = async () => {
    setMarking(true)
    try {
      const today = new Date().toISOString().slice(0, 10)
      await markCK(group.orders.map(o => o._row), today)
      onMarked()
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
              <div key={o._row} className="flex items-center gap-2 px-4 py-2 text-sm">
                <span className="font-mono text-xs text-text-secondary">{o.code}</span>
                <span className="truncate flex-1">{o.name}</span>
                <span className="text-xs text-text-muted">{o.size} {o.color} x{o.qty}</span>
                <span className="font-medium shrink-0">{formatJPY((Number(o.price) || 0) * o.qty)}</span>
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

export default function CK() {
  const { orders, loading, refresh } = useAPI()
  const [tab, setTab] = useState('chua-ck') // chua-ck | da-ck

  // Group "Đã gửi" orders by customer, check CK status from notes
  const { unpaidGroups, paidGroups } = useMemo(() => {
    const unpaid = {}
    const paid = {}

    orders.forEach(o => {
      if (o[8] !== STATUS.DA_GUI) return
      const notes = (o[8 + 1] || '').toString() // notes stored after status or in same col
      const name = o[0]
      const item = {
        _row: o._row,
        code: o[2], name: o[1], size: o[3], color: o[4],
        qty: Number(o[5]) || 1, price: Number(o[6]) || 0,
        orderDate: o[7],
      }

      // Check if CK'd — notes field or separate lookup
      // For now, treat all "Đã gửi" without CK note as unpaid
      const hasCK = notes.includes('💰CK')

      if (hasCK) {
        if (!paid[name]) paid[name] = { name, orders: [], oldestDays: 0 }
        paid[name].orders.push(item)
      } else {
        if (!unpaid[name]) unpaid[name] = { name, orders: [], oldestDays: 0 }
        unpaid[name].orders.push(item)
        const d = daysSince(o[7])
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

  if (loading) return <LoadingScreen />

  const stats = {
    red: unpaidGroups.filter(g => urgencyLevel(g.oldestDays) === 'red').length,
    yellow: unpaidGroups.filter(g => urgencyLevel(g.oldestDays) === 'yellow').length,
    green: unpaidGroups.filter(g => urgencyLevel(g.oldestDays) === 'green').length,
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl lg:text-2xl font-bold flex items-center gap-2">
        <CreditCard className="w-6 h-6 text-primary" /> CK Tracking
      </h1>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
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
      </div>

      {/* Tabs */}
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
              <CustomerCKCard key={g.name} group={g} onMarked={refresh} />
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
              <Card key={g.name}>
                <CardContent>
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="w-4 h-4 text-success" />
                    <span className="font-medium">{g.name}</span>
                    <span className="text-xs text-text-muted ml-auto">{g.orders.length} đơn</span>
                  </div>
                  <div className="space-y-1">
                    {g.orders.map(o => (
                      <div key={o._row} className="flex items-center gap-2 text-xs text-text-secondary">
                        <span className="font-mono">{o.code}</span>
                        <span className="truncate flex-1">{o.name} {o.size} {o.color}</span>
                        <span className="font-medium text-text">{formatJPY(o.price * o.qty)}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )
      )}
    </div>
  )
}

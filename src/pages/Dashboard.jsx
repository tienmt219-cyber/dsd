import { useMemo } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { LoadingScreen } from '@/components/ui/Loading'
import { useAPI } from '@/hooks/useAPI'
import { STATUS, STATUS_COLORS } from '@/lib/constants'
import { formatJPY, daysSince, hasFullAddress, getCustomerRank } from '@/lib/utils'
import {
  ShoppingBag, TrendingUp, Users, Package, AlertTriangle,
  ArrowUpRight, ArrowDownRight, Clock
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts'

function StatCard({ icon: Icon, label, value, sub, color = 'text-primary', trend }) {
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center bg-opacity-10 shrink-0 ${color === 'text-primary' ? 'bg-primary/10' : color === 'text-success' ? 'bg-success/10' : color === 'text-warning' ? 'bg-warning/10' : 'bg-danger/10'}`}>
          <Icon className={`w-5 h-5 ${color}`} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-text-secondary font-medium truncate">{label}</p>
          <p className="text-xl font-bold mt-0.5">{value}</p>
          {sub && (
            <p className="text-xs text-text-muted mt-0.5 flex items-center gap-1">
              {trend === 'up' && <ArrowUpRight className="w-3 h-3 text-success" />}
              {trend === 'down' && <ArrowDownRight className="w-3 h-3 text-danger" />}
              {sub}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function StatusSummary({ orders }) {
  const statusCounts = useMemo(() => {
    const counts = {}
    Object.values(STATUS).forEach(s => { counts[s] = 0 })
    orders.forEach(o => {
      const st = o[8] // column I = status
      if (counts[st] !== undefined) counts[st]++
    })
    return counts
  }, [orders])

  const activeStatuses = [STATUS.CHUA_DAT, STATUS.CHO_HANG, STATUS.DANG_SHIP, STATUS.VE_KHO, STATUS.DA_GUI]

  return (
    <Card>
      <CardHeader>
        <h3 className="font-semibold text-sm">Trạng thái đơn hàng</h3>
      </CardHeader>
      <CardContent className="space-y-2">
        {activeStatuses.map(status => (
          <div key={status} className="flex items-center justify-between">
            <StatusBadge status={status} />
            <span className="font-semibold text-sm">{statusCounts[status] || 0}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function RevenueChart({ orders }) {
  const chartData = useMemo(() => {
    const days = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const key = d.toISOString().slice(0, 10)
      const label = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })
      days.push({ date: key, label, revenue: 0, count: 0 })
    }

    orders.forEach(o => {
      const orderDate = o[7] // column H
      if (!orderDate) return
      const d = new Date(orderDate)
      if (isNaN(d.getTime())) return
      const key = d.toISOString().slice(0, 10)
      const day = days.find(dd => dd.date === key)
      if (day) {
        const price = Number(o[6]) || 0 // column G
        const qty = Number(o[5]) || 1 // column F
        day.revenue += price * qty
        day.count++
      }
    })

    return days
  }, [orders])

  return (
    <Card>
      <CardHeader>
        <h3 className="font-semibold text-sm">Doanh thu 7 ngày</h3>
      </CardHeader>
      <CardContent>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }}
                axisLine={{ stroke: 'var(--color-border)' }}
              />
              <YAxis
                tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }}
                axisLine={{ stroke: 'var(--color-border)' }}
                tickFormatter={v => `¥${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip
                contentStyle={{
                  background: 'var(--color-bg-card)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
                formatter={(v) => [formatJPY(v), 'Doanh thu']}
              />
              <Bar dataKey="revenue" fill="#7C3AED" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

function TopProducts({ orders, catalog }) {
  const topProducts = useMemo(() => {
    const map = {}
    orders.forEach(o => {
      const code = o[2] // column C
      if (!code) return
      const qty = Number(o[5]) || 1
      if (!map[code]) map[code] = { code, name: o[1], qty: 0, revenue: 0 }
      map[code].qty += qty
      map[code].revenue += (Number(o[6]) || 0) * qty
    })
    return Object.values(map).sort((a, b) => b.qty - a.qty).slice(0, 5)
  }, [orders, catalog])

  return (
    <Card>
      <CardHeader>
        <h3 className="font-semibold text-sm">Top 5 SP bán chạy</h3>
      </CardHeader>
      <CardContent className="space-y-3">
        {topProducts.map((p, i) => (
          <div key={p.code} className="flex items-center gap-3">
            <span className="text-xs font-bold text-text-muted w-5">{i + 1}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{p.code} - {p.name}</p>
              <p className="text-xs text-text-secondary">{p.qty} SP | {formatJPY(p.revenue)}</p>
            </div>
          </div>
        ))}
        {topProducts.length === 0 && (
          <p className="text-sm text-text-muted text-center py-4">Chưa có dữ liệu</p>
        )}
      </CardContent>
    </Card>
  )
}

function TopCustomers({ customers }) {
  const topCusts = useMemo(() => {
    return [...customers]
      .sort((a, b) => (Number(b[1]) || 0) - (Number(a[1]) || 0))
      .slice(0, 5)
  }, [customers])

  return (
    <Card>
      <CardHeader>
        <h3 className="font-semibold text-sm">Top 5 khách VIP</h3>
      </CardHeader>
      <CardContent className="space-y-3">
        {topCusts.map((c, i) => {
          const rank = getCustomerRank(Number(c[1]) || 0)
          return (
            <div key={i} className="flex items-center gap-3">
              <span className="text-xs font-bold text-text-muted w-5">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {rank.emoji} {c[0]}
                </p>
                <p className="text-xs text-text-secondary">
                  {c[1]} đơn | {formatJPY(c[3])}
                </p>
              </div>
            </div>
          )
        })}
        {topCusts.length === 0 && (
          <p className="text-sm text-text-muted text-center py-4">Chưa có dữ liệu</p>
        )}
      </CardContent>
    </Card>
  )
}

function Alerts({ orders, customers }) {
  const alerts = useMemo(() => {
    const list = []
    // Orders over 21 days
    const oldOrders = orders.filter(o => {
      const status = o[8]
      if (status === STATUS.DA_GUI || status === STATUS.DA_XOA || status === STATUS.LUU_TRU) return false
      const days = daysSince(o[7])
      return days !== null && days > 21
    })
    if (oldOrders.length > 0) {
      list.push({
        type: 'danger',
        icon: AlertTriangle,
        text: `${oldOrders.length} đơn quá 21 ngày chưa hoàn thành`,
      })
    }

    // Orders waiting to ship
    const veKho = orders.filter(o => o[8] === STATUS.VE_KHO)
    if (veKho.length > 0) {
      list.push({
        type: 'warning',
        icon: Package,
        text: `${veKho.length} đơn Về kho chờ gửi khách`,
      })
    }

    // Customers missing address
    const missingAddr = customers.filter(c => {
      return !c[7] || !c[8] || !c[9] || !c[10]
    })
    if (missingAddr.length > 0) {
      const pct = customers.length > 0
        ? Math.round((customers.length - missingAddr.length) / customers.length * 100)
        : 0
      list.push({
        type: 'info',
        icon: Users,
        text: `${pct}% khách đủ địa chỉ (${missingAddr.length} thiếu)`,
      })
    }

    // Unpaid orders
    const unpaid = orders.filter(o => {
      if (o[8] !== STATUS.DA_GUI) return false
      const notes = o[8 + 1] || '' // Simplified; notes on column I
      return !notes.includes('💰CK')
    })
    if (unpaid.length > 5) {
      list.push({
        type: 'warning',
        icon: Clock,
        text: `${unpaid.length} đơn Đã gửi chưa CK`,
      })
    }

    return list
  }, [orders, customers])

  if (alerts.length === 0) return null

  const typeColors = {
    danger: 'border-danger/30 bg-danger/5',
    warning: 'border-warning/30 bg-warning/5',
    info: 'border-primary/30 bg-primary/5',
  }

  return (
    <Card>
      <CardHeader>
        <h3 className="font-semibold text-sm">Cảnh báo</h3>
      </CardHeader>
      <CardContent className="space-y-2">
        {alerts.map((alert, i) => (
          <div
            key={i}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border ${typeColors[alert.type]}`}
          >
            <alert.icon className={`w-4 h-4 shrink-0 ${
              alert.type === 'danger' ? 'text-danger' :
              alert.type === 'warning' ? 'text-warning' : 'text-primary'
            }`} />
            <span className="text-sm">{alert.text}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

export default function Dashboard() {
  const { orders, catalog, customers, stock, surplus, loading } = useAPI()

  const stats = useMemo(() => {
    if (!orders.length) return { revenue: 0, profit: 0, totalOrders: 0, activeOrders: 0 }

    let revenue = 0
    let activeOrders = 0
    const activeStatuses = [STATUS.CHUA_DAT, STATUS.CHO_HANG, STATUS.DANG_SHIP, STATUS.VE_KHO, STATUS.DA_GUI]

    orders.forEach(o => {
      const price = Number(o[6]) || 0
      const qty = Number(o[5]) || 1
      revenue += price * qty
      if (activeStatuses.includes(o[8])) activeOrders++
    })

    // Simplified profit calc
    const catalogMap = {}
    catalog.forEach(c => { catalogMap[c[0]] = Number(c[4]) || 0 })
    let profit = 0
    orders.forEach(o => {
      const code = o[2]
      const qty = Number(o[5]) || 1
      profit += (catalogMap[code] || 0) * qty
    })

    return {
      revenue,
      profit,
      totalOrders: orders.length,
      activeOrders,
    }
  }, [orders, catalog])

  if (loading) return <LoadingScreen />

  return (
    <div className="space-y-4 lg:space-y-6">
      <h1 className="text-xl lg:text-2xl font-bold">Dashboard</h1>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <StatCard
          icon={ShoppingBag}
          label="Tổng đơn active"
          value={stats.activeOrders}
          sub={`${stats.totalOrders} tổng cộng`}
          color="text-primary"
        />
        <StatCard
          icon={TrendingUp}
          label="Doanh thu"
          value={formatJPY(stats.revenue)}
          color="text-success"
        />
        <StatCard
          icon={TrendingUp}
          label="Lợi nhuận"
          value={formatJPY(stats.profit)}
          color="text-warning"
        />
        <StatCard
          icon={Users}
          label="Khách hàng"
          value={customers.length}
          color="text-primary"
        />
      </div>

      {/* Charts & alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-4">
        <RevenueChart orders={orders} />
        <Alerts orders={orders} customers={customers} />
      </div>

      {/* Status + Top lists */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 lg:gap-4">
        <StatusSummary orders={orders} />
        <TopProducts orders={orders} catalog={catalog} />
        <TopCustomers customers={customers} />
      </div>
    </div>
  )
}

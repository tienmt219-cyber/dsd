import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { LoadingScreen } from '@/components/ui/Loading'
import { EmptyState } from '@/components/ui/EmptyState'
import { useAPI } from '@/hooks/useAPI'
import { bulkUpdateStatus } from '@/lib/api'
import { STATUS } from '@/lib/constants'
import { formatJPY, cn } from '@/lib/utils'
import {
  Factory, CheckCircle, Copy, Package, ChevronDown, ChevronUp,
  Plane, AlertTriangle, Plus, Minus
} from 'lucide-react'

/* ── Color mapping VN → CN ── */
const COLOR_MAP = {
  'đen': '黑色', 'trắng': '白色', 'be': '米色', 'hồng': '粉色',
  'đỏ': '红色', 'xanh': '蓝色', 'xám': '灰色', 'nâu': '棕色',
  'vàng': '黄色', 'tím': '紫色', 'xanh lá': '绿色', 'cam': '橙色',
  'kem': '奶油色', 'rêu': '苔绿色', 'ghi': '灰色',
}

function colorToCN(vn) {
  if (!vn) return vn
  const lower = vn.toLowerCase().trim()
  return COLOR_MAP[lower] || vn
}

function sizeToCN(size) {
  return size ? `${size}码` : size
}

/* ── Build supplier message ── */
function buildSupplierMsg(items) {
  const lines = items.map((it, i) =>
    `${i + 1}. ${it.code} ${colorToCN(it.color)} ${sizeToCN(it.size)} x${it.orderQty}`
  )
  return `老板你好，我要订以下商品：\n${lines.join('\n')}\n请确认价格和库存，谢谢！`
}

/* ── SKU group card ── */
function SKUGroup({ sku, orders, onUpdateQty }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="border-b border-border/50 last:border-0">
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-bg-hover/50"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded font-semibold">{sku.code}</span>
            <span className="text-sm font-medium truncate">{sku.color}</span>
            <span className="text-xs text-text-muted">{sku.size}</span>
          </div>
          <p className="text-xs text-text-secondary mt-0.5">{sku.name}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-bold">x{sku.totalQty}</p>
          <p className="text-xs text-text-muted">{sku.customers.length} khách</p>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-text-muted" /> : <ChevronDown className="w-4 h-4 text-text-muted" />}
      </div>
      {expanded && (
        <div className="px-4 pb-3 space-y-1">
          {sku.customers.map((c, i) => (
            <div key={i} className="flex items-center gap-2 text-xs bg-bg-hover rounded-lg px-3 py-1.5">
              <span className="font-medium flex-1">{c.name}</span>
              <span className="text-text-secondary">{c.size} · {c.color}</span>
              <span>x{c.qty}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Order qty adjuster for surplus ── */
function QtyAdjuster({ code, size, color, orderQty, value, onChange }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-text-secondary flex-1">
        {code} {size} {color} — đơn: {orderQty}
      </span>
      <div className="flex items-center gap-1">
        <button
          className="w-7 h-7 flex items-center justify-center rounded bg-bg-hover hover:bg-border text-text-secondary"
          onClick={() => onChange(Math.max(orderQty, value - 1))}
        >
          <Minus className="w-3 h-3" />
        </button>
        <input
          type="number"
          value={value}
          onChange={e => onChange(Math.max(orderQty, Number(e.target.value) || orderQty))}
          className="w-12 h-7 text-center text-sm border border-border rounded bg-bg-input"
          min={orderQty}
        />
        <button
          className="w-7 h-7 flex items-center justify-center rounded bg-bg-hover hover:bg-border text-text-secondary"
          onClick={() => onChange(value + 1)}
        >
          <Plus className="w-3 h-3" />
        </button>
      </div>
      {value > orderQty && (
        <span className="text-xs text-warning font-medium">+{value - orderQty} dư</span>
      )}
    </div>
  )
}

export default function GZ() {
  const { orders, catalog, loading, refresh } = useAPI()
  const [tab, setTab] = useState('chua-dat') // chua-dat | cho-hang | dang-ship
  const [orderQtys, setOrderQtys] = useState({}) // key: code-size-color => qty
  const [emsCode, setEmsCode] = useState('')
  const [updating, setUpdating] = useState(false)
  const [copied, setCopied] = useState(false)

  const tabOrders = useMemo(() => {
    const statusMap = {
      'chua-dat': STATUS.CHUA_DAT,
      'cho-hang': STATUS.CHO_HANG,
      'dang-ship': STATUS.DANG_SHIP,
    }
    return orders.filter(o => o[8] === statusMap[tab])
  }, [orders, tab])

  // Group by SKU (code + size + color)
  const skuGroups = useMemo(() => {
    const map = {}
    tabOrders.forEach(o => {
      const key = `${o[2]}|${o[3]}|${o[4]}`
      if (!map[key]) {
        const cat = catalog.find(c => c[0] === o[2])
        map[key] = {
          code: o[2], size: o[3], color: o[4],
          name: o[1] || cat?.[1] || '',
          totalQty: 0,
          customers: [],
          rows: [],
        }
      }
      const qty = Number(o[5]) || 1
      map[key].totalQty += qty
      map[key].customers.push({ name: o[0], size: o[3], color: o[4], qty })
      map[key].rows.push(o._row)
    })
    return Object.values(map).sort((a, b) => b.totalQty - a.totalQty)
  }, [tabOrders, catalog])

  // Flat items for supplier message
  const supplierItems = useMemo(() => {
    return skuGroups.map(sku => {
      const key = `${sku.code}|${sku.size}|${sku.color}`
      const orderQty = orderQtys[key] ?? sku.totalQty
      return { ...sku, orderQty }
    })
  }, [skuGroups, orderQtys])

  const allRows = tabOrders.map(o => o._row)

  const handleDatGZ = async () => {
    if (allRows.length === 0) return
    setUpdating(true)
    try {
      // Build surplus info from adjusted qtys
      const surplusItems = supplierItems
        .filter(it => it.orderQty > it.totalQty)
        .map(it => ({
          code: it.code, size: it.size, color: it.color,
          surplusQty: it.orderQty - it.totalQty,
        }))
      await bulkUpdateStatus(allRows, STATUS.CHO_HANG, { surplus: surplusItems })
      refresh()
    } catch (err) {
      alert('Lỗi: ' + err.message)
    } finally {
      setUpdating(false)
    }
  }

  const handleDangShip = async () => {
    if (allRows.length === 0) return
    setUpdating(true)
    try {
      await bulkUpdateStatus(allRows, STATUS.DANG_SHIP, { ems: emsCode.trim() })
      setEmsCode('')
      refresh()
    } catch (err) {
      alert('Lỗi: ' + err.message)
    } finally {
      setUpdating(false)
    }
  }

  const copySupplierMsg = () => {
    const msg = buildSupplierMsg(supplierItems)
    navigator.clipboard.writeText(msg)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) return <LoadingScreen />

  const tabCounts = {
    'chua-dat': orders.filter(o => o[8] === STATUS.CHUA_DAT).length,
    'cho-hang': orders.filter(o => o[8] === STATUS.CHO_HANG).length,
    'dang-ship': orders.filter(o => o[8] === STATUS.DANG_SHIP).length,
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl lg:text-2xl font-bold flex items-center gap-2">
        <Factory className="w-6 h-6 text-primary" /> Đặt GZ
      </h1>

      {/* Tab bar */}
      <div className="flex gap-1 bg-bg-hover rounded-lg p-1">
        {[
          { key: 'chua-dat', label: 'Chưa đặt', count: tabCounts['chua-dat'] },
          { key: 'cho-hang', label: 'Chờ hàng', count: tabCounts['cho-hang'] },
          { key: 'dang-ship', label: 'Đang ship', count: tabCounts['dang-ship'] },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'flex-1 py-2.5 text-sm font-medium rounded-md transition-all min-h-[44px]',
              tab === t.key
                ? 'bg-bg-card text-text shadow-sm'
                : 'text-text-secondary hover:text-text'
            )}
          >
            {t.label} {t.count > 0 && <span className="ml-1 text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">{t.count}</span>}
          </button>
        ))}
      </div>

      {skuGroups.length === 0 ? (
        <EmptyState
          icon={Package}
          title={`Không có đơn ${tab === 'chua-dat' ? 'chưa đặt' : tab === 'cho-hang' ? 'chờ hàng' : 'đang ship'}`}
        />
      ) : (
        <>
          {/* SKU list */}
          <Card className="overflow-hidden">
            <CardHeader>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">
                  {skuGroups.length} SKU · {tabOrders.length} đơn
                </h3>
              </div>
            </CardHeader>
            {skuGroups.map((sku, i) => (
              <SKUGroup key={i} sku={sku} />
            ))}
          </Card>

          {/* CHƯA ĐẶT actions */}
          {tab === 'chua-dat' && skuGroups.length > 0 && (
            <Card>
              <CardHeader>
                <h3 className="font-semibold text-sm">Đặt hàng GZ</h3>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-text-secondary">
                  Điều chỉnh SL nếu muốn đặt dư (hàng thừa sẽ tự tạo HÀNG DƯ):
                </p>
                <div className="space-y-2">
                  {supplierItems.map((it, i) => {
                    const key = `${it.code}|${it.size}|${it.color}`
                    return (
                      <QtyAdjuster
                        key={i}
                        code={it.code}
                        size={it.size}
                        color={it.color}
                        orderQty={it.totalQty}
                        value={orderQtys[key] ?? it.totalQty}
                        onChange={v => setOrderQtys(prev => ({ ...prev, [key]: v }))}
                      />
                    )
                  })}
                </div>

                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={copySupplierMsg} className="flex-1">
                    {copied ? <><CheckCircle className="w-4 h-4" /> Đã copy!</> : <><Copy className="w-4 h-4" /> Copy tin TQ</>}
                  </Button>
                  <Button size="sm" onClick={handleDatGZ} disabled={updating} className="flex-1">
                    {updating ? 'Đang xử lý...' : `Đặt GZ (${tabOrders.length} đơn)`}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* CHỜ HÀNG actions */}
          {tab === 'cho-hang' && skuGroups.length > 0 && (
            <Card>
              <CardContent className="space-y-3">
                <Input
                  label="Mã EMS tracking"
                  value={emsCode}
                  onChange={e => setEmsCode(e.target.value)}
                  placeholder="EJ123456789JP"
                />
                <Button onClick={handleDangShip} disabled={updating || !emsCode.trim()} className="w-full">
                  <Plane className="w-4 h-4" />
                  {updating ? 'Đang xử lý...' : `Đang ship (${tabOrders.length} đơn)`}
                </Button>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}

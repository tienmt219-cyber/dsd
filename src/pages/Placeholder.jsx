import { Card, CardContent } from '@/components/ui/Card'
import { cn } from '@/lib/utils'

const icons = {
  'ai-order': '🤖',
  'ai-chat': '💬',
  'gz': '🏭',
  'ems': '✈️',
  'ship': '🚚',
  'stock': '📦',
  'products': '🏷️',
  'tools': '🛠',
  'ck': '💳',
}

const titles = {
  'ai-order': 'AI Nhập đơn',
  'ai-chat': 'Trợ lý AI',
  'gz': 'Đặt GZ',
  'ems': 'Kiện EMS',
  'ship': 'Chờ gửi',
  'stock': 'Kho',
  'products': 'Sản phẩm',
  'tools': 'Tools',
  'ck': 'CK Tracking',
}

export default function Placeholder({ page }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh]">
      <Card className="max-w-sm w-full text-center">
        <CardContent className="py-12">
          <span className="text-5xl mb-4 block">{icons[page] || '🚧'}</span>
          <h2 className="text-xl font-bold mb-2">{titles[page] || page}</h2>
          <p className="text-text-secondary text-sm">
            Module này sẽ được build trong phase tiếp theo
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

import { useState, useRef } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { useAPI } from '@/hooks/useAPI'
import { saveProductImage } from '@/lib/api'
import { formatJPY, cn } from '@/lib/utils'
import { BANK_INFO, COST } from '@/lib/constants'
import {
  Wrench, Image, Calculator, MessageSquare, Download, Copy, CheckCircle,
  Upload, X
} from 'lucide-react'

/* ═══════════ WATERMARK ═══════════ */
function WatermarkTool() {
  const { refresh } = useAPI()
  const [images, setImages] = useState([])
  const [code, setCode] = useState('')
  const [price, setPrice] = useState('')
  const [position, setPosition] = useState('bottom-right')
  const [processing, setProcessing] = useState(false)
  const fileRef = useRef(null)

  const handleFiles = (e) => {
    const files = Array.from(e.target.files)
    files.forEach(file => {
      const reader = new FileReader()
      reader.onload = (ev) => {
        setImages(prev => [...prev, { src: ev.target.result, name: file.name }])
      }
      reader.readAsDataURL(file)
    })
  }

  const removeImage = idx => setImages(prev => prev.filter((_, i) => i !== idx))

  const processImages = async () => {
    if (!images.length || !code) return
    setProcessing(true)
    try {
      const results = []
      for (const img of images) {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        const image = new window.Image()
        await new Promise((resolve, reject) => {
          image.onload = resolve
          image.onerror = reject
          image.src = img.src
        })

        canvas.width = image.width
        canvas.height = image.height
        ctx.drawImage(image, 0, 0)

        // Watermark text
        const text = `${code} ¥${Number(price).toLocaleString('ja-JP')}`
        const fontSize = Math.max(20, Math.floor(canvas.width / 20))
        ctx.font = `bold ${fontSize}px Arial`
        ctx.fillStyle = 'rgba(255,255,255,0.85)'
        ctx.strokeStyle = 'rgba(0,0,0,0.6)'
        ctx.lineWidth = 2

        const metrics = ctx.measureText(text)
        const pad = 20
        let x, y
        switch (position) {
          case 'top-left': x = pad; y = fontSize + pad; break
          case 'top-right': x = canvas.width - metrics.width - pad; y = fontSize + pad; break
          case 'bottom-left': x = pad; y = canvas.height - pad; break
          case 'center': x = (canvas.width - metrics.width) / 2; y = canvas.height / 2; break
          default: x = canvas.width - metrics.width - pad; y = canvas.height - pad; break
        }
        ctx.strokeText(text, x, y)
        ctx.fillText(text, x, y)

        const dataUrl = canvas.toDataURL('image/jpeg', 0.9)
        results.push({ dataUrl, name: img.name })
      }

      // Download each
      results.forEach(r => {
        const a = document.createElement('a')
        a.href = r.dataUrl
        a.download = `wm_${code}_${r.name}`
        a.click()
      })

      // Save thumbnail (80px) of first image to CATALOG
      if (results.length > 0) {
        const thumbCanvas = document.createElement('canvas')
        const thumbCtx = thumbCanvas.getContext('2d')
        const thumbImg = new window.Image()
        await new Promise(r => { thumbImg.onload = r; thumbImg.src = images[0].src })
        const ratio = 80 / Math.max(thumbImg.width, thumbImg.height)
        thumbCanvas.width = thumbImg.width * ratio
        thumbCanvas.height = thumbImg.height * ratio
        thumbCtx.drawImage(thumbImg, 0, 0, thumbCanvas.width, thumbCanvas.height)
        const thumbData = thumbCanvas.toDataURL('image/jpeg', 0.7)
        await saveProductImage(code, thumbData)
        refresh()
      }
    } catch (err) {
      alert('Lỗi: ' + err.message)
    } finally {
      setProcessing(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <Image className="w-4 h-4 text-primary" /> Watermark ảnh
        </h3>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Input label="Mã SP" value={code} onChange={e => setCode(e.target.value)} placeholder="#AK01" />
          <Input label="Giá (¥)" type="number" value={price} onChange={e => setPrice(e.target.value)} placeholder="2500" />
        </div>
        <Select label="Vị trí watermark" value={position} onChange={e => setPosition(e.target.value)}>
          <option value="bottom-right">Dưới phải</option>
          <option value="bottom-left">Dưới trái</option>
          <option value="top-right">Trên phải</option>
          <option value="top-left">Trên trái</option>
          <option value="center">Giữa</option>
        </Select>

        {/* Upload area */}
        <div
          className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors"
          onClick={() => fileRef.current?.click()}
        >
          <Upload className="w-8 h-8 text-text-muted mx-auto mb-2" />
          <p className="text-sm text-text-secondary">Bấm chọn ảnh hoặc kéo thả</p>
          <p className="text-xs text-text-muted mt-1">Hỗ trợ batch: chọn nhiều ảnh</p>
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFiles} />
        </div>

        {/* Image previews */}
        {images.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {images.map((img, i) => (
              <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden group">
                <img src={img.src} alt="" className="w-full h-full object-cover" />
                <button
                  onClick={() => removeImage(i)}
                  className="absolute top-0.5 right-0.5 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3 text-white" />
                </button>
              </div>
            ))}
          </div>
        )}

        <Button onClick={processImages} disabled={!images.length || !code || processing} className="w-full">
          {processing ? 'Đang xử lý...' : <><Download className="w-4 h-4" /> Watermark & Tải ({images.length} ảnh)</>}
        </Button>
        <p className="text-xs text-text-muted">Thumbnail 80px sẽ auto lưu vào CATALOG cho mã {code || '...'}</p>
      </CardContent>
    </Card>
  )
}

/* ═══════════ PRICE CALC ═══════════ */
function PriceCalc() {
  const [buyPrice, setBuyPrice] = useState('')
  const [shipGZ, setShipGZ] = useState('15')
  const [rate, setRate] = useState('20')
  const [bossFee, setBossFee] = useState(String(COST.BOSS_FEE))
  const [margin, setMargin] = useState('35')

  const buyJPY = Math.round((Number(buyPrice) || 0) * (Number(rate) || 20))
  const shipJPY = Math.round((Number(shipGZ) || 0) * (Number(rate) || 20))
  const totalCost = buyJPY + shipJPY + (Number(bossFee) || 0)
  const sellPrice = Math.round(totalCost / (1 - (Number(margin) || 35) / 100))
  const profit = sellPrice - totalCost

  return (
    <Card>
      <CardHeader>
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <Calculator className="w-4 h-4 text-primary" /> Tính giá bán
        </h3>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Input label="Giá nhập (CNY)" type="number" value={buyPrice} onChange={e => setBuyPrice(e.target.value)} placeholder="45" />
          <Input label="Ship GZ (CNY)" type="number" value={shipGZ} onChange={e => setShipGZ(e.target.value)} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Input label="Tỷ giá CNY/JPY" type="number" value={rate} onChange={e => setRate(e.target.value)} />
          <Input label="Phí BOSS (¥)" type="number" value={bossFee} onChange={e => setBossFee(e.target.value)} />
          <Input label="Margin %" type="number" value={margin} onChange={e => setMargin(e.target.value)} />
        </div>

        {buyPrice && (
          <div className="bg-bg-hover rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-text-secondary">Giá nhập (JPY)</span>
              <span>{formatJPY(buyJPY)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-text-secondary">Ship GZ</span>
              <span>{formatJPY(shipJPY)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-text-secondary">BOSS fee</span>
              <span>{formatJPY(bossFee)}</span>
            </div>
            <div className="border-t border-border pt-2 flex justify-between text-sm">
              <span className="text-text-secondary">Tổng cost</span>
              <span className="font-medium">{formatJPY(totalCost)}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-semibold text-primary">Giá bán</span>
              <span className="font-bold text-xl text-primary">{formatJPY(sellPrice)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-success">Lợi nhuận</span>
              <span className="font-semibold text-success">{formatJPY(profit)}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/* ═══════════ MESSAGE TEMPLATES ═══════════ */
function MessageTemplates() {
  const [copied, setCopied] = useState('')
  const [name, setName] = useState('')
  const [product, setProduct] = useState('')
  const [price, setPrice] = useState('')
  const [shipFee, setShipFee] = useState('')

  const copy = (key, text) => {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(''), 2000)
  }

  const total = (Number(price) || 0) + (Number(shipFee) || 0)
  const n = name || '[Tên]'
  const p = product || '[Tên SP]'

  const templates = [
    {
      key: 'confirm',
      label: 'Xác nhận đơn',
      text: `${n} ơi em xác nhận đơn nha!\n${p}\nGiá: ${price ? formatJPY(price) : '¥___'}\nHàng sẽ về trong 7-14 ngày. Về kho em báo ${n} CK nhé! 💜`,
    },
    {
      key: 'arrived',
      label: 'Hàng về kho',
      text: `Hàng c về rồi!\n\n• ${p} — ${price ? formatJPY(price) : '¥___'}\n📮 Ship: ${shipFee ? formatJPY(shipFee) : '¥___'}\n\n💰 Tổng CK: ${formatJPY(total)}\n\n━━━━━━━━━━━━\n💜 PayPay: ${BANK_INFO.paypay}\n🇻🇳 VNĐ:\n${BANK_INFO.techcombank.name}\nTechcombank\n${BANK_INFO.techcombank.account}\n(không ghi nội dung CK)\n🇯🇵 MUFJ:\n${BANK_INFO.mufj.branch}\nSTK: ${BANK_INFO.mufj.account}\n${BANK_INFO.mufj.name}\n━━━━━━━━━━━━\nCK xong báo t nhé.`,
    },
    {
      key: 'remind',
      label: 'Nhắc CK',
      text: `${n} ơi, đơn hàng ${p} đã gửi rồi nha! Khi nào tiện ${n} CK giúp e nhé.\n\n💰 Tổng: ${formatJPY(total)}\n💜 PayPay: ${BANK_INFO.paypay}\nCK xong báo t nhé 💜`,
    },
    {
      key: 'bank',
      label: 'Thông tin CK',
      text: `💜 PayPay: ${BANK_INFO.paypay}\n🇻🇳 VNĐ:\n${BANK_INFO.techcombank.name}\nTechcombank\n${BANK_INFO.techcombank.account}\n(không ghi nội dung CK)\n🇯🇵 MUFJ:\n${BANK_INFO.mufj.branch}\nSTK: ${BANK_INFO.mufj.account}\n${BANK_INFO.mufj.name}`,
    },
  ]

  return (
    <Card>
      <CardHeader>
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-primary" /> Tin nhắn mẫu
        </h3>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Input label="Tên khách" value={name} onChange={e => setName(e.target.value)} placeholder="Tên" />
          <Input label="Tên SP" value={product} onChange={e => setProduct(e.target.value)} placeholder="Áo khoác..." />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Giá (¥)" type="number" value={price} onChange={e => setPrice(e.target.value)} />
          <Input label="Ship (¥)" type="number" value={shipFee} onChange={e => setShipFee(e.target.value)} />
        </div>

        <div className="space-y-2">
          {templates.map(t => (
            <div key={t.key} className="border border-border rounded-lg overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 bg-bg-hover/50">
                <span className="text-xs font-semibold text-text-secondary">{t.label}</span>
                <Button variant="ghost" size="sm" onClick={() => copy(t.key, t.text)}>
                  {copied === t.key
                    ? <><CheckCircle className="w-3.5 h-3.5 text-success" /> Đã copy</>
                    : <><Copy className="w-3.5 h-3.5" /> Copy</>}
                </Button>
              </div>
              <pre className="px-3 py-2 text-xs text-text-secondary whitespace-pre-wrap max-h-32 overflow-y-auto">
                {t.text}
              </pre>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

/* ═══════════ MAIN ═══════════ */
export default function Tools() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl lg:text-2xl font-bold flex items-center gap-2">
        <Wrench className="w-6 h-6 text-primary" /> Tools
      </h1>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <WatermarkTool />
        <PriceCalc />
      </div>
      <MessageTemplates />
    </div>
  )
}

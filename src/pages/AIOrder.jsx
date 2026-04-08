import { useState, useRef, useMemo } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { Spinner } from '@/components/ui/Loading'
import { useAPI } from '@/hooks/useAPI'
import { addBatchOrders } from '@/lib/api'
import { SIZES } from '@/lib/constants'
import { formatJPY, cn } from '@/lib/utils'
import {
  Bot, MessageSquare, Camera, Send, Pencil, CheckCircle,
  Upload, Trash2, Plus, Sparkles
} from 'lucide-react'

const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'

function resizeImage(file, maxWidth = 500) {
  return new Promise((resolve) => {
    const img = new window.Image()
    const reader = new FileReader()
    reader.onload = e => {
      img.onload = () => {
        const ratio = maxWidth / Math.max(img.width, img.height)
        if (ratio >= 1) { resolve(e.target.result); return }
        const canvas = document.createElement('canvas')
        canvas.width = img.width * ratio
        canvas.height = img.height * ratio
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', 0.8))
      }
      img.src = e.target.result
    }
    reader.readAsDataURL(file)
  })
}

function buildPrompt(catalog) {
  const catList = catalog.slice(0, 50).map(c => `${c[0]} - ${c[1]} - ¥${c[2]}`).join('\n')
  return `Bạn là AI parser cho shop thời trang. Parse tin nhắn/ảnh đặt hàng từ khách.
Trích xuất: tên khách, mã SP, size, màu, số lượng.
Catalog:
${catList}

Trả về JSON array (không markdown):
[{"name":"tên khách","code":"#AK01","size":"M","color":"Đen","qty":1}]
Nếu không rõ field nào thì để "".`
}

export default function AIOrder() {
  const { catalog, refresh } = useAPI()
  const [mode, setMode] = useState('text') // text | image
  const [input, setInput] = useState('')
  const [imageData, setImageData] = useState(null)
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('gemini_key') || '')
  const [model, setModel] = useState('gemini')
  const [parsing, setParsing] = useState(false)
  const [parsedItems, setParsedItems] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const fileRef = useRef(null)

  const saveKey = (key) => {
    setApiKey(key)
    localStorage.setItem('gemini_key', key)
  }

  const handleImage = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const resized = await resizeImage(file)
    setImageData(resized)
  }

  const handleParse = async () => {
    if (!apiKey) { alert('Nhập Gemini API key trước'); return }
    if (mode === 'text' && !input.trim()) return
    if (mode === 'image' && !imageData) return

    setParsing(true)
    setParsedItems(null)
    try {
      const prompt = buildPrompt(catalog)
      const parts = [{ text: prompt + '\n\nTin nhắn khách:\n' + (mode === 'text' ? input : '(xem ảnh đính kèm)') }]
      if (mode === 'image' && imageData) {
        const base64 = imageData.split(',')[1]
        parts.push({
          inline_data: { mime_type: 'image/jpeg', data: base64 }
        })
      }

      const res = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: { thinkingConfig: { thinkingBudget: 0 } },
        }),
      })
      const data = await res.json()
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''

      // Extract JSON from response
      const jsonMatch = text.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        const items = JSON.parse(jsonMatch[0])
        // Enrich with catalog data
        const enriched = items.map(item => {
          const cat = catalog.find(c => c[0] === item.code)
          return {
            ...item,
            productName: cat?.[1] || item.name || '',
            price: cat?.[2] || '',
            qty: Number(item.qty) || 1,
          }
        })
        setParsedItems(enriched)
      } else {
        alert('AI không parse được. Response:\n' + text.slice(0, 200))
      }
    } catch (err) {
      alert('Lỗi AI: ' + err.message)
    } finally {
      setParsing(false)
    }
  }

  const updateParsed = (idx, field, value) => {
    setParsedItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it))
  }
  const removeParsed = idx => setParsedItems(prev => prev.filter((_, i) => i !== idx))
  const addParsed = () => setParsedItems(prev => [...prev, { name: '', code: '', size: '', color: '', qty: 1, price: '', productName: '' }])

  const handleSubmit = async () => {
    if (!parsedItems?.length) return
    setSubmitting(true)
    try {
      const orders = parsedItems.map(it => ({
        name: it.name,
        productName: it.productName,
        productCode: it.code,
        size: it.size,
        color: it.color,
        qty: Number(it.qty) || 1,
        price: Number(it.price) || 0,
        fbLink: '',
      }))
      await addBatchOrders(orders)
      setSuccess(true)
      setParsedItems(null)
      setInput('')
      setImageData(null)
      refresh()
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      alert('Lỗi tạo đơn: ' + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <h1 className="text-xl lg:text-2xl font-bold flex items-center gap-2">
        <Bot className="w-6 h-6 text-primary" /> AI Nhập đơn
      </h1>

      {success && (
        <Card className="border-success/30 bg-success/5">
          <CardContent className="flex items-center gap-2 text-success font-medium text-sm">
            <CheckCircle className="w-5 h-5" /> Đã tạo đơn thành công!
          </CardContent>
        </Card>
      )}

      {/* API Key */}
      <Card>
        <CardContent>
          <Input
            label="Gemini API Key"
            type="password"
            value={apiKey}
            onChange={e => saveKey(e.target.value)}
            placeholder="AIza..."
          />
        </CardContent>
      </Card>

      {/* Mode toggle */}
      <div className="flex gap-1 bg-bg-hover rounded-lg p-1">
        <button
          onClick={() => setMode('text')}
          className={cn('flex-1 py-2.5 text-sm font-medium rounded-md flex items-center justify-center gap-2 min-h-[44px]',
            mode === 'text' ? 'bg-bg-card text-text shadow-sm' : 'text-text-secondary')}
        >
          <MessageSquare className="w-4 h-4" /> Text
        </button>
        <button
          onClick={() => setMode('image')}
          className={cn('flex-1 py-2.5 text-sm font-medium rounded-md flex items-center justify-center gap-2 min-h-[44px]',
            mode === 'image' ? 'bg-bg-card text-text shadow-sm' : 'text-text-secondary')}
        >
          <Camera className="w-4 h-4" /> Ảnh
        </button>
      </div>

      {/* Input */}
      <Card>
        <CardContent className="space-y-3">
          {mode === 'text' ? (
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Paste tin nhắn khách vào đây...\nVD: Chị ơi em lấy #AK01 size M màu đen nha"
              className="w-full h-32 px-3 py-2 text-sm rounded-lg border border-border bg-bg-input text-text placeholder:text-text-muted focus:border-border-focus focus:outline-none resize-none"
            />
          ) : (
            <div className="space-y-2">
              {imageData ? (
                <div className="relative">
                  <img src={imageData} alt="Screenshot" className="w-full rounded-lg border border-border" />
                  <button
                    onClick={() => setImageData(null)}
                    className="absolute top-2 right-2 w-8 h-8 bg-black/60 rounded-full flex items-center justify-center text-white"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div
                  className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => fileRef.current?.click()}
                >
                  <Upload className="w-8 h-8 text-text-muted mx-auto mb-2" />
                  <p className="text-sm text-text-secondary">Upload screenshot inbox FB</p>
                  <p className="text-xs text-text-muted">Auto resize 500px</p>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImage} />
                </div>
              )}
            </div>
          )}

          <Button
            onClick={handleParse}
            disabled={parsing || !apiKey || (mode === 'text' && !input.trim()) || (mode === 'image' && !imageData)}
            className="w-full"
          >
            {parsing
              ? <><Spinner size="sm" /> Đang phân tích...</>
              : <><Sparkles className="w-4 h-4" /> Parse bằng AI</>}
          </Button>
        </CardContent>
      </Card>

      {/* Parsed results — editable */}
      {parsedItems && (
        <Card className="border-primary/20">
          <CardHeader>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Pencil className="w-4 h-4" /> Kết quả parse — sửa nếu cần
              </h3>
              <Button variant="ghost" size="sm" onClick={addParsed}>
                <Plus className="w-4 h-4" /> Thêm
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {parsedItems.map((item, idx) => (
              <div key={idx} className="space-y-2 pb-3 border-b border-border/50 last:border-0 last:pb-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-text-secondary">#{idx + 1}</span>
                  {parsedItems.length > 1 && (
                    <button onClick={() => removeParsed(idx)} className="w-7 h-7 flex items-center justify-center rounded hover:bg-danger/10 text-text-muted hover:text-danger">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <Input label="Tên khách" value={item.name} onChange={e => updateParsed(idx, 'name', e.target.value)} />
                <div className="grid grid-cols-2 gap-2">
                  <Input label="Mã SP" value={item.code} onChange={e => updateParsed(idx, 'code', e.target.value)} />
                  <Input label="Giá (¥)" type="number" value={item.price} onChange={e => updateParsed(idx, 'price', e.target.value)} />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Select label="Size" value={item.size} onChange={e => updateParsed(idx, 'size', e.target.value)}>
                    <option value="">Chọn...</option>
                    {SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                  </Select>
                  <Input label="Màu" value={item.color} onChange={e => updateParsed(idx, 'color', e.target.value)} />
                  <Input label="SL" type="number" min="1" value={item.qty} onChange={e => updateParsed(idx, 'qty', e.target.value)} />
                </div>
                {item.productName && (
                  <p className="text-xs text-text-muted bg-bg-hover px-2 py-1 rounded">{item.productName}</p>
                )}
              </div>
            ))}

            <Button onClick={handleSubmit} disabled={submitting} className="w-full" size="lg">
              {submitting
                ? <><Spinner size="sm" /> Đang tạo...</>
                : <><Send className="w-5 h-5" /> Tạo {parsedItems.length} đơn</>}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

import { useState, useRef, useEffect, useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { Spinner } from '@/components/ui/Loading'
import { useAPI } from '@/hooks/useAPI'
import { getSheetsSummary } from '@/lib/api'
import { cn } from '@/lib/utils'
import {
  MessageSquare, Send, Plus, Trash2, Image, Sparkles, X
} from 'lucide-react'

const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'
const CLAUDE_ENDPOINT = 'https://api.anthropic.com/v1/messages'

const QUICK_BUTTONS = [
  'Hôm nay bán bao nhiêu?',
  'SP hot nhất tháng này?',
  'Khách nợ CK?',
  'Tổng doanh thu tuần?',
  'Đơn quá 14 ngày?',
]

function getChats() {
  try {
    return JSON.parse(localStorage.getItem('ai_chats') || '[]')
  } catch { return [] }
}
function saveChats(chats) {
  localStorage.setItem('ai_chats', JSON.stringify(chats))
}

export default function AIChat() {
  const { data } = useAPI()
  const [chats, setChats] = useState(getChats)
  const [activeChatId, setActiveChatId] = useState(() => chats[0]?.id || null)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [model, setModel] = useState('gemini')
  const [geminiKey, setGeminiKey] = useState(() => localStorage.getItem('gemini_key') || '')
  const [claudeKey, setClaudeKey] = useState(() => localStorage.getItem('claude_key') || '')
  const [showSidebar, setShowSidebar] = useState(false)
  const scrollRef = useRef(null)
  const inputRef = useRef(null)

  const activeChat = chats.find(c => c.id === activeChatId)
  const messages = activeChat?.messages || []

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages.length])

  const updateChats = (newChats) => {
    setChats(newChats)
    saveChats(newChats)
  }

  const newChat = () => {
    const chat = { id: Date.now(), title: 'Chat mới', messages: [] }
    updateChats([chat, ...chats])
    setActiveChatId(chat.id)
    setShowSidebar(false)
  }

  const deleteChat = (id) => {
    const next = chats.filter(c => c.id !== id)
    updateChats(next)
    if (activeChatId === id) setActiveChatId(next[0]?.id || null)
  }

  const sendMessage = async (text) => {
    if (!text?.trim()) return
    const key = model === 'gemini' ? geminiKey : claudeKey
    if (!key) { alert(`Nhập ${model === 'gemini' ? 'Gemini' : 'Claude'} API key`); return }

    // Ensure active chat
    let chatId = activeChatId
    let chatsList = [...chats]
    if (!chatId) {
      const chat = { id: Date.now(), title: text.slice(0, 30), messages: [] }
      chatsList = [chat, ...chatsList]
      chatId = chat.id
      setActiveChatId(chatId)
    }

    // Add user message
    const userMsg = { role: 'user', content: text, ts: Date.now() }
    chatsList = chatsList.map(c =>
      c.id === chatId ? { ...c, messages: [...c.messages, userMsg], title: c.messages.length === 0 ? text.slice(0, 30) : c.title } : c
    )
    updateChats(chatsList)
    setInput('')
    setSending(true)

    try {
      // Get data summary
      let summary = ''
      try {
        const s = await getSheetsSummary()
        summary = typeof s === 'string' ? s : JSON.stringify(s).slice(0, 3000)
      } catch {
        summary = 'Không lấy được data summary.'
      }

      const systemPrompt = `Bạn là trợ lý AI cho Shop MAM — shop bán quần áo nữ cross-border Quảng Châu → Nhật Bản.
Trả lời bằng tiếng Việt, ngắn gọn, có số liệu cụ thể.
Dữ liệu realtime:\n${summary}`

      let reply = ''

      if (model === 'gemini') {
        const history = chatsList.find(c => c.id === chatId).messages.map(m => ({
          role: m.role === 'user' ? 'user' : 'model',
          parts: [{ text: m.content }],
        }))
        const res = await fetch(`${GEMINI_ENDPOINT}?key=${key}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents: history,
            generationConfig: { thinkingConfig: { thinkingBudget: 0 } },
          }),
        })
        const data = await res.json()
        reply = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Lỗi: không có response.'
      } else {
        // Claude
        const history = chatsList.find(c => c.id === chatId).messages.map(m => ({
          role: m.role, content: m.content,
        }))
        const res = await fetch(CLAUDE_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': key,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true',
          },
          body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 1024,
            system: systemPrompt,
            messages: history,
          }),
        })
        const data = await res.json()
        reply = data.content?.[0]?.text || 'Lỗi: không có response.'
      }

      // Add assistant message
      const assistantMsg = { role: 'assistant', content: reply, ts: Date.now() }
      updateChats(chatsList.map(c =>
        c.id === chatId ? { ...c, messages: [...c.messages, assistantMsg] } : c
      ))
    } catch (err) {
      const errMsg = { role: 'assistant', content: `Lỗi: ${err.message}`, ts: Date.now() }
      updateChats(chatsList.map(c =>
        c.id === chatId ? { ...c, messages: [...c.messages, errMsg] } : c
      ))
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    sendMessage(input)
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-primary" /> Trợ lý AI
        </h1>
        <div className="flex gap-2 ml-auto">
          <Select value={model} onChange={e => setModel(e.target.value)} className="w-28 text-xs">
            <option value="gemini">Gemini Flash</option>
            <option value="claude">Claude Haiku</option>
          </Select>
          <Button variant="ghost" size="sm" onClick={() => setShowSidebar(s => !s)}>
            {chats.length} chats
          </Button>
          <Button variant="secondary" size="sm" onClick={newChat}>
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* API key banner */}
      {!geminiKey && !claudeKey && (
        <Card className="mb-3 border-warning/30 bg-warning/5">
          <CardContent className="space-y-2">
            <p className="text-sm text-warning font-medium">Cần API key để chat</p>
            <Input label="Gemini Key" type="password" value={geminiKey}
              onChange={e => { setGeminiKey(e.target.value); localStorage.setItem('gemini_key', e.target.value) }}
              placeholder="AIza..." />
            <Input label="Claude Key" type="password" value={claudeKey}
              onChange={e => { setClaudeKey(e.target.value); localStorage.setItem('claude_key', e.target.value) }}
              placeholder="sk-ant-..." />
          </CardContent>
        </Card>
      )}

      <div className="flex gap-3 flex-1 min-h-0">
        {/* Chat sidebar */}
        {showSidebar && (
          <Card className="w-56 shrink-0 overflow-y-auto">
            <CardContent className="p-1 space-y-0.5">
              {chats.map(c => (
                <div
                  key={c.id}
                  className={cn(
                    'flex items-center gap-1 px-2 py-2 rounded-md text-xs cursor-pointer',
                    c.id === activeChatId ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-bg-hover text-text-secondary'
                  )}
                  onClick={() => { setActiveChatId(c.id); setShowSidebar(false) }}
                >
                  <span className="truncate flex-1">{c.title || 'Chat mới'}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteChat(c.id) }}
                    className="w-5 h-5 flex items-center justify-center rounded hover:bg-danger/10 text-text-muted hover:text-danger shrink-0"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
              {chats.length === 0 && (
                <p className="text-xs text-text-muted text-center py-4">Chưa có chat</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Chat area */}
        <Card className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <Sparkles className="w-10 h-10 text-primary/30 mb-3" />
                <p className="text-sm text-text-muted mb-4">Hỏi AI bất cứ gì về Shop MAM</p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {QUICK_BUTTONS.map(q => (
                    <button
                      key={q}
                      onClick={() => sendMessage(q)}
                      className="text-xs bg-bg-hover hover:bg-border px-3 py-2 rounded-full text-text-secondary transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                <div className={cn(
                  'max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm',
                  msg.role === 'user'
                    ? 'bg-primary text-white rounded-br-sm'
                    : 'bg-bg-hover text-text rounded-bl-sm'
                )}>
                  <div className="whitespace-pre-wrap break-words">{msg.content}</div>
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="bg-bg-hover rounded-xl px-4 py-3 flex items-center gap-2 text-text-muted text-sm">
                  <Spinner size="sm" /> Đang suy nghĩ...
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <form onSubmit={handleSubmit} className="border-t border-border p-3 flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Hỏi AI..."
              className="flex-1 h-11 px-4 text-sm rounded-xl border border-border bg-bg-input focus:border-border-focus focus:outline-none"
              disabled={sending}
            />
            <Button type="submit" disabled={sending || !input.trim()} size="icon" className="shrink-0 w-11 h-11 rounded-xl">
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </Card>
      </div>
    </div>
  )
}

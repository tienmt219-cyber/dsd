import { useState, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Layout } from '@/components/Layout'
import { ToastContainer } from '@/components/ui/Toast'
import { LoadingScreen } from '@/components/ui/Loading'
import { useTheme } from '@/hooks/useTheme'
import { useToast } from '@/hooks/useToast'
import { useAPI } from '@/hooks/useAPI'

// Lazy load pages
const Dashboard = lazy(() => import('@/pages/Dashboard'))
const Orders = lazy(() => import('@/pages/Orders'))
const AddOrder = lazy(() => import('@/pages/AddOrder'))
const Ship = lazy(() => import('@/pages/Ship'))
const GZ = lazy(() => import('@/pages/GZ'))
const EMS = lazy(() => import('@/pages/EMS'))
const Stock = lazy(() => import('@/pages/Stock'))
const Products = lazy(() => import('@/pages/Products'))
const Placeholder = lazy(() => import('@/pages/Placeholder'))

// Simple password gate
function AuthGate({ children }) {
  const [authed, setAuthed] = useState(() => {
    return sessionStorage.getItem('mam_auth') === '1'
  })
  const [pw, setPw] = useState('')
  const [error, setError] = useState(false)

  if (authed) return children

  const handleLogin = (e) => {
    e.preventDefault()
    if (pw === 'dreamteam2026') {
      sessionStorage.setItem('mam_auth', '1')
      setAuthed(true)
    } else {
      setError(true)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg p-4">
      <div className="w-full max-w-sm space-y-6 text-center">
        <div>
          <h1 className="text-2xl font-bold text-primary">Shop MAM</h1>
          <p className="text-sm text-text-secondary mt-1">Dream Team v5.0</p>
        </div>
        <form onSubmit={handleLogin} className="space-y-3">
          <input
            type="password"
            value={pw}
            onChange={e => { setPw(e.target.value); setError(false) }}
            placeholder="Nhập mật khẩu..."
            className="w-full h-12 px-4 text-sm rounded-xl border border-border bg-bg-card text-text placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 text-center"
            autoFocus
          />
          {error && <p className="text-sm text-danger">Sai mật khẩu!</p>}
          <button
            type="submit"
            className="w-full h-12 bg-primary text-white font-medium rounded-xl hover:bg-primary-dark transition-colors"
          >
            Đăng nhập
          </button>
        </form>
      </div>
    </div>
  )
}

function AppContent() {
  const { dark, toggle } = useTheme()
  const { toasts, addToast, removeToast } = useToast()
  const { refresh, loading: refreshing } = useAPI()

  return (
    <BrowserRouter>
      <Layout dark={dark} toggleTheme={toggle} onRefresh={refresh} refreshing={refreshing}>
        <Suspense fallback={<LoadingScreen />}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/orders" element={<Orders />} />
            <Route path="/add-order" element={<AddOrder />} />
            <Route path="/ai-order" element={<Placeholder page="ai-order" />} />
            <Route path="/ai-chat" element={<Placeholder page="ai-chat" />} />
            <Route path="/gz" element={<GZ />} />
            <Route path="/ems" element={<EMS />} />
            <Route path="/ship" element={<Ship />} />
            <Route path="/stock" element={<Stock />} />
            <Route path="/products" element={<Products />} />
            <Route path="/tools" element={<Placeholder page="tools" />} />
            <Route path="/ck" element={<Placeholder page="ck" />} />
          </Routes>
        </Suspense>
      </Layout>
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </BrowserRouter>
  )
}

export default function App() {
  return (
    <AuthGate>
      <AppContent />
    </AuthGate>
  )
}

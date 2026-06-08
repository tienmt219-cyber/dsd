import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { NAV_ITEMS } from '@/lib/constants'
import {
  LayoutDashboard, ClipboardList, PlusCircle, Bot, MessageSquare,
  Factory, Plane, Truck, Package, Tag, Wrench, CreditCard,
  Menu, X, Moon, Sun, RefreshCw
} from 'lucide-react'

const iconMap = {
  LayoutDashboard, ClipboardList, PlusCircle, Bot, MessageSquare,
  Factory, Plane, Truck, Package, Tag, Wrench, CreditCard,
}

export function Layout({ children, dark, toggleTheme, onRefresh, refreshing }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        'fixed lg:static inset-y-0 left-0 z-50 w-64 bg-bg-sidebar border-r border-border',
        'flex flex-col transition-transform duration-200',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      )}>
        {/* Logo */}
        <div className="h-14 flex items-center px-4 border-b border-border shrink-0">
          <span className="text-lg font-bold text-primary">Shop MAM</span>
          <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
            v5.0
          </span>
          <button
            className="ml-auto lg:hidden w-8 h-8 flex items-center justify-center rounded-lg hover:bg-bg-hover"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-2 px-2">
          {NAV_ITEMS.map(item => {
            const Icon = iconMap[item.icon]
            return (
              <NavLink
                key={item.key}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) => cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  'min-h-[44px]',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-text-secondary hover:bg-bg-hover hover:text-text'
                )}
              >
                {Icon && <Icon className="w-5 h-5 shrink-0" />}
                {item.label}
              </NavLink>
            )
          })}
        </nav>

        {/* Bottom actions */}
        <div className="p-2 border-t border-border shrink-0">
          <button
            onClick={toggleTheme}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-text-secondary hover:bg-bg-hover w-full min-h-[44px]"
          >
            {dark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            {dark ? 'Light mode' : 'Dark mode'}
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile header */}
        <header className="h-14 flex items-center px-4 border-b border-border bg-bg-card shrink-0 lg:px-6">
          <button
            className="lg:hidden w-10 h-10 flex items-center justify-center rounded-lg hover:bg-bg-hover -ml-2"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="lg:hidden text-lg font-bold text-primary ml-2">Shop MAM</span>
          <div className="flex-1" />
          <button
            onClick={onRefresh}
            disabled={refreshing}
            className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-bg-hover text-text-secondary"
            title="Refresh data"
          >
            <RefreshCw className={cn('w-5 h-5', refreshing && 'animate-spin')} />
          </button>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </div>
      </main>
    </div>
  )
}

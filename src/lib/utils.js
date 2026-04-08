import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

export function removeAccents(str) {
  if (!str) return ''
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
}

export function formatJPY(amount) {
  if (!amount && amount !== 0) return ''
  return `¥${Number(amount).toLocaleString('ja-JP')}`
}

export function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('ja-JP', { month: '2-digit', day: '2-digit' })
}

export function formatDateFull(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

export function daysSince(dateStr) {
  if (!dateStr) return null
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return null
  const now = new Date()
  return Math.floor((now - d) / (1000 * 60 * 60 * 24))
}

export function getCustomerRank(orderCount) {
  if (orderCount >= 10) return { emoji: '👑', label: 'VIP', color: 'text-yellow-500' }
  if (orderCount >= 5) return { emoji: '⭐', label: 'Quen', color: 'text-blue-500' }
  if (orderCount >= 2) return { emoji: '🔄', label: 'Quay lại', color: 'text-green-500' }
  return { emoji: '🆕', label: 'Mới', color: 'text-gray-500' }
}

export function debounce(fn, delay) {
  let timer
  return (...args) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), delay)
  }
}

export function hasFullAddress(customer) {
  return !!(customer?.postal && customer?.pref && customer?.city && customer?.street)
}

export function parseNotes(notes) {
  if (!notes) return {}
  const result = {}
  const emsMatch = notes.match(/📦EMS\s+(\S+)/)
  if (emsMatch) result.ems = emsMatch[1]
  const ckMatch = notes.match(/💰CK\s+(\S+)/)
  if (ckMatch) result.ckDate = ckMatch[1]
  const sentMatch = notes.match(/📮SENT\s+(\S+)/)
  if (sentMatch) result.sentDate = sentMatch[1]
  if (notes.includes('📦DƯ')) result.isDu = true
  return result
}

import { useState, useEffect, useCallback, useRef } from 'react'
import { getData } from '@/lib/api'

const CACHE_DURATION = 20000
const AUTO_REFRESH_INTERVAL = 60000

let globalCache = null
let globalCacheTime = 0
let globalPromise = null
let globalListeners = new Set()
let refreshPaused = false

function notifyListeners() {
  globalListeners.forEach(fn => fn())
}

export function pauseAutoRefresh() {
  refreshPaused = true
}

export function resumeAutoRefresh() {
  refreshPaused = false
}

export function updateGlobalOrders(updater) {
  if (!globalCache || !globalCache.orders) return
  globalCache = {
    ...globalCache,
    orders: typeof updater === 'function' ? updater(globalCache.orders) : updater,
  }
  globalCacheTime = Date.now()
  notifyListeners()
}

export function syncGlobalData(serverData) {
  if (!serverData) return
  globalCache = serverData
  globalCacheTime = Date.now()
  notifyListeners()
}

export function useAPI() {
  const [data, setData] = useState(globalCache)
  const [loading, setLoading] = useState(!globalCache)
  const [error, setError] = useState(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    const listener = () => {
      if (mountedRef.current) {
        setData(globalCache)
        setLoading(false)
        setError(null)
      }
    }
    globalListeners.add(listener)
    return () => {
      mountedRef.current = false
      globalListeners.delete(listener)
    }
  }, [])

  const fetchData = useCallback(async (force = false) => {
    const now = Date.now()
    if (!force && globalCache && (now - globalCacheTime) < CACHE_DURATION) {
      setData(globalCache)
      setLoading(false)
      return globalCache
    }

    if (globalPromise) return globalPromise

    setLoading(prev => !globalCache ? true : prev)
    setError(null)

    globalPromise = getData()
      .then(result => {
        globalCache = result
        globalCacheTime = Date.now()
        globalPromise = null
        notifyListeners()
        return result
      })
      .catch(err => {
        globalPromise = null
        if (mountedRef.current) {
          setError(err.message)
          setLoading(false)
        }
        throw err
      })

    return globalPromise
  }, [])

  const refresh = useCallback(() => fetchData(true), [fetchData])

  useEffect(() => {
    if (!globalCache) fetchData()
  }, [fetchData])

  useEffect(() => {
    const iv = setInterval(() => {
      if (!refreshPaused) fetchData(true).catch(() => {})
    }, AUTO_REFRESH_INTERVAL)
    return () => clearInterval(iv)
  }, [fetchData])

  const orders = data?.orders || []
  const catalog = data?.catalog || []
  const stock = data?.stock || []
  const surplus = data?.surplus || []
  const addresses = data?.addresses || {}
  const emsHistory = data?.emsHistory || []

  return {
    data,
    orders,
    catalog,
    stock,
    surplus,
    addresses,
    emsHistory,
    loading,
    error,
    refresh,
    fetchData,
  }
}

import { useState, useEffect, useCallback, useRef } from 'react'
import { getData } from '@/lib/api'

const CACHE_DURATION = 20000 // 20 seconds

let globalCache = null
let globalCacheTime = 0
let globalPromise = null
let globalListeners = new Set()

function notifyListeners() {
  globalListeners.forEach(fn => fn())
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

    setLoading(true)
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

  // Derived data helpers — attach _row (1-indexed sheet row, header = row 1)
  const orders = (data?.orders || []).map((o, i) =>
    o._row !== undefined ? o : Object.assign(Array.from(o), { _row: i + 2 })
  )
  const catalog = (data?.catalog || []).map((c, i) =>
    c._row !== undefined ? c : Object.assign(Array.from(c), { _row: i + 2 })
  )
  const customers = (data?.customers || []).map((c, i) =>
    c._row !== undefined ? c : Object.assign(Array.from(c), { _row: i + 2 })
  )
  const stock = data?.stock || []
  const surplus = (data?.surplus || []).map((s, i) =>
    s._row !== undefined ? s : Object.assign(Array.from(s), { _row: i + 2 })
  )

  return {
    data,
    orders,
    catalog,
    customers,
    stock,
    surplus,
    loading,
    error,
    refresh,
    fetchData,
  }
}

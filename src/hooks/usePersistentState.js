import { useEffect, useRef, useState } from 'react'

const isBrowser = typeof window !== 'undefined'

const safeParse = (value, fallback) => {
  if (!value || typeof value !== 'string') return fallback
  try {
    return JSON.parse(value)
  } catch (error) {
    return fallback
  }
}

export function usePersistentState(key, defaultValue) {
  const initialized = useRef(false)
  const [state, setState] = useState(() => {
    if (!isBrowser) return defaultValue
    const stored = window.localStorage.getItem(key)
    if (stored === null || typeof stored === 'undefined') {
      return defaultValue
    }
    return safeParse(stored, defaultValue)
  })

  useEffect(() => {
    if (!isBrowser) return
    if (!initialized.current) {
      initialized.current = true
      return
    }
    try {
      window.localStorage.setItem(key, JSON.stringify(state))
    } catch (error) {
      console.warn('[usePersistentState] Failed to persist', key, error)
    }
  }, [key, state])

  return [state, setState]
}

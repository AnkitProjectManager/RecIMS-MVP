import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { format } from "date-fns"

export function cn(...inputs) {
  return twMerge(clsx(inputs))
} 

export function safeFormatDate(value, dateFormat = 'MMM dd, yyyy', fallback = '-') {
  if (!value) {
    return fallback
  }

  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) {
    return fallback
  }

  try {
    return format(date, dateFormat)
  } catch (error) {
    console.warn('[utils] Failed to format date', error)
    return fallback
  }
}

const usdFormatterCache = new Map()

export function formatUSD(value, options = {}) {
  const amount = Number.isFinite(Number(value)) ? Number(value) : 0
  const {
    minimumFractionDigits,
    maximumFractionDigits,
    notation,
    compactDisplay,
  } = options

  const normalizedMin = typeof minimumFractionDigits === 'number' && minimumFractionDigits >= 0
    ? Math.floor(minimumFractionDigits)
    : 0
  const normalizedMax = typeof maximumFractionDigits === 'number' && maximumFractionDigits >= normalizedMin
    ? Math.floor(maximumFractionDigits)
    : normalizedMin

  const cacheKey = JSON.stringify({ normalizedMin, normalizedMax, notation, compactDisplay })
  let formatter = usdFormatterCache.get(cacheKey)
  if (!formatter) {
    formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: normalizedMin,
      maximumFractionDigits: normalizedMax,
      notation,
      compactDisplay,
    })
    usdFormatterCache.set(cacheKey, formatter)
  }

  return formatter.format(amount)
}
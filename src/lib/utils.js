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
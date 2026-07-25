import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Joins class names and resolves Tailwind conflicts so the LAST class wins.
 *
 * Plain string concatenation doesn't do that: `"p-6" + " p-2"` leaves both
 * in the class list and the winner is decided by stylesheet order, not by
 * the caller — which silently breaks every component that accepts a
 * `className` override. twMerge drops the earlier of any conflicting pair.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

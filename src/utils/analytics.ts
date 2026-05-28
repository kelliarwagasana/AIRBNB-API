export interface MonthBucket {
  month: string
  label: string
  value: number
}

/** January through December for the given calendar year (defaults to current year). */
export function getCalendarYearMonthBuckets(year = new Date().getFullYear()): { key: string; label: string }[] {
  const buckets: { key: string; label: string }[] = []

  for (let month = 0; month < 12; month++) {
    const d = new Date(year, month, 1)
    const key = `${year}-${String(month + 1).padStart(2, '0')}`
    const label = d.toLocaleString('en-US', { month: 'short' })
    buckets.push({ key, label })
  }

  return buckets
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export function countByMonth(dates: Date[], buckets: { key: string; label: string }[]): MonthBucket[] {
  const counts = new Map(buckets.map((b) => [b.key, 0]))

  for (const date of dates) {
    const key = monthKey(date)
    if (counts.has(key)) {
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
  }

  return buckets.map((b) => ({ month: b.key, label: b.label, value: counts.get(b.key) ?? 0 }))
}

export function sumByMonth(
  entries: { date: Date; amount: number }[],
  buckets: { key: string; label: string }[],
): MonthBucket[] {
  const totals = new Map(buckets.map((b) => [b.key, 0]))

  for (const { date, amount } of entries) {
    const key = monthKey(date)
    if (totals.has(key)) {
      totals.set(key, (totals.get(key) ?? 0) + amount)
    }
  }

  return buckets.map((b) => ({
    month: b.key,
    label: b.label,
    value: Math.round((totals.get(b.key) ?? 0) * 100) / 100,
  }))
}

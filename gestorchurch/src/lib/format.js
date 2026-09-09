const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

const dateFormatter = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' })

const monthFormatter = new Intl.DateTimeFormat('pt-BR', { month: 'short', timeZone: 'UTC' })

export function formatCurrency(value) {
  const amount = Number(value)
  return currencyFormatter.format(Number.isFinite(amount) ? amount : 0)
}

export function parseDateOnly(isoLike) {
  if (!isoLike) return null
  const [year, month, day] = String(isoLike).slice(0, 10).split('-').map(Number)
  if (!year || !month || !day) return null
  return new Date(Date.UTC(year, month - 1, day))
}

export function formatDate(isoLike) {
  const date = parseDateOnly(isoLike)
  if (!date) return '—'
  return dateFormatter.format(date)
}

export function formatMonthLabel(isoLike) {
  const date = parseDateOnly(isoLike)
  if (!date) return '—'
  const label = monthFormatter.format(date)
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

export function monthKey(isoLike) {
  return String(isoLike || '').slice(0, 7)
}

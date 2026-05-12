export function formatNumber(value: number, digits = 0) {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value)
}

export function formatCompact(value: number) {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 2,
  }).format(value)
}

export function formatPercent(value: number) {
  return `${formatNumber(value, 1)}%`
}

export function shortAddress(value: string) {
  if (value.length <= 14) return value
  return `${value.slice(0, 6)}...${value.slice(-4)}`
}

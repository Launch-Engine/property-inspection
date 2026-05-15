// Parses YYYY-MM-DD or any ISO 8601 timestamp and returns MM/DD/YYYY. Falls
// back to the input string when the date can't be parsed.
export function formatUsDate(input: string | undefined | null): string {
  if (!input) return '—'

  let year: number
  let month: number
  let day: number

  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input)
  if (dateOnly) {
    year = Number(dateOnly[1])
    month = Number(dateOnly[2])
    day = Number(dateOnly[3])
  } else {
    const parsed = new Date(input)
    if (Number.isNaN(parsed.getTime())) return input
    year = parsed.getFullYear()
    month = parsed.getMonth() + 1
    day = parsed.getDate()
  }

  return `${pad(month)}/${pad(day)}/${year}`
}

export function formatUsDateTime(input: string | undefined | null): string {
  if (!input) return '—'
  const parsed = new Date(input)
  if (Number.isNaN(parsed.getTime())) return input
  const date = formatUsDate(parsed.toISOString())
  const hours = pad(parsed.getHours())
  const minutes = pad(parsed.getMinutes())
  return `${date} ${hours}:${minutes}`
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

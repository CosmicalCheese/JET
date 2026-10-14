/* ─── Prefijos SI: 4700 Ω ↔ "4.7 kΩ" ─── */

const PREFIXES: [number, string][] = [
  [1e9, 'G'],
  [1e6, 'M'],
  [1e3, 'k'],
  [1, ''],
  [1e-3, 'm'],
  [1e-6, 'µ'],
  [1e-9, 'n'],
  [1e-12, 'p'],
]

/** 0.004, 'A' → "4 mA". Tres cifras significativas, sin ceros de sobra. */
export function formatSI(value: number, unit: string, digits = 3): string {
  if (!Number.isFinite(value)) return `— ${unit}`
  const abs = Math.abs(value)
  if (abs < 1e-12) return `0 ${unit}`
  const [factor, prefix] = PREFIXES.find(([f]) => abs >= f * 0.9995) ?? PREFIXES[PREFIXES.length - 1]
  const scaled = Number((value / factor).toPrecision(digits))
  return `${scaled} ${prefix}${unit}`
}

const PARSE_PREFIX: Record<string, number> = {
  G: 1e9, M: 1e6, meg: 1e6, k: 1e3, K: 1e3, m: 1e-3, u: 1e-6, µ: 1e-6, μ: 1e-6, n: 1e-9, p: 1e-12,
}

/**
 * "4.7k" → 4700, "100 mA" → 0.1, "2,2 MΩ" → 2.2e6.
 * La unidad final (Ω, ohm, V, A…) se ignora. Devuelve null si no se entiende.
 */
export function parseSI(text: string): number | null {
  const m = text
    .trim()
    .replace(',', '.')
    .match(/^([-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?)\s*(meg|[GMkKmuµμnp])?\s*(?:Ω|[oO]hms?|[VvAaWw])?$/)
  if (!m) return null
  const value = Number(m[1]) * (m[2] ? PARSE_PREFIX[m[2]] : 1)
  // toPrecision quita el ruido de punto flotante (10 · 1e-6 = 9.999…e-6)
  return Number.isFinite(value) ? Number(value.toPrecision(12)) : null
}

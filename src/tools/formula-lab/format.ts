/* ─── Number → LaTeX formatting for Formula Lab ─── */

// Redondeo con notación exponencial para evitar errores de punto flotante
// (1.185 * 100 = 118.4999… en JS)
export function round(x: number, dec: number): number {
  return Number(Math.round(Number(x + 'e' + dec)) + 'e-' + dec)
}

/** Número en LaTeX: decimales recortados, notación científica si es muy grande o muy pequeño */
export function fmt(x: number, dec = 4): string {
  if (Number.isNaN(x)) return '\\text{indefinido}'
  if (!Number.isFinite(x)) return x > 0 ? '\\infty' : '-\\infty'
  if (x === 0) return '0'
  const abs = Math.abs(x)
  if (abs >= 1e6 || abs < 1e-4) {
    const exp = Math.floor(Math.log10(abs))
    let mant = round(x / 10 ** exp, 3)
    let e = exp
    if (Math.abs(mant) >= 10) { mant = round(mant / 10, 3); e += 1 }
    return `${mant}\\times10^{${e}}`
  }
  const r = round(x, dec)
  return r === 0 ? '0' : String(r)
}

/** Como fmt, pero entre paréntesis si es negativo (para sustituciones) */
export function fp(x: number, dec = 4): string {
  return x < 0 ? `\\left(${fmt(x, dec)}\\right)` : fmt(x, dec)
}

/** Número en texto plano (para usar dentro de oraciones) */
export function txt(x: number, dec = 4): string {
  return `$${fmt(x, dec)}$`
}

export function pct(p: number, dec = 2): string {
  return `${fmt(p * 100, dec)}\\%`
}

export const toRad = (deg: number) => (deg * Math.PI) / 180
export const toDeg = (rad: number) => (rad * 180) / Math.PI

/** Vector como ⟨a, b, c⟩ */
export function fvec(v: number[]): string {
  return `\\langle ${v.map(c => fmt(c)).join(',\\ ')} \\rangle`
}

export function sum(arr: number[]): number {
  return arr.reduce((s, v) => s + v, 0)
}

export function factorial(n: number): number {
  let r = 1
  for (let i = 2; i <= n; i++) r *= i
  return r
}

/** nCr sin desbordar para n grandes */
export function comb(n: number, k: number): number {
  if (k < 0 || k > n) return 0
  k = Math.min(k, n - k)
  let r = 1
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i
  return Math.round(r)
}

/** Φ(z): área acumulada de la normal estándar (Abramowitz & Stegun 7.1.26) */
export function normalCDF(z: number): number {
  const sign = z < 0 ? -1 : 1
  const x = Math.abs(z) / Math.SQRT2
  const t = 1 / (1 + 0.3275911 * x)
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x)
  return 0.5 * (1 + sign * y)
}

/** Inversa de Φ por bisección: z tal que Φ(z) = p */
export function normalInv(p: number): number {
  let lo = -10, hi = 10
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2
    if (normalCDF(mid) < p) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

/** Guarda un valor con el formato de useLocalStorage para precargar otra herramienta */
export function writeStored(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify({ value, savedAt: Date.now() }))
  } catch { /* storage lleno o bloqueado */ }
}

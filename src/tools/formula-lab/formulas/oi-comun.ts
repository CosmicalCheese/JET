import { fail, type PlotTone, type VisualSpec } from '../types'

export const L = String.raw

const TONES: PlotTone[] = ['a', 'b', 'accent', 'warn', 'muted']
export const toneAt = (i: number) => TONES[i % TONES.length]

/** Gráfica de barras con el plano genérico (admite barras negativas) */
export function barsSpec(
  values: number[],
  labels: string[],
  opts: { highlight?: number[]; line?: { y: number; label: string }; caption?: string; format?: (x: number) => string } = {},
): VisualSpec {
  const fmtv = opts.format ?? ((x: number) => `${Math.round(x * 1e4) / 1e4}`)
  const n = values.length
  const top = Math.max(0, ...values, opts.line?.y ?? 0), bottom = Math.min(0, ...values, opts.line?.y ?? 0)
  const pad = (top - bottom || 1) * 0.18
  return {
    type: 'plot',
    areas: values.map((h, i) => ({
      upper: [[i + 1 - 0.3, Math.max(h, 0)], [i + 1 + 0.3, Math.max(h, 0)]] as [number, number][],
      lower: [[i + 1 - 0.3, Math.min(h, 0)], [i + 1 + 0.3, Math.min(h, 0)]] as [number, number][],
      tone: opts.highlight?.includes(i) ? 'warn' : 'a',
    })),
    segments: opts.line ? [{ from: [0.4, opts.line.y], to: [n + 0.6, opts.line.y], tone: 'accent', dashed: true, label: opts.line.label }] : [],
    marks: values.map((h, i) => ({ x: i + 1, y: h, tone: opts.highlight?.includes(i) ? 'warn' as const : 'a' as const, label: `${labels[i]}: ${fmtv(h)}` })),
    xRange: [0.4, n + 0.6],
    yRange: [bottom - (bottom < 0 ? pad : 0), top + pad],
    hideXTicks: true,
    caption: opts.caption,
  }
}

/** Resuelve A·x = b con eliminación gaussiana y pivoteo parcial; null si es singular */
export function solveLinear(A: number[][], b: number[]): number[] | null {
  const n = b.length
  const M = A.map((row, i) => [...row, b[i]])
  for (let c = 0; c < n; c++) {
    let p = c
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r
    if (Math.abs(M[p][c]) < 1e-12) return null
    ;[M[c], M[p]] = [M[p], M[c]]
    for (let r = 0; r < n; r++) {
      if (r === c) continue
      const f = M[r][c] / M[c][c]
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]
    }
  }
  return M.map((row, i) => row[n] / row[i])
}

/** Matriz cuadrada n×n a partir de una lista en orden de renglones */
export function squareMatrix(list: number[], name: string, min = 2, max = 8): number[][] {
  const n = Math.round(Math.sqrt(list.length))
  if (n * n !== list.length || n < min || n > max) {
    fail(`“${name}” debe tener n×n números (por renglones) con n entre ${min} y ${max}: por ejemplo 4 números para 2×2, 9 para 3×3. Escribiste ${list.length}.`)
  }
  return Array.from({ length: n }, (_, i) => list.slice(i * n, (i + 1) * n))
}

/** Código LaTeX de una matriz con nombres de renglones y columnas opcionales */
export function matrixTex(M: number[][], f: (x: number) => string, rowNames?: string[], colNames?: string[]): string {
  const n = M[0].length
  const head = colNames ? `${rowNames ? '&' : ''}${colNames.join('&')}${L`\\`}` : ''
  const body = M.map((r, i) => `${rowNames ? `${rowNames[i]}&` : ''}${r.map(f).join('&')}`).join(L`\\`)
  const cols = `${rowNames ? 'c|' : ''}${'r'.repeat(n)}`
  return L`\begin{array}{${cols}}${head}${body}\end{array}`
}

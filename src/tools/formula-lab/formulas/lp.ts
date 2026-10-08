/* ─── Programación lineal con dos variables ───
 *
 * Todo se normaliza a la forma  máx c·x  sujeto a  a₁x₁ + a₂x₂ ≤ b,  x ≥ 0.
 * Un problema de minimizar con restricciones ≥ es lo mismo cambiando el signo
 * de todo, así que el motor sólo conoce una forma.
 */

import { fail, type PlotCurve, type PlotMark, type PlotSegment, type Values, type VisualSpec } from '../types'
import { fmt } from '../format'

export const L = String.raw

/** a₁x₁ + a₂x₂ ≤ b */
export type Row = [number, number, number]
export type Pt = [number, number]

/** op: −1 = ≤, 0 = =, 1 = ≥ */
export type Op = -1 | 0 | 1
export interface LPRow { a1: number; a2: number; b: number; op: Op; /** número que el usuario le puso (1, 2, 3) */ i: number }
export interface LPProblem { sense: 'max' | 'min'; c: Pt; rows: LPRow[] }

export interface LPVertex { name: string; x: Pt; z: number }
export interface LPSolution {
  verts: LPVertex[]
  /** índices (en verts) de los vértices óptimos; más de uno = óptimos alternativos */
  best: number[]
  zStar: number
  /** intersecciones de pares de rectas y cuántas resultaron factibles */
  pairs: number
}

const clean = (x: number) => (Math.abs(x) < 1e-10 ? 0 : x)

// ─── Texto ───────────────────────────────────────────────────────────────────

/** a₁x₁ + a₂x₂ en LaTeX, sin términos nulos ni coeficientes 1 */
export function lin2(a1: number, a2: number): string {
  const terms: string[] = []
  ;[a1, a2].forEach((a, i) => {
    if (a === 0) return
    const mag = Math.abs(a) === 1 ? '' : fmt(Math.abs(a))
    terms.push(`${a < 0 ? '-' : terms.length ? '+' : ''}${mag}x_${i + 1}`)
  })
  return terms.length ? terms.join('') : '0'
}

export const opTex = (op: Op) => (op === -1 ? L`\le` : op === 0 ? '=' : L`\ge`)
export const rowTex = (r: LPRow) => `${lin2(r.a1, r.a2)}${opTex(r.op)}${fmt(r.b)}`

export function problemTex(p: LPProblem): string {
  const rows = [...p.rows.map(r => rowTex(r)), L`x_1,x_2\ge0`]
  return L`${'\\' + p.sense}\ Z=${lin2(p.c[0], p.c[1])}\quad\text{s.a.}\quad\begin{cases}${rows.join(L`\\`)}\end{cases}`
}

// ─── Lectura de entradas ─────────────────────────────────────────────────────

export const senseSelect = (id: string, def: 1 | -1) => ({
  kind: 'select' as const,
  id,
  label: 'Objetivo',
  symbol: 'Z',
  default: def,
  options: [{ value: 1, label: 'Maximizar' }, { value: -1, label: 'Minimizar' }],
})

/** Tabla de restricciones con dos variables: ⟨a₁, a₂⟩ sentido  lado derecho */
export const lpMatrixInput = (id: string, rows: number[][]) => ({
  kind: 'matrix' as const,
  id,
  label: 'Restricciones',
  symbol: 'R',
  default: rows,
  rowPrefix: 'R',
  colPrefix: 'x',
  corner: '',
  senseCol: true,
  lastCol: 'Lado derecho',
  fixedCols: true,
  minRows: 1,
  maxRows: 8,
})

export const lpInputs = (prefix: string, sense: 1 | -1, c: number[], rows: number[][]) => [
  senseSelect(`${prefix}.sense`, sense),
  { kind: 'vector' as const, id: `${prefix}.c`, label: 'Función objetivo: ⟨c₁, c₂⟩', symbol: 'Z', default: c, fixedDims: 2 },
  lpMatrixInput(`${prefix}.rows`, rows),
]

export function readLP(v: Values, prefix: string): LPProblem {
  const c = v[`${prefix}.c`] as number[]
  const sense = (v[`${prefix}.sense`] as number) === -1 ? 'min' : 'max'
  const table = v[`${prefix}.rows`] as number[][]
  const rows: LPRow[] = []
  table.forEach((r, k) => {
    const [a1, a2, op, b] = r
    if (a1 === 0 && a2 === 0) {
      if (b === 0) return // renglón de ceros = restricción sin usar
      fail(`La restricción R${k + 1} no tiene variables. Si no la quieres usar, déjala en ceros o quítala.`)
    }
    rows.push({ a1, a2, b, op: (op === 0 ? 0 : op < 0 ? -1 : 1) as Op, i: k + 1 })
  })
  return { sense, c: [c[0], c[1]], rows }
}

/** Forma normal: todo ≤ (un = son dos desigualdades), más x₁ ≥ 0 y x₂ ≥ 0 */
export function normRows(p: LPProblem): Row[] {
  const out: Row[] = []
  for (const r of p.rows) {
    if (r.op <= 0) out.push([r.a1, r.a2, r.b])
    if (r.op >= 0) out.push([-r.a1, -r.a2, -r.b])
  }
  return [...out, [-1, 0, 0], [0, -1, 0]]
}

export const normObjective = (p: LPProblem): Pt => (p.sense === 'max' ? p.c : [-p.c[0], -p.c[1]])
export const objective = (p: LPProblem, x: Pt) => clean(p.c[0] * x[0] + p.c[1] * x[1])

// ─── Geometría ───────────────────────────────────────────────────────────────

const feasible = (rows: Row[], x: number, y: number) =>
  rows.every(([a1, a2, b]) => a1 * x + a2 * y <= b + 1e-9 * Math.max(1, Math.abs(b), Math.abs(a1 * x), Math.abs(a2 * y)))

function corners(rows: Row[]): { pts: Pt[]; pairs: number } {
  const pts: Pt[] = []
  let pairs = 0
  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      const [a1, a2, c1] = rows[i], [b1, b2, c2] = rows[j]
      const det = a1 * b2 - a2 * b1
      if (Math.abs(det) < 1e-12) continue
      pairs++
      const x = clean((c1 * b2 - a2 * c2) / det), y = clean((a1 * c2 - c1 * b1) / det)
      if (!feasible(rows, x, y)) continue
      if (pts.some(([px, py]) => Math.hypot(px - x, py - y) < 1e-9 * Math.max(1, Math.abs(x), Math.abs(y)))) continue
      pts.push([x, y])
    }
  }
  return { pts, pairs }
}

/** ¿Hay una dirección factible en la que Z mejora sin parar? */
function improvesForever(rows: Row[], cm: Pt): boolean {
  for (const [a1, a2] of rows) {
    for (const s of [1, -1]) {
      const len = Math.hypot(a1, a2)
      const d: Pt = [(-s * a2) / len, (s * a1) / len]
      if (rows.every(([r1, r2]) => r1 * d[0] + r2 * d[1] <= 1e-9) && cm[0] * d[0] + cm[1] * d[1] > 1e-9) return true
    }
  }
  return false
}

export function solveLP(p: LPProblem): LPSolution {
  const rows = normRows(p), cm = normObjective(p)
  const { pts, pairs } = corners(rows)
  if (pts.length === 0) {
    fail('Las restricciones se contradicen: no existe ningún punto que las cumpla todas (la región factible está vacía). Revisa los signos y los lados derechos.')
  }
  if (improvesForever(rows, cm)) {
    fail(p.sense === 'max'
      ? 'La región factible no tiene límite en la dirección en que $Z$ crece: puedes hacer $Z$ tan grande como quieras, así que **no hay máximo**. En un problema real falta una restricción.'
      : 'La región factible no tiene límite en la dirección en que $Z$ decrece: puedes hacer $Z$ tan pequeño como quieras, así que **no hay mínimo**. En un problema real falta una restricción.')
  }
  // los nombramos A, B, C… en orden antihorario para que coincidan con la gráfica
  const cx = pts.reduce((s, q) => s + q[0], 0) / pts.length, cy = pts.reduce((s, q) => s + q[1], 0) / pts.length
  const ordered = [...pts].sort((a, b) => Math.atan2(a[1] - cy, a[0] - cx) - Math.atan2(b[1] - cy, b[0] - cx))
  const start = ordered.findIndex(q => q[0] === 0 && q[1] === 0)
  const rotated = start > 0 ? [...ordered.slice(start), ...ordered.slice(0, start)] : ordered
  const verts = rotated.map((x, k) => ({ name: String.fromCharCode(65 + k), x, z: objective(p, x) }))
  const zStar = p.sense === 'max' ? Math.max(...verts.map(q => q.z)) : Math.min(...verts.map(q => q.z))
  const best = verts.flatMap((q, k) => (Math.abs(q.z - zStar) <= 1e-9 * Math.max(1, Math.abs(zStar)) ? [k] : []))
  return { verts, best, zStar, pairs }
}

/** Recorta un polígono con el semiplano a₁x + a₂y ≤ b (Sutherland–Hodgman) */
function clipPoly(poly: Pt[], [a1, a2, b]: Row): Pt[] {
  const f = (q: Pt) => a1 * q[0] + a2 * q[1] - b
  const out: Pt[] = []
  poly.forEach((cur, i) => {
    const prev = poly[(i + poly.length - 1) % poly.length]
    const fc = f(cur), fp = f(prev)
    if ((fc <= 0) !== (fp <= 0)) {
      const t = fp / (fp - fc)
      out.push([prev[0] + t * (cur[0] - prev[0]), prev[1] + t * (cur[1] - prev[1])])
    }
    if (fc <= 0) out.push(cur)
  })
  return out
}

/** Los dos extremos de la recta a₁x + a₂y = b dentro del rectángulo [0, X] × [0, Y] */
function clipLine([a1, a2, b]: Row, X: number, Y: number): [Pt, Pt] | null {
  const pts: Pt[] = []
  const add = (x: number, y: number) => {
    if (x < -1e-9 || x > X + 1e-9 || y < -1e-9 || y > Y + 1e-9) return
    if (!pts.some(q => Math.hypot(q[0] - x, q[1] - y) < 1e-9)) pts.push([x, y])
  }
  if (Math.abs(a2) > 1e-12) { add(0, b / a2); add(X, (b - a1 * X) / a2) }
  if (Math.abs(a1) > 1e-12) { add(b / a1, 0); add((b - a2 * Y) / a1, Y) }
  return pts.length >= 2 ? [pts[0], pts[pts.length - 1]] : null
}

const TONES = ['a', 'b', 'accent'] as const

/** Región factible, rectas, vértices y recta de Z; `path` dibuja el recorrido del símplex */
export function lpScene(p: LPProblem, sol: LPSolution, path?: { x: Pt; z: number }[], caption?: string): VisualSpec {
  const pts: Pt[] = [...sol.verts.map(q => q.x), ...(path ?? []).map(q => q.x)]
  const X = Math.max(1, ...pts.map(q => q[0])) * 1.35
  const Y = Math.max(1, ...pts.map(q => q[1])) * 1.35
  const rows = normRows(p)
  let poly: Pt[] = [[0, 0], [X, 0], [X, Y], [0, Y]]
  for (const r of rows) poly = clipPoly(poly, r)

  const curves: PlotCurve[] = p.rows.flatMap((r, k) => {
    const seg = clipLine([r.a1, r.a2, r.b], X, Y)
    return seg ? [{ points: seg, tone: TONES[k % 3], label: rowTex(r) }] : []
  })
  const cm = p.c
  const z = sol.zStar
  const zLine = cm[0] === 0 && cm[1] === 0 ? null : clipLine([cm[0], cm[1], z], X, Y)
  if (zLine) curves.push({ points: zLine, tone: 'warn', label: `Z=${fmt(z)}`, dashed: true })

  const marks: PlotMark[] = path
    ? path.map((q, k) => ({ x: q.x[0], y: q.x[1], tone: k === path.length - 1 ? 'warn' : 'accent', label: k === 0 ? 'inicio' : `${k}` }))
    : sol.verts.map((q, k) => ({
      x: q.x[0],
      y: q.x[1],
      tone: sol.best.includes(k) ? 'warn' : 'a',
      label: `${q.name} (${fmt(q.x[0], 3)}, ${fmt(q.x[1], 3)})`,
    }))
  const segments: PlotSegment[] = path
    ? path.slice(1).map((q, k) => ({ from: path[k].x, to: q.x, tone: 'accent' }))
    : []

  return {
    type: 'plot',
    curves,
    polygons: [{ points: poly, tone: 'b' }],
    segments,
    marks,
    xRange: [-X * 0.05, X],
    yRange: [-Y * 0.07, Y],
    caption,
  }
}

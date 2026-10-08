/* ─── Símplex de dos fases para cualquier tamaño ───
 *
 * Maximiza o minimiza c·x sujeto a restricciones ≤, = o ≥ con x ≥ 0.
 *  - Lados derechos negativos se multiplican por −1.
 *  - Fase I busca una solución factible con variables artificiales R.
 *  - Fase II optimiza la función objetivo real.
 * La tabla usa la convención  Z − c·x = 0  (renglón Z con −c_j): es óptima cuando
 * todos los números del renglón Z son ≥ 0.
 */

import { fail } from '../types'
import { solveLinear } from './oi-comun'

export type Op = -1 | 0 | 1
export interface SCon { a: number[]; op: Op; b: number }

export interface Snap {
  phase: 1 | 2
  T: number[][]
  basis: number[]
  names: string[]
  enter: number
  leave: number
  ratios: (number | null)[]
  /** valor de las variables de decisión en este punto */
  x: number[]
}

export interface StdRow { a: number[]; op: Op; b: number; flipped: boolean; extra: string | null; art: string | null; orig: number }

export interface SimplexSol {
  n: number
  sense: 'max' | 'min'
  x: number[]
  Z: number
  snaps: Snap[]
  std: StdRow[]
  /** holgura o exceso de cada restricción original (0 si se cumple con igualdad) */
  slack: number[]
  /** precio sombra: cuánto cambia Z por cada unidad más del lado derecho */
  duals: number[]
  /** intervalo del lado derecho en el que el precio sombra sigue valiendo */
  rhsRange: [number, number][]
  /** cuánto empeora Z por cada unidad que se obligue a entrar a una variable no básica */
  reduced: number[]
  alt: boolean
  degenerate: boolean
  phase1: boolean
  /** restricciones redundantes (1, 2, …) eliminadas al terminar la fase I */
  redundant: number[]
}

const EPS = 1e-9
const copy = (T: number[][]) => T.map(r => [...r])

function pivot(T: number[][], row: number, col: number) {
  const p = T[row][col]
  T[row] = T[row].map(v => v / p)
  for (let i = 0; i < T.length; i++) {
    if (i === row) continue
    const f = T[i][col]
    if (f !== 0) T[i] = T[i].map((v, j) => v - f * T[row][j])
  }
}

function iterate(
  T: number[][], basis: number[], names: string[], phase: 1 | 2, snaps: Snap[], canEnter: (j: number) => boolean, n: number,
): 'optimal' | 'unbounded' | 'cycle' {
  const cols = T[0].length - 1
  const xOf = () => Array.from({ length: n }, (_, j) => { const r = basis.indexOf(j); return r < 0 ? 0 : T[r + 1][cols] })
  for (let it = 0; it < 200; it++) {
    let enter = -1, low = -EPS
    for (let j = 0; j < cols; j++) if (canEnter(j) && T[0][j] < low) { low = T[0][j]; enter = j }
    if (enter < 0) {
      snaps.push({ phase, T: copy(T), basis: [...basis], names, enter: -1, leave: -1, ratios: [], x: xOf() })
      return 'optimal'
    }
    const ratios = T.slice(1).map(r => (r[enter] > EPS ? r[cols] / r[enter] : null))
    let leave = -1
    ratios.forEach((q, i) => {
      if (q === null) return
      const cur = leave < 0 ? null : (ratios[leave - 1] as number)
      if (cur === null || q < cur - EPS || (Math.abs(q - cur) <= EPS && basis[i] < basis[leave - 1])) leave = i + 1
    })
    snaps.push({ phase, T: copy(T), basis: [...basis], names, enter, leave, ratios, x: xOf() })
    if (leave < 0) return 'unbounded'
    pivot(T, leave, enter)
    basis[leave - 1] = enter
  }
  return 'cycle'
}

export function solveSimplex(sense: 'max' | 'min', c: number[], cons: SCon[]): SimplexSol {
  const n = c.length, m = cons.length
  const s = sense === 'max' ? 1 : -1

  // ── forma estándar ──
  const rows = cons.map((k, i) => {
    const f = k.b < 0 ? -1 : 1
    return { a: k.a.map(v => f * v), b: f * k.b, op: (f === -1 ? -k.op : k.op) as Op, f, orig: i }
  })
  const names: string[] = c.map((_, j) => `x_{${j + 1}}`)
  const extraCol: (number | null)[] = rows.map(() => null)
  const artCol: (number | null)[] = rows.map(() => null)
  rows.forEach((r, i) => { if (r.op !== 0) { extraCol[i] = names.length; names.push(r.op === -1 ? `s_{${i + 1}}` : `e_{${i + 1}}`) } })
  rows.forEach((r, i) => { if (r.op !== -1) { artCol[i] = names.length; names.push(`R_{${i + 1}}`) } })
  const N = names.length
  const isArt = (j: number) => names[j].startsWith('R_')
  const A = rows.map((r, i) => {
    const row = new Array(N).fill(0)
    r.a.forEach((v, j) => { row[j] = v })
    if (extraCol[i] !== null) row[extraCol[i]!] = r.op === -1 ? 1 : -1
    if (artCol[i] !== null) row[artCol[i]!] = 1
    return row
  })
  const std: StdRow[] = rows.map((r, i) => ({ a: r.a, op: r.op, b: r.b, flipped: r.f === -1, extra: extraCol[i] === null ? null : names[extraCol[i]!], art: artCol[i] === null ? null : names[artCol[i]!], orig: i }))
  const hasArt = rows.some(r => r.op !== -1)

  let T: number[][] = [[...new Array(N).fill(0), 0], ...rows.map((r, i) => [...A[i], r.b])]
  let basis = rows.map((r, i) => (r.op === -1 ? extraCol[i]! : artCol[i]!))
  const rowOrig = rows.map((_, i) => i)
  const snaps: Snap[] = []
  const redundant: number[] = []
  let names2 = names

  // ── fase I ──
  if (hasArt) {
    for (let j = 0; j < N; j++) if (isArt(j)) T[0][j] = 1
    basis.forEach((b, r) => { if (isArt(b)) T[0] = T[0].map((v, j) => v - T[r + 1][j]) })
    const st = iterate(T, basis, names, 1, snaps, j => !isArt(j), n)
    if (st === 'cycle') fail('El método no terminó (posible ciclo por degeneración). Cambia ligeramente los datos.')
    const w = -T[0][N]
    if (w > 1e-7 * (1 + rows.reduce((t, r) => t + Math.abs(r.b), 0))) {
      fail(`**No hay solución factible**: la Fase I terminó con las variables artificiales sumando ${Math.round(w * 1e6) / 1e6} > 0, así que las restricciones se contradicen. Revisa los signos y los lados derechos.`)
    }
    // artificiales que quedaron en la base con valor 0: sacarlas (o quitar el renglón si es redundante)
    for (let r = T.length - 1; r >= 1; r--) {
      if (!isArt(basis[r - 1])) continue
      const col = names.findIndex((_, j) => !isArt(j) && Math.abs(T[r][j]) > EPS)
      if (col >= 0) { pivot(T, r, col); basis[r - 1] = col } else {
        redundant.push(rowOrig[r - 1] + 1)
        T.splice(r, 1); basis.splice(r - 1, 1); rowOrig.splice(r - 1, 1)
      }
    }
    // quitar las columnas artificiales
    const keep = names.map((_, j) => j).filter(j => !isArt(j))
    const remap = new Map(keep.map((j, k) => [j, k]))
    names2 = keep.map(j => names[j])
    T = T.map(r => [...keep.map(j => r[j]), r[N]])
    basis = basis.map(b => remap.get(b)!)
  }

  // ── fase II: la función objetivo real en forma de máximo ──
  const N2 = names2.length
  const cost = (j: number) => (j < n ? s * c[j] : 0)
  T[0] = [...Array.from({ length: N2 }, (_, j) => -cost(j)), 0]
  basis.forEach((b, r) => { const f = T[0][b]; if (f !== 0) T[0] = T[0].map((v, j) => v - f * T[r + 1][j]) })
  const st2 = iterate(T, basis, names2, 2, snaps, () => true, n)
  if (st2 === 'cycle') fail('El método no terminó (posible ciclo por degeneración). Cambia ligeramente los datos.')
  if (st2 === 'unbounded') {
    fail(sense === 'max'
      ? '**El problema no está acotado**: hay una variable que puede crecer sin límite sin romper ninguna restricción, así que $Z$ se hace tan grande como quieras (no hay máximo). En un problema real falta una restricción.'
      : '**El problema no está acotado**: hay una variable que puede crecer sin límite sin romper ninguna restricción, así que $Z$ se hace tan pequeño como quieras (no hay mínimo). En un problema real falta una restricción.')
  }

  // ── resultados ──
  const last = snaps[snaps.length - 1]
  const x = last.x.map(v => (Math.abs(v) < 1e-10 ? 0 : v))
  const Z = s * T[0][N2]
  const slack = cons.map(k => {
    const val = k.a.reduce((t, a, j) => t + a * x[j], 0)
    const sl = k.op === -1 ? k.b - val : k.op === 1 ? val - k.b : 0
    return Math.abs(sl) < 1e-9 ? 0 : sl
  })
  const reduced = Array.from({ length: n }, (_, j) => (basis.includes(j) ? 0 : Math.max(0, T[0][j])))
  const nonbasicZero = Array.from({ length: N2 }, (_, j) => j).some(j => !basis.includes(j) && Math.abs(T[0][j]) < 1e-9)
  const degenerate = T.slice(1).some(r => Math.abs(r[N2]) < 1e-9)

  // precios sombra y rangos con la base final: B·d = e_r,  Bᵀy = c_B
  const duals = new Array(m).fill(0)
  const rhsRange: [number, number][] = cons.map(k => [k.b, k.b])
  const kept = rowOrig
  if (kept.length) {
    const B = kept.map(ri => basis.map(bj => A[ri][names.indexOf(names2[bj])]))
    const Bt = basis.map((_, k) => kept.map((_, r) => B[r][k]))
    const y = solveLinear(Bt, basis.map(bj => cost(bj)))
    const xB = T.slice(1).map(r => r[N2])
    kept.forEach((ri, r) => {
      const f = rows[ri].f
      if (y) duals[ri] = s * y[r] * f
      const e = kept.map((_, q) => (q === r ? 1 : 0))
      const d = solveLinear(B, e)
      if (!d) return
      let lo = -Infinity, hi = Infinity
      d.forEach((dk, k) => {
        if (dk > EPS) lo = Math.max(lo, -xB[k] / dk)
        else if (dk < -EPS) hi = Math.min(hi, xB[k] / -dk)
      })
      const b = cons[ri].b
      rhsRange[ri] = f === 1 ? [b + lo, b + hi] : [b - hi, b - lo]
    })
  }

  return {
    n, sense, x, Z, snaps, std,
    slack,
    duals: duals.map(v => (Math.abs(v) < 1e-10 ? 0 : v)),
    rhsRange,
    reduced,
    alt: nonbasicZero,
    degenerate,
    phase1: hasArt,
    redundant: redundant.sort((p, q) => p - q),
  }
}

import { calc, fail, mat, num, type CalcStep, type Formula, type Values } from '../types'
import { fmt, fp } from '../format'
import { L } from './oi-comun'

// ═══ Problema de transporte ═════════════════════════════════════════════════

export type Alloc = (number | null)[][]
export type Method = 1 | 2 | 3

export interface Balanced {
  cost: number[][]
  supply: number[]
  demand: number[]
  m: number
  n: number
  /** se agregó un origen ficticio (sobraba demanda) o un destino ficticio (sobraba oferta) */
  dummyRow: boolean
  dummyCol: boolean
  gap: number
}

export function balance(cost: number[][], supply: number[], demand: number[]): Balanced {
  let c = cost.map(r => [...r]), s = [...supply], d = [...demand]
  const S = s.reduce((t, x) => t + x, 0), D = d.reduce((t, x) => t + x, 0)
  let dummyRow = false, dummyCol = false
  if (S > D + 1e-9) { c = c.map(r => [...r, 0]); d = [...d, S - D]; dummyCol = true }
  else if (D > S + 1e-9) { c = [...c, new Array(d.length).fill(0)]; s = [...s, D - S]; dummyRow = true }
  return { cost: c, supply: s, demand: d, m: s.length, n: d.length, dummyRow, dummyCol, gap: Math.abs(S - D) }
}

export interface InitResult { x: Alloc; log: string[] }

const oname = (i: number, b: Balanced) => (b.dummyRow && i === b.m - 1 ? 'O_{f}' : `O_{${i + 1}}`)
const dname = (j: number, b: Balanced) => (b.dummyCol && j === b.n - 1 ? 'D_{f}' : `D_{${j + 1}}`)
const cellTex = (i: number, j: number) => `x_{${i + 1}${j + 1}}`

/** Solución inicial: esquina noroeste (1), costo mínimo (2) o aproximación de Vogel (3) */
export function initialSolution(b: Balanced, method: Method): InitResult {
  const { m, n, cost } = b
  const s = [...b.supply], d = [...b.demand]
  const x: Alloc = Array.from({ length: m }, () => new Array(n).fill(null))
  const rowOn = new Array(m).fill(true), colOn = new Array(n).fill(true)
  const log: string[] = []
  const give = (i: number, j: number, prefix = '') => {
    const q = Math.min(s[i], d[j])
    log.push(`${prefix}${cellTex(i, j)}=\\min(${fmt(s[i])},\\ ${fmt(d[j])})=${fmt(q)}`)
    x[i][j] = q
    s[i] -= q; d[j] -= q
    // se tacha un solo renglón o columna por asignación (así quedan m+n−1 celdas básicas)
    if (s[i] <= 1e-12 && d[j] > 1e-12) rowOn[i] = false
    else if (d[j] <= 1e-12 && s[i] > 1e-12) colOn[j] = false
    else if (rowOn.filter(Boolean).length > 1) rowOn[i] = false
    else colOn[j] = false
  }
  const active = () => rowOn.some(Boolean) && colOn.some(Boolean)

  if (method === 1) {
    let i = 0, j = 0
    while (i < m && j < n) {
      const q = Math.min(s[i], d[j])
      log.push(`${cellTex(i, j)}=\\min(${fmt(s[i])},\\ ${fmt(d[j])})=${fmt(q)}`)
      x[i][j] = q; s[i] -= q; d[j] -= q
      if (s[i] <= 1e-12 && d[j] > 1e-12) i++
      else if (d[j] <= 1e-12 && s[i] > 1e-12) j++
      else if (i < m - 1) i++
      else j++
    }
  } else if (method === 2) {
    while (active()) {
      let bi = -1, bj = -1
      for (let i = 0; i < m; i++) if (rowOn[i]) for (let j = 0; j < n; j++) if (colOn[j]) {
        if (bi < 0 || cost[i][j] < cost[bi][bj] - 1e-12 || (Math.abs(cost[i][j] - cost[bi][bj]) <= 1e-12 && Math.min(s[i], d[j]) > Math.min(s[bi], d[bj]) + 1e-12)) { bi = i; bj = j }
      }
      give(bi, bj, `c=${fmt(cost[bi][bj])}:\\ `)
    }
  } else {
    while (active()) {
      const rows = [...Array(m).keys()].filter(i => rowOn[i]), cols = [...Array(n).keys()].filter(j => colOn[j])
      const pen = (vals: number[]) => { const v = [...vals].sort((p, q) => p - q); return v.length > 1 ? v[1] - v[0] : 0 }
      const rp = new Array(m).fill(-1), cp = new Array(n).fill(-1)
      rows.forEach(i => { rp[i] = pen(cols.map(j => cost[i][j])) })
      cols.forEach(j => { cp[j] = pen(rows.map(i => cost[i][j])) })
      let best = -1, isRow = true, line = -1
      rows.forEach(i => { if (rp[i] > best + 1e-12) { best = rp[i]; isRow = true; line = i } })
      cols.forEach(j => { if (cp[j] > best + 1e-12) { best = cp[j]; isRow = false; line = j } })
      let bi = -1, bj = -1
      if (isRow) { bi = line; cols.forEach(j => { if (bj < 0 || cost[bi][j] < cost[bi][bj] - 1e-12) bj = j }) }
      else { bj = line; rows.forEach(i => { if (bi < 0 || cost[i][bj] < cost[bi][bj] - 1e-12) bi = i }) }
      const pf = (a: number[], on: boolean[]) => a.map((p, k) => (on[k] ? fmt(p) : '-')).join(',\\ ')
      give(bi, bj, `\\text{pen. R}=(${pf(rp, rowOn)}),\\ \\text{pen. C}=(${pf(cp, colOn)}):\\ `)
    }
  }
  return { x, log }
}

export function totalCost(cost: number[][], x: Alloc) {
  let t = 0
  x.forEach((r, i) => r.forEach((q, j) => { if (q) t += q * cost[i][j] }))
  return t
}

export interface ModiIter {
  u: number[]
  v: number[]
  r: (number | null)[][]
  x: Alloc
  total: number
  enter: [number, number] | null
  loop: [number, number][]
  theta: number
  leave: [number, number] | null
}

function potentials(cost: number[][], x: Alloc) {
  const m = x.length, n = x[0].length
  const u: (number | null)[] = new Array(m).fill(null), v: (number | null)[] = new Array(n).fill(null)
  u[0] = 0
  for (let pass = 0; pass < m + n; pass++) {
    let changed = false
    for (let i = 0; i < m; i++) for (let j = 0; j < n; j++) {
      if (x[i][j] === null) continue
      if (u[i] !== null && v[j] === null) { v[j] = cost[i][j] - u[i]!; changed = true }
      else if (v[j] !== null && u[i] === null) { u[i] = cost[i][j] - v[j]!; changed = true }
    }
    if (!changed) break
  }
  if (u.some(a => a === null) || v.some(a => a === null)) fail('La solución inicial no está conectada (degenerada). Cambia ligeramente los datos o usa otro método inicial.')
  return { u: u as number[], v: v as number[] }
}

function findPath(x: Alloc, i0: number, j0: number): [number, number][] {
  const m = x.length, n = x[0].length
  const parent = new Map<number, { from: number; cell: [number, number] }>()
  const seen = new Set<number>([i0])
  const queue = [i0]
  while (queue.length) {
    const node = queue.shift()!
    if (node === m + j0) break
    const next: [number, [number, number]][] = []
    if (node < m) for (let j = 0; j < n; j++) { if (x[node][j] !== null) next.push([m + j, [node, j]]) }
    else for (let i = 0; i < m; i++) { if (x[i][node - m] !== null) next.push([i, [i, node - m]]) }
    for (const [nx, cell] of next) if (!seen.has(nx)) { seen.add(nx); parent.set(nx, { from: node, cell }); queue.push(nx) }
  }
  const cells: [number, number][] = []
  let cur = m + j0
  while (cur !== i0) { const p = parent.get(cur); if (!p) return []; cells.push(p.cell); cur = p.from }
  return cells.reverse()
}

/** Método MODI (u–v): mejora la solución hasta que ningún costo reducido sea negativo */
export function modi(cost: number[][], start: Alloc): { iters: ModiIter[]; x: Alloc; alt: boolean } {
  const m = start.length, n = start[0].length
  let x: Alloc = start.map(r => [...r])
  const iters: ModiIter[] = []
  for (let it = 0; it < 200; it++) {
    const { u, v } = potentials(cost, x)
    const r: (number | null)[][] = x.map((row, i) => row.map((q, j) => (q === null ? cost[i][j] - u[i] - v[j] : null)))
    let low = -1e-9, ei = -1, ej = -1
    for (let i = 0; i < m; i++) for (let j = 0; j < n; j++) { const q = r[i][j]; if (q !== null && q < low) { low = q; ei = i; ej = j } }
    const total = totalCost(cost, x)
    if (ei < 0) {
      iters.push({ u, v, r, x: x.map(a => [...a]), total, enter: null, loop: [], theta: 0, leave: null })
      const alt = r.some(row => row.some(q => q !== null && Math.abs(q) < 1e-9))
      return { iters, x, alt }
    }
    const path = findPath(x, ei, ej)
    if (path.length === 0) fail('No se pudo encontrar el ciclo de mejora (la solución inicial está degenerada). Cambia ligeramente los datos.')
    const loop: [number, number][] = [[ei, ej], ...path]
    // signos: +, −, +, − … empezando por la celda que entra
    let theta = Infinity, leave: [number, number] = path[0]
    path.forEach(([i, j], k) => { if (k % 2 === 0) { const q = x[i][j]!; if (q < theta - 1e-12) { theta = q; leave = [i, j] } } })
    iters.push({ u, v, r, x: x.map(a => [...a]), total, enter: [ei, ej], loop, theta, leave })
    loop.forEach(([i, j], k) => { x[i][j] = (x[i][j] ?? 0) + (k % 2 === 0 ? theta : -theta) })
    x[leave[0]][leave[1]] = null
    x = x.map(row => row.map(q => (q !== null && Math.abs(q) < 1e-12 ? 0 : q)))
  }
  return fail('El método no terminó en 200 iteraciones.')
}

// ─── Entradas y pasos ────────────────────────────────────────────────────────

const costInput = (id: string, T: number[][]) => ({
  kind: 'matrix' as const,
  id,
  label: 'Costos de enviar una unidad (renglones = orígenes, columnas = destinos), oferta y demanda',
  symbol: L`c_{ij}`,
  default: T,
  rowPrefix: 'O',
  colPrefix: 'D',
  corner: 'Costo',
  lastRow: 'Demanda',
  lastCol: 'Oferta',
  minRows: 1,
  minCols: 1,
  maxRows: 8,
  maxCols: 8,
})

const objInput = (id: string, def: 1 | -1) => ({
  kind: 'select' as const, id, label: 'Objetivo', symbol: 'Z', default: def,
  options: [{ value: 1, label: 'Minimizar' }, { value: -1, label: 'Maximizar' }],
})

const methodInput = (id: string) => ({
  kind: 'select' as const, id, label: 'Solución inicial', symbol: L`\text{inicio}`, default: 3,
  options: [{ value: 1, label: 'Esquina noroeste' }, { value: 2, label: 'Costo mínimo' }, { value: 3, label: 'Aproximación de Vogel' }],
})

function readTransport(v: Values, id: string) {
  const T = mat(v, id)
  const m = T.length - 1, n = T[0].length - 1
  if (m < 1 || n < 1) fail('La tabla necesita al menos un origen y un destino.')
  const cost = T.slice(0, m).map(r => r.slice(0, n))
  const supply = T.slice(0, m).map(r => r[n])
  const demand = T[m].slice(0, n)
  if (supply.some(x => x < 0) || demand.some(x => x < 0)) fail('La oferta y la demanda no pueden ser negativas.')
  if (supply.reduce((t, x) => t + x, 0) <= 0) fail('La oferta total debe ser mayor que 0.')
  if (demand.reduce((t, x) => t + x, 0) <= 0) fail('La demanda total debe ser mayor que 0.')
  return { cost, supply, demand, m, n }
}

interface TRes {
  b: Balanced
  method: Method
  init: InitResult
  initTotal: number
  iters: ModiIter[]
  x: Alloc
  total: number
  maximize: boolean
  origCost: number[][]
  alt: boolean
  realM: number
  realN: number
}

const allocTex = (b: Balanced, x: Alloc) => {
  const head = `&${Array.from({ length: b.n }, (_, j) => dname(j, b)).join('&')}&\\text{Oferta}`
  const rows = x.map((r, i) => `${oname(i, b)}&${r.map(q => (q === null ? L`\cdot` : fmt(q))).join('&')}&${fmt(b.supply[i])}`)
  const foot = `\\text{Demanda}&${b.demand.map(q => fmt(q)).join('&')}&`
  return L`\begin{array}{c|${'r'.repeat(b.n)}|r}${head}\\${rows.join(L`\\`)}\\${foot}\end{array}`
}

function transportSteps(r: TRes): CalcStep[] {
  const { b } = r
  const f = (q: number) => fmt(q)
  const names = ['Esquina noroeste', 'Costo mínimo', 'Aproximación de Vogel']
  const steps: CalcStep[] = [
    {
      label: `Problema: costo $c_{ij}$ de enviar una unidad del origen $i$ al destino $j$${r.maximize ? ' (el objetivo es **maximizar** la ganancia: se convierte restando cada valor al mayor, así que se minimiza el “costo de oportunidad”)' : ''}`,
      latex: L`\begin{array}{c|${'r'.repeat(b.n)}|r}&${Array.from({ length: b.n }, (_, j) => dname(j, b)).join('&')}&\text{Oferta}\\${b.cost.map((row, i) => `${oname(i, b)}&${row.map(f).join('&')}&${f(b.supply[i])}`).join(L`\\`)}\\\text{Demanda}&${b.demand.map(f).join('&')}&\end{array}`,
    },
  ]
  if (b.dummyCol || b.dummyRow) {
    steps.push({
      label: `La oferta y la demanda **no coinciden** (difieren en $${f(b.gap)}$): se agrega un ${b.dummyCol ? 'destino ficticio $D_f$ que absorbe lo que sobra de oferta' : 'origen ficticio $O_f$ que cubre lo que falta de oferta'}, con costo 0`,
      latex: L`\sum\text{oferta}=${f(r.b.supply.reduce((t, x) => t + x, 0))}\qquad\sum\text{demanda}=${f(r.b.demand.reduce((t, x) => t + x, 0))}`,
    })
  } else {
    steps.push({ label: 'La oferta total es igual a la demanda total: el problema está **balanceado**', latex: L`\sum\text{oferta}=\sum\text{demanda}=${f(b.supply.reduce((t, x) => t + x, 0))}` })
  }
  steps.push(
    { label: `Solución inicial por **${names[r.method - 1].toLowerCase()}**: se asigna a cada paso lo máximo posible, $x_{ij}=\\min(\\text{oferta restante},\\text{demanda restante})$`, latex: L`\begin{array}{l}${r.init.log.join(L`\\`)}\end{array}` },
    { label: `Asignación inicial (el punto indica una celda sin envío). Hay ${b.m + b.n - 1} celdas **básicas** ($m+n-1$)`, latex: allocTex(b, r.init.x) },
    { label: 'Costo de la solución inicial', latex: L`Z_0=${r.init.x.flatMap((row, i) => row.flatMap((q, j) => (q ? [`${f(b.cost[i][j])}(${f(q)})`] : []))).join('+')}=${f(r.initTotal)}` },
  )
  r.iters.forEach((it, k) => {
    const bn = b
    steps.push({
      label: `**MODI**, iteración ${k + 1}: se calculan $u_i$ y $v_j$ con $u_1=0$ y $u_i+v_j=c_{ij}$ en las celdas básicas; en las celdas sin envío se muestra el costo reducido $c_{ij}-u_i-v_j$ (el punto marca las celdas básicas)`,
      latex: L`\begin{array}{c|${'r'.repeat(b.n)}|r}&${Array.from({ length: b.n }, (_, j) => dname(j, bn)).join('&')}&u_i\\${it.r.map((row, i) => `${oname(i, bn)}&${row.map(q => (q === null ? L`\cdot` : f(q))).join('&')}&${f(it.u[i])}`).join(L`\\`)}\\v_j&${it.v.map(f).join('&')}&\end{array}`,
    })
    if (it.enter) {
      steps.push({
        label: `El costo reducido más negativo es $${f(it.r[it.enter[0]][it.enter[1]]!)}$ en $${cellTex(it.enter[0], it.enter[1])}$: **conviene enviar por esa ruta**. Se forma un ciclo alternando $+$ y $-$ por celdas básicas; $\\theta$ es el menor valor de las celdas con $-$`,
        latex: L`\text{ciclo: }${it.loop.map(([i, j], q) => `${q % 2 === 0 ? '+' : '-'}${cellTex(i, j)}`).join(L`\ \to\ `)}\qquad\theta=${f(it.theta)}\qquad\text{sale }${cellTex(it.leave![0], it.leave![1])}`,
      })
    } else {
      steps.push({ label: 'Ningún costo reducido es negativo: **la solución es óptima**', latex: L`\min\left(c_{ij}-u_i-v_j\right)\ge0\ \Rightarrow\ Z^*=${f(it.total)}` })
    }
    if (it.enter && k + 1 < r.iters.length) {
      steps.push({ label: `Nueva asignación después de la iteración ${k + 1}`, latex: allocTex(b, r.iters[k + 1].x) + L`\qquad Z=${f(r.iters[k + 1].total)}` })
    }
  })
  return steps
}

function transportRoutes(r: TRes) {
  const out: { i: number; j: number; q: number; cost: number; dummy: boolean }[] = []
  r.x.forEach((row, i) => row.forEach((q, j) => {
    if (q && q > 1e-12) out.push({ i, j, q, cost: r.origCost[i]?.[j] ?? 0, dummy: i >= r.realM || j >= r.realN })
  }))
  return out
}

const transporteFormula = (() => {
  const calcT = (id: string, label: string, example: string, T: number[][], startMethod: Method, maximize = false) =>
    calc<TRes>({
      id,
      label,
      example,
      inputs: [costInput(`${id}.T`, T), { ...methodInput(`${id}.met`), default: startMethod }, objInput(`${id}.obj`, maximize ? -1 : 1)],
      compute: (v) => {
        const { cost, supply, demand, m, n } = readTransport(v, `${id}.T`)
        const maximize = num(v, `${id}.obj`) === -1
        const mx = Math.max(...cost.flat())
        const work = maximize ? cost.map(r => r.map(c => mx - c)) : cost
        const b = balance(work, supply, demand)
        const method = num(v, `${id}.met`) as Method
        const init = initialSolution(b, method)
        const opt = modi(b.cost, init.x)
        const origBal = balance(cost, supply, demand).cost
        return {
          b, method, init, initTotal: totalCost(b.cost, init.x), iters: opt.iters, x: opt.x,
          total: totalCost(origBal, opt.x), maximize, origCost: origBal, alt: opt.alt, realM: m, realN: n,
        }
      },
      steps: (_v, r) => transportSteps(r),
      answer: (_v, r) => L`Z^*=${fmt(r.total)}`,
      extras: (_v, r) => [
        { label: r.maximize ? 'Ganancia óptima' : 'Costo óptimo', latex: fmt(r.total) },
        { label: 'Costo de la solución inicial', latex: fmt(r.maximize ? totalCost(r.origCost, r.init.x) : r.initTotal) },
        { label: 'Rutas usadas', latex: `${transportRoutes(r).filter(q => !q.dummy).length}` },
        { label: 'Iteraciones MODI', latex: `${Math.max(0, r.iters.length - 1)}` },
      ],
      interpret: (_v, r) => {
        const routes = transportRoutes(r)
        const real = routes.filter(q => !q.dummy), fict = routes.filter(q => q.dummy)
        const first = r.maximize ? totalCost(r.origCost, r.init.x) : r.initTotal
        const out: { tone: 'good' | 'info' | 'warn'; text: string }[] = [
          { tone: 'good', text: `${r.maximize ? 'La mayor ganancia' : 'El menor costo'} es **${fmt(r.total)}**. Rutas: ${real.map(q => `$O_${q.i + 1}\\to D_${q.j + 1}$ (${fmt(q.q)} unidades)`).join('; ')}.` },
          Math.abs(first - r.total) < 1e-9
            ? { tone: 'info', text: 'La solución inicial ya era **óptima**: el método MODI no encontró ninguna mejora.' }
            : { tone: 'info', text: `La solución inicial costaba $${fmt(first)}$ y el método MODI la mejoró en ${r.iters.length - 1} ${r.iters.length - 1 === 1 ? 'iteración' : 'iteraciones'} hasta $${fmt(r.total)}$ (${fmt(Math.abs(first - r.total) / Math.abs(first) * 100, 3)}% de diferencia).` },
        ]
        if (fict.length) out.push({ tone: 'warn', text: `Lo enviado al ${r.b.dummyCol ? 'destino' : 'origen'} **ficticio** (${fict.map(q => fmt(q.q)).join(', ')} unidades) ${r.b.dummyCol ? 'es oferta que **sobra** (no se envía)' : 'es demanda que **no se alcanza a cubrir**'}.` })
        if (r.alt) out.push({ tone: 'info', text: '**Óptimos alternativos**: alguna celda sin envío tiene costo reducido 0. Se puede mandar por esa ruta sin cambiar el costo total.' })
        if (r.x.some(row => row.some(q => q === 0))) out.push({ tone: 'info', text: 'La solución es **degenerada** (alguna celda básica vale 0). No afecta el resultado.' })
        out.push({ tone: 'info', text: 'Si una ruta está **prohibida**, ponle un costo muy grande (por ejemplo 9999) para que el método no la use.' })
        return out
      },
      visual: (_v, r) => {
        const routes = transportRoutes(r)
        const { m, n } = r.b
        const yo = (i: number) => (m === 1 ? 0.5 : 1 - i / (m - 1)), yd = (j: number) => (n === 1 ? 0.5 : 1 - j / (n - 1))
        return {
          type: 'plot' as const,
          segments: routes.map(q => ({ from: [0, yo(q.i)] as [number, number], to: [1, yd(q.j)] as [number, number], tone: q.dummy ? 'muted' as const : 'a' as const, label: fmt(q.q) })),
          marks: [
            ...Array.from({ length: m }, (_, i) => ({ x: 0, y: yo(i), tone: 'b' as const, label: `${r.b.dummyRow && i === m - 1 ? 'O ficticio' : `O${i + 1}`} (${fmt(r.b.supply[i])})` })),
            ...Array.from({ length: n }, (_, j) => ({ x: 1, y: yd(j), tone: 'warn' as const, label: `${r.b.dummyCol && j === n - 1 ? 'D ficticio' : `D${j + 1}`} (${fmt(r.b.demand[j])})` })),
          ],
          xRange: [-0.45, 1.45] as [number, number],
          yRange: [-0.15, 1.15] as [number, number],
          hideXTicks: true,
          hideYTicks: true,
          caption: 'Cada línea es una ruta con su cantidad enviada. Entre paréntesis, la oferta de cada origen y la demanda de cada destino.',
        }
      },
    })

  const f: Formula = {
    id: 'transporte',
    name: 'Problema de transporte (esquina noroeste, Vogel y MODI)',
    category: 'transporte',
    latex: L`\min Z=\sum_{i}\sum_{j}c_{ij}\,x_{ij}\quad\text{s.a.}\quad\sum_jx_{ij}=s_i,\ \ \sum_ix_{ij}=d_j,\ \ x_{ij}\ge0`,
    forms: [
      { label: 'Condición para estar balanceado', latex: L`\sum s_i=\sum d_j` },
      { label: 'Número de celdas básicas', latex: L`m+n-1` },
      { label: 'Potenciales (MODI)', latex: L`u_i+v_j=c_{ij}\ \text{(celdas básicas)}\qquad u_1=0` },
      { label: 'Costo reducido', latex: L`\bar c_{ij}=c_{ij}-u_i-v_j\ \ge0\ \Rightarrow\ \text{óptimo}` },
    ],
    summary: 'Cómo repartir un producto desde varios orígenes hasta varios destinos al menor costo total.',
    goal: 'Decidir **cuántas unidades enviar por cada ruta** (origen → destino) para cubrir toda la demanda sin pasarse de la oferta y con el menor costo total (o la mayor ganancia).',
    variables: [
      { symbol: 'c_{ij}', meaning: 'Costo de enviar **una** unidad del origen $i$ al destino $j$' },
      { symbol: 's_i', meaning: 'Oferta: lo máximo que puede enviar el origen $i$ (plantas, almacenes)' },
      { symbol: 'd_j', meaning: 'Demanda: lo que necesita el destino $j$ (clientes, tiendas)' },
      { symbol: 'x_{ij}', meaning: 'Unidades que se envían de $i$ a $j$ (lo que queremos encontrar)' },
      { symbol: 'u_i,\\ v_j', meaning: 'Potenciales del método MODI: números auxiliares que miden el “valor” de cada origen y destino' },
      { symbol: L`\bar c_{ij}`, meaning: 'Costo reducido: cuánto cambia el costo total por cada unidad enviada por una ruta que hoy no se usa' },
    ],
    whenToUse: [
      'Distribución de un producto homogéneo de varios orígenes a varios destinos (fábricas → almacenes, almacenes → tiendas).',
      'Cuando la oferta y la demanda **no coinciden**: el método agrega un origen o destino ficticio y lo aclara.',
      'También sirve para **maximizar** (ganancia por envío) cambiando el objetivo.',
    ],
    intuition: [
      'Es un problema de programación lineal con una estructura especial, así que se resuelve mucho más rápido que con el símplex general: sólo hay $m+n-1$ rutas “básicas” y todo son sumas y restas.',
      '**Solución inicial**: la **esquina noroeste** es rápida pero ignora los costos; el **costo mínimo** da prioridad a las rutas baratas; **Vogel** mira la “penalización” (diferencia entre las dos rutas más baratas de cada renglón o columna): si no usas la más barata, pagas esa diferencia, así que atiende primero donde la penalización sea mayor. Vogel casi siempre queda muy cerca del óptimo.',
      '**MODI**: con los potenciales $u_i+v_j=c_{ij}$ se calcula, para cada ruta sin uso, cuánto costaría enviar por ahí frente a lo que ya se paga. Si alguna sale **negativa**, esa ruta mejora el costo: se manda por ahí lo más posible reajustando un ciclo de rutas. Se repite hasta que todas sean $\\ge0$.',
    ],
    calculators: [
      calcT('transporte', 'Ejemplo: 3 orígenes, 4 destinos', 'Tres plantas (oferta 35, 50 y 40) abastecen a cuatro tiendas (demanda 45, 20, 30 y 30). El renglón de abajo es la demanda y la última columna la oferta; agrega o quita orígenes y destinos con los botones. La celda de la esquina no se usa.', [
        [8, 6, 10, 9, 35], [9, 12, 13, 7, 50], [14, 9, 16, 5, 40], [45, 20, 30, 30, 0],
      ], 3),
      calcT('desbalanceado', 'Ejemplo: oferta mayor que demanda', 'La oferta total (100) es mayor que la demanda (80): el método agrega un destino ficticio para lo que sobra.', [
        [4, 8, 8, 40], [16, 24, 16, 30], [8, 16, 24, 30], [35, 25, 20, 0],
      ], 2),
      calcT('ganancia', 'Ejemplo: maximizar ganancia', 'Aquí los números son la **ganancia** por unidad enviada y se busca maximizarla.', [
        [12, 7, 9, 20], [14, 9, 16, 25], [10, 11, 8, 15], [18, 22, 20, 0],
      ], 3, true),
    ],
    commonMistakes: [
      'Olvidar balancear: si la oferta total no es igual a la demanda total, hay que agregar un origen o destino ficticio con costo 0.',
      'Quedarse con la esquina noroeste como si fuera la respuesta: ignora los costos, casi nunca es óptima.',
      'En MODI, elegir una celda con costo reducido **positivo**: sólo conviene si es **negativo** (en minimizar).',
      'Contar mal las celdas básicas: deben ser exactamente $m+n-1$ (si hay menos, hay degeneración y se completa con ceros).',
      'Tratar una ruta imposible como costo 0: debe llevar un costo muy grande.',
    ],
    related: ['asignacion', 'lp-simplex'],
    keywords: ['transporte', 'esquina noroeste', 'vogel', 'costo minimo', 'modi', 'u v', 'oferta demanda', 'distribucion', 'investigacion de operaciones', 'balanceado'],
  }
  return f
})()

// ═══ Problema de asignación (método húngaro) ═════════════════════════════════

type HStep =
  | { kind: 'start'; M: number[][] }
  | { kind: 'rows'; mins: number[]; M: number[][] }
  | { kind: 'cols'; mins: number[]; M: number[][] }
  | { kind: 'cover'; M: number[][]; rows: number[]; cols: number[]; k: number; after: number[][]; size: number }
  | { kind: 'done'; M: number[][]; match: number[] }

export function hungarian(M0: number[][]): { assign: number[]; steps: HStep[] } {
  const n = M0.length
  let M = M0.map(r => [...r])
  const steps: HStep[] = [{ kind: 'start', M: M.map(r => [...r]) }]
  const rmin = M.map(r => Math.min(...r))
  M = M.map((r, i) => r.map(x => x - rmin[i]))
  steps.push({ kind: 'rows', mins: rmin, M: M.map(r => [...r]) })
  const cmin = Array.from({ length: n }, (_, j) => Math.min(...M.map(r => r[j])))
  M = M.map(r => r.map((x, j) => x - cmin[j]))
  steps.push({ kind: 'cols', mins: cmin, M: M.map(r => [...r]) })
  const Z = (x: number) => Math.abs(x) < 1e-9
  for (let it = 0; it < 200; it++) {
    const matchCol = new Array(n).fill(-1), matchRow = new Array(n).fill(-1)
    const tryRow = (i: number, seen: boolean[]): boolean => {
      for (let j = 0; j < n; j++) {
        if (Z(M[i][j]) && !seen[j]) {
          seen[j] = true
          if (matchCol[j] < 0 || tryRow(matchCol[j], seen)) { matchCol[j] = i; matchRow[i] = j; return true }
        }
      }
      return false
    }
    let size = 0
    for (let i = 0; i < n; i++) if (tryRow(i, new Array(n).fill(false))) size++
    if (size === n) { steps.push({ kind: 'done', M: M.map(r => [...r]), match: matchRow }); return { assign: matchRow, steps } }
    // cubrimiento mínimo (König): alcanzables desde renglones sin asignar por caminos alternantes
    const visR = new Array(n).fill(false), visC = new Array(n).fill(false)
    const queue: number[] = []
    for (let i = 0; i < n; i++) if (matchRow[i] < 0) { visR[i] = true; queue.push(i) }
    while (queue.length) {
      const i = queue.shift()!
      for (let j = 0; j < n; j++) if (Z(M[i][j]) && !visC[j]) { visC[j] = true; const r2 = matchCol[j]; if (r2 >= 0 && !visR[r2]) { visR[r2] = true; queue.push(r2) } }
    }
    const rows = [...Array(n).keys()].filter(i => !visR[i]), cols = [...Array(n).keys()].filter(j => visC[j])
    let k = Infinity
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (visR[i] && !visC[j]) k = Math.min(k, M[i][j])
    const before = M.map(r => [...r])
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const rc = !visR[i], cc = visC[j]
      if (!rc && !cc) M[i][j] -= k
      else if (rc && cc) M[i][j] += k
    }
    steps.push({ kind: 'cover', M: before, rows, cols, k, after: M.map(r => [...r]), size })
  }
  return fail('El método húngaro no terminó.')
}

interface ARes {
  steps: HStep[]
  assign: number[]
  rows: number
  cols: number
  size: number
  total: number
  maximize: boolean
  orig: number[][]
  work: number[][]
}

const asignacion: Formula = (() => {
  const calcA = (id: string, label: string, example: string, T: number[][], maximize: boolean) => calc<ARes>({
    id,
    label,
    example,
    inputs: [
      {
        kind: 'matrix', id: `${id}.A`, label: 'Costo (o tiempo, o ganancia) de cada asignación: renglones = personas, columnas = tareas', symbol: L`c_{ij}`, default: T,
        rowPrefix: 'P', colPrefix: 'T', corner: 'Costo', minRows: 1, minCols: 1, maxRows: 10, maxCols: 10,
      },
      objInput(`${id}.obj`, maximize ? -1 : 1),
    ],
    compute: (v) => {
      const A = mat(v, `${id}.A`)
      const rows = A.length, cols = A[0].length
      const size = Math.max(rows, cols)
      const maximize = num(v, `${id}.obj`) === -1
      const padded = Array.from({ length: size }, (_, i) => Array.from({ length: size }, (_, j) => (i < rows && j < cols ? A[i][j] : 0)))
      const mx = Math.max(...padded.flat())
      const work = maximize ? padded.map(r => r.map(x => mx - x)) : padded
      const { assign, steps } = hungarian(work)
      let total = 0
      assign.forEach((j, i) => { if (i < rows && j < cols) total += A[i][j] })
      return { steps, assign, rows, cols, size, total, maximize, orig: A, work }
    },
    steps: (_v, r) => {
      const f = (q: number) => fmt(q)
      const pn = (i: number) => (i < r.rows ? `P_{${i + 1}}` : 'P_{f}'), tn = (j: number) => (j < r.cols ? `T_{${j + 1}}` : 'T_{f}')
      const table = (M: number[][], mark?: (i: number, j: number) => string) => L`\begin{array}{c|${'r'.repeat(r.size)}}&${Array.from({ length: r.size }, (_, j) => tn(j)).join('&')}\\${M.map((row, i) => `${pn(i)}&${row.map((x, j) => mark ? mark(i, j) : f(x)).join('&')}`).join(L`\\`)}\end{array}`
      const steps: CalcStep[] = []
      const first = r.steps[0] as Extract<HStep, { kind: 'start' }>
      steps.push({
        label: `Matriz de ${r.maximize ? 'ganancias' : 'costos'}${r.rows !== r.cols ? `. Como no es cuadrada (${r.rows}×${r.cols}), se agrega ${r.rows < r.cols ? 'una persona ficticia' : 'una tarea ficticia'} con valor 0 (quien le toque queda sin asignar)` : ''}`,
        latex: table((r.maximize ? padMat(r.orig, r.size) : first.M)),
      })
      if (r.maximize) steps.push({ label: 'Para **maximizar** se convierte a minimizar restando cada valor al mayor de la matriz', latex: table(first.M) })
      r.steps.slice(1).forEach(st => {
        if (st.kind === 'rows') steps.push({ label: `**Reducción por renglones**: a cada renglón se le resta su mínimo (${st.mins.map(f).join(', ')})`, latex: table(st.M) })
        else if (st.kind === 'cols') steps.push({ label: `**Reducción por columnas**: a cada columna se le resta su mínimo (${st.mins.map(f).join(', ')})`, latex: table(st.M) })
        else if (st.kind === 'cover') {
          steps.push({
            label: `Se tachan los ceros con el **mínimo de líneas**: renglones ${st.rows.length ? st.rows.map(i => `$${pn(i)}$`).join(', ') : '(ninguno)'} y columnas ${st.cols.length ? st.cols.map(j => `$${tn(j)}$`).join(', ') : '(ninguna)'}. Son ${st.rows.length + st.cols.length} líneas y se necesitan ${r.size}, así que **todavía no** hay asignación completa. Se subraya lo cubierto`,
            latex: table(st.M, (i, j) => (st.rows.includes(i) || st.cols.includes(j) ? L`\underline{${f(st.M[i][j])}}` : f(st.M[i][j]))),
          })
          steps.push({ label: `El menor número sin cubrir es $${f(st.k)}$: se **resta** a los no cubiertos y se **suma** a los cubiertos dos veces (en el cruce de dos líneas)`, latex: table(st.after) })
        } else if (st.kind === 'done') {
          steps.push({
            label: `Ya se pueden elegir ${r.size} ceros en renglones y columnas distintos: es la **asignación óptima** (recuadro)`,
            latex: table(st.M, (i, j) => (st.match[i] === j ? L`\boxed{0}` : f(st.M[i][j]))),
          })
        }
      })
      const pairs = r.assign.map((j, i) => (i < r.rows && j < r.cols ? `${pn(i)}\\to ${tn(j)}\\ (${f(r.orig[i][j])})` : null)).filter(Boolean)
      steps.push({ label: `Se suman los valores **originales** de las celdas elegidas`, latex: L`${pairs.join(L`,\ `)}\qquad Z=${r.assign.flatMap((j, i) => (i < r.rows && j < r.cols ? [fp(r.orig[i][j])] : [])).join('+')}=${f(r.total)}` })
      return steps
    },
    answer: (_v, r) => L`Z^*=${fmt(r.total)}`,
    extras: (_v, r) => [
      ...r.assign.flatMap((j, i) => (i < r.rows && j < r.cols ? [{ label: `Persona ${i + 1}`, latex: `T_{${j + 1}}` }] : [])),
      { label: 'Iteraciones de ajuste', latex: `${r.steps.filter(s => s.kind === 'cover').length}` },
    ],
    interpret: (_v, r) => {
      const out: { tone: 'good' | 'info' | 'warn'; text: string }[] = [
        { tone: 'good', text: `${r.maximize ? 'La mayor ganancia' : 'El menor costo'} es **${fmt(r.total)}**: ${r.assign.flatMap((j, i) => (i < r.rows && j < r.cols ? [`$P_${i + 1}$ hace $T_${j + 1}$`] : [])).join(', ')}.` },
      ]
      const idle = r.assign.flatMap((j, i) => (i < r.rows && j >= r.cols ? [`$P_${i + 1}$`] : []))
      const unfilled = r.assign.flatMap((j, i) => (i >= r.rows && j < r.cols ? [`$T_${j + 1}$`] : []))
      if (idle.length) out.push({ tone: 'warn', text: `${idle.join(', ')} ${idle.length === 1 ? 'queda' : 'quedan'} **sin tarea** (hay más personas que tareas).` })
      if (unfilled.length) out.push({ tone: 'warn', text: `${unfilled.join(', ')} ${unfilled.length === 1 ? 'queda' : 'quedan'} **sin asignar** (hay más tareas que personas).` })
      out.push({ tone: 'info', text: 'El método húngaro **no prueba** las $n!$ combinaciones: con 10 personas serían más de 3.6 millones. Restar el mismo número a un renglón o a una columna no cambia cuál asignación es la mejor, y se busca llegar a una matriz con ceros suficientes.' })
      return out
    },
    visual: (_v, r) => {
      const yp = (i: number) => (r.size === 1 ? 0.5 : 1 - i / (r.size - 1))
      return {
        type: 'plot',
        segments: r.assign.flatMap((j, i) => (i < r.rows && j < r.cols ? [{ from: [0, yp(i)] as [number, number], to: [1, yp(j)] as [number, number], tone: 'a' as const, label: fmt(r.orig[i][j]) }] : [])),
        marks: [
          ...Array.from({ length: r.rows }, (_, i) => ({ x: 0, y: yp(i), tone: 'b' as const, label: `P${i + 1}` })),
          ...Array.from({ length: r.cols }, (_, j) => ({ x: 1, y: yp(j), tone: 'warn' as const, label: `T${j + 1}` })),
        ],
        xRange: [-0.3, 1.3],
        yRange: [-0.15, 1.15],
        hideXTicks: true,
        hideYTicks: true,
        caption: 'Cada línea une a una persona con su tarea; el número es el valor de esa asignación.',
      }
    },
  })

  return {
    id: 'asignacion',
    name: 'Problema de asignación (método húngaro)',
    category: 'transporte',
    latex: L`\min Z=\sum_i\sum_jc_{ij}\,x_{ij}\quad\text{s.a.}\quad\sum_jx_{ij}=1,\ \ \sum_ix_{ij}=1,\ \ x_{ij}\in\{0,1\}`,
    forms: [
      { label: 'Reducción', latex: L`c'_{ij}=c_{ij}-\min_jc_{ij}\ \ (\text{renglones})\qquad c''_{ij}=c'_{ij}-\min_ic'_{ij}\ \ (\text{columnas})` },
      { label: 'Criterio de parada', latex: L`\text{mínimo de líneas que cubren los ceros}=n` },
      { label: 'Ajuste', latex: L`k=\min\{\text{no cubiertos}\}:\ \ -k\ \text{(no cubiertos)},\ +k\ \text{(doble cubiertos)}` },
    ],
    summary: 'Asigna cada persona a una tarea (uno a uno) para que el costo total sea el menor, o la ganancia la mayor.',
    goal: 'Decidir **quién hace qué** cuando cada persona hace exactamente una tarea y cada tarea la hace exactamente una persona, y cada pareja tiene un costo distinto.',
    variables: [
      { symbol: 'c_{ij}', meaning: 'Costo, tiempo o ganancia de que la persona $i$ haga la tarea $j$' },
      { symbol: 'x_{ij}', meaning: '1 si la persona $i$ hace la tarea $j$, y 0 si no' },
      { symbol: 'n', meaning: 'Número de personas (y de tareas, si la matriz es cuadrada)' },
    ],
    whenToUse: [
      'Asignar trabajadores a máquinas, vehículos a rutas, proyectos a equipos, cuando es **uno a uno**.',
      'Si hay **más personas que tareas** (o al revés), el método agrega ficticias con valor 0 y avisa quién queda sin asignar.',
      'Para **maximizar** (por ejemplo ganancia o puntaje) basta cambiar el objetivo.',
    ],
    intuition: [
      'Probar todas las asignaciones posibles ($n!$) es imposible para $n$ grande. El método húngaro usa una idea: **restarle el mismo número a todo un renglón (o columna) no cambia cuál asignación es la mejor**, porque cada persona (y cada tarea) se usa exactamente una vez.',
      'Así se restan mínimos hasta que aparecen ceros. Si se pueden elegir $n$ ceros en renglones y columnas distintos, esa es la asignación: todas las parejas cuestan 0 en la matriz reducida, y como nada es negativo no se puede hacer mejor.',
      'Si no alcanzan los ceros, se tachan con el mínimo de líneas y se crea un cero nuevo restando el menor número sin cubrir: es un ajuste que mantiene la propiedad anterior.',
    ],
    calculators: [
      calcA('asignacion', 'Ejemplo: 4 personas, 4 tareas', 'Cuatro trabajadores y cuatro tareas; los números son el tiempo (en horas) que tarda cada uno en cada tarea. Agrega o quita personas y tareas con los botones.', [
        [9, 2, 7, 8], [6, 4, 3, 7], [5, 8, 1, 8], [7, 6, 9, 4],
      ], false),
      calcA('rectangular', 'Ejemplo: más tareas que personas', 'Tres personas y cuatro tareas: una tarea quedará sin asignar.', [
        [14, 5, 8, 7], [2, 12, 6, 5], [7, 8, 3, 9],
      ], false),
      calcA('maximizar', 'Ejemplo: maximizar', 'Aquí los números son la **ganancia** de cada asignación y se busca la mayor.', [
        [16, 9, 12, 7], [11, 14, 8, 10], [13, 15, 10, 9], [9, 8, 13, 12],
      ], true),
    ],
    commonMistakes: [
      'Tachar los ceros con **más** líneas de las necesarias: hay que usar el mínimo.',
      'En el ajuste, restar $k$ a **todo**: sólo se resta a lo no cubierto y se suma a los dobles cubiertos.',
      'Maximizar sin convertir: hay que restar cada valor al mayor (o cambiar de signo y sumar una constante).',
      'Elegir ceros en el mismo renglón o la misma columna: la asignación debe ser uno a uno.',
    ],
    related: ['transporte', 'lp-simplex'],
    keywords: ['asignacion', 'metodo hungaro', 'hungaro', 'kuhn munkres', 'asignar tareas', 'trabajadores', 'investigacion de operaciones', 'uno a uno'],
  }
})()

const padMat = (A: number[][], n: number) => Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i < A.length && j < A[0].length ? A[i][j] : 0)))

export const TRANSPORTE: Formula[] = [transporteFormula, asignacion]

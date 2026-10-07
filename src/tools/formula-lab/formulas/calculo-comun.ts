/* ─── Piezas compartidas por álgebra, trigonometría, derivadas e integrales ───
 *
 * Las fórmulas de cálculo comparten la misma estructura de calculadora: una función
 * con parámetros numéricos, evaluada en un punto (derivadas) o en un intervalo
 * (integrales). Las fábricas de aquí arman los pasos, la comprobación numérica,
 * la interpretación y la gráfica para que cada fórmula sólo describa su función.
 */

import { calc, fail, type CalcStep, type Calculator, type NumberInput, type PlotArea, type PlotCurve, type Values } from '../types'
import { fmt, fp } from '../format'

export const L = String.raw

// En México el seno se escribe “sen”
export const SEN = L`\operatorname{sen}`
export const ARCSEN = L`\operatorname{arcsen}`
export const ARCCOT = L`\operatorname{arccot}`
export const ARCSEC = L`\operatorname{arcsec}`
export const ARCCSC = L`\operatorname{arccsc}`

// ─── Números ─────────────────────────────────────────────────────────────────

export function gcd(a: number, b: number): number {
  a = Math.abs(a); b = Math.abs(b)
  while (b) [a, b] = [b, a % b]
  return a
}

/** Coeficiente n/d listo para ir delante de una expresión: '', '-', '3', '-\frac{1}{2}' */
export function coef(n: number, d = 1): string {
  const v = n / d
  if (Math.abs(v - 1) < 1e-12) return ''
  if (Math.abs(v + 1) < 1e-12) return '-'
  if (Number.isInteger(n) && Number.isInteger(d) && !Number.isInteger(v)) {
    const g = gcd(n, d)
    return `${v < 0 ? '-' : ''}\\frac{${Math.abs(n) / g}}{${Math.abs(d) / g}}`
  }
  return fmt(v)
}

/** Igual que coef, pero como término que se suma: '+3', '-\frac12', '+' */
export function signedCoef(n: number, d = 1): string {
  const c = coef(n, d)
  return c.startsWith('-') ? c : `+${c}`
}

/** El valor que se sustituye: la variable x o un número */
export type X = number | 'x'

/** k·x con k numérico: 'x', '-x', '2x'; o, si x ya es número, '2\cdot3' */
export function kx(k: number, x: X = 'x'): string {
  if (x === 'x') return k === 1 ? 'x' : k === -1 ? '-x' : `${fmt(k)}x`
  return k === 1 ? fmt(x) : `${fmt(k)}\\cdot${fp(x)}`
}

/** px + q bonito: '2x+1', 'x', '-x-3', '5' */
export function lin(p: number, q: number, x: X = 'x'): string {
  if (p === 0) return fmt(q)
  const head = kx(p, x)
  return q === 0 ? head : `${head}${q < 0 ? '-' : '+'}${fmt(Math.abs(q))}`
}

/** Polinomio a·x² + b·x + c bonito */
export function quad(a: number, b: number, c: number, x = 'x'): string {
  const terms: string[] = []
  const push = (k: number, body: string) => {
    if (k === 0) return
    const mag = body && Math.abs(k) === 1 ? '' : fmt(Math.abs(k))
    terms.push(`${k < 0 ? '-' : terms.length ? '+' : ''}${mag}${body}`)
  }
  push(a, `${x}^2`)
  push(b, x)
  push(c, '')
  return terms.length ? terms.join('') : '0'
}

// ─── Cálculo numérico ────────────────────────────────────────────────────────

/** Derivada numérica por diferencia central */
export function numDeriv(f: (x: number) => number, x: number): number {
  const h = 1e-5 * Math.max(1, Math.abs(x))
  return (f(x + h) - f(x - h)) / (2 * h)
}

/** Simpson adaptativo: preciso aun cerca de puntos donde la función crece mucho */
export function integrate(f: (x: number) => number, a: number, b: number): number {
  if (a === b) return 0
  const simpson = (fa: number, fm: number, fb: number, h: number) => (h / 6) * (fa + 4 * fm + fb)
  const rec = (a: number, b: number, fa: number, fm: number, fb: number, whole: number, tol: number, depth: number): number => {
    const m = (a + b) / 2, lm = (a + m) / 2, rm = (m + b) / 2
    const flm = f(lm), frm = f(rm)
    const left = simpson(fa, flm, fm, m - a), right = simpson(fm, frm, fb, b - m)
    if (depth <= 0 || Math.abs(left + right - whole) <= 15 * tol) return left + right + (left + right - whole) / 15
    return rec(a, m, fa, flm, fm, left, tol / 2, depth - 1) + rec(m, b, fm, frm, fb, right, tol / 2, depth - 1)
  }
  // partimos en tramos para no perder detalles de funciones que oscilan
  const n = 16
  let total = 0
  for (let i = 0; i < n; i++) {
    const x0 = a + ((b - a) * i) / n, x1 = a + ((b - a) * (i + 1)) / n
    const f0 = f(x0), f1 = f(x1), fm = f((x0 + x1) / 2)
    total += rec(x0, x1, f0, fm, f1, simpson(f0, fm, f1, x1 - x0), 1e-10, 18)
  }
  return total
}

export function sample(f: (x: number) => number, a: number, b: number, n = 240): [number, number][] {
  const out: [number, number][] = []
  for (let i = 0; i <= n; i++) {
    const x = a + ((b - a) * i) / n
    out.push([x, f(x)])
  }
  return out
}

/** Rango vertical que ignora los valores disparados cerca de una asíntota */
export function robustRange(ys: number[]): [number, number] {
  const v = ys.filter(Number.isFinite).sort((a, b) => a - b)
  if (v.length === 0) return [-1, 1]
  const q = (p: number) => v[Math.min(v.length - 1, Math.floor(p * (v.length - 1)))]
  const lo = q(0.1), hi = q(0.9), span = Math.max(hi - lo, 1e-6)
  let y0 = Math.max(v[0], lo - 1.2 * span), y1 = Math.min(v[v.length - 1], hi + 1.2 * span)
  if (y1 - y0 < 1e-6) { y0 -= 1; y1 += 1 }
  const pad = (y1 - y0) * 0.08
  return [y0 - pad, y1 + pad]
}

export const close = (a: number, b: number, tol = 1e-4) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b))

// ─── Prefijos de ids ─────────────────────────────────────────────────────────
// La página comparte el valor de un input entre pestañas con el mismo id. Cada pestaña
// de las fábricas necesita sus propios valores por defecto, así que los prefijamos.

function prefixed(prefix: string, inputs: NumberInput[]): NumberInput[] {
  return inputs.map(i => ({ ...i, id: `${prefix}.${i.id}` }))
}
function local(prefix: string, v: Values): Values {
  const out: Values = {}
  for (const k in v) if (k.startsWith(prefix + '.')) out[k.slice(prefix.length + 1)] = v[k]
  return out
}
const n = (v: Values, k: string) => v[k] as number

// ─── Fábrica: derivada evaluada en un punto ──────────────────────────────────

export interface DerivSpec {
  id: string
  label: string
  example?: string
  /** Parámetros; x0 se agrega solo */
  inputs: NumberInput[]
  x0: number
  /** y = … en LaTeX */
  fTex: (v: Values) => string
  f: (x: number, v: Values) => number
  /** Pasos simbólicos que llegan a y' y lo evalúan en x0 */
  steps: (v: Values, x0: number) => CalcStep[]
  /** y'(x0) con la fórmula del formulario */
  d: (x: number, v: Values) => number
  /** Lanza un error si x0 o los parámetros no son válidos */
  check?: (x0: number, v: Values) => void
}

interface DerivResult { y0: number; m: number; numeric: number }

export function derivCalc(s: DerivSpec): Calculator {
  const inputs = prefixed(s.id, [...s.inputs, { kind: 'number', id: 'x0', label: 'Evaluar en', symbol: 'x_0', default: s.x0 }])
  return calc<DerivResult>({
    id: s.id,
    label: s.label,
    example: s.example,
    inputs,
    compute: (raw) => {
      const v = local(s.id, raw), x0 = n(v, 'x0')
      s.check?.(x0, v)
      const y0 = s.f(x0, v), m = s.d(x0, v)
      if (!Number.isFinite(y0)) fail(`La función no está definida en $x_0=${fmt(x0)}$.`)
      if (!Number.isFinite(m)) fail(`La derivada no está definida en $x_0=${fmt(x0)}$ (la recta tangente sería vertical o no existe).`)
      return { y0, m, numeric: numDeriv(x => s.f(x, v), x0) }
    },
    steps: (raw, r) => {
      const v = local(s.id, raw), x0 = n(v, 'x0')
      return [
        ...s.steps(v, x0),
        {
          label: 'Comprobación numérica: pendiente entre dos puntos muy cercanos ($h=10^{-5}$)',
          latex: L`\frac{f(x_0+h)-f(x_0-h)}{2h}\approx${fmt(r.numeric)}`,
        },
        { label: 'Recta tangente en ese punto', latex: L`y-${fp(r.y0)}=${fp(r.m)}\,(x-${fp(x0)})` },
      ]
    },
    answer: (raw, r) => L`y'(${fmt(n(local(s.id, raw), 'x0'))})=${fmt(r.m)}`,
    extras: (raw, r) => [
      { label: 'Función', latex: `y=${s.fTex(local(s.id, raw))}` },
      { label: 'Valor de la función', latex: L`y(${fmt(n(local(s.id, raw), 'x0'))})=${fmt(r.y0)}` },
    ],
    interpret: (raw, r) => {
      const x0 = n(local(s.id, raw), 'x0')
      const deg = (Math.atan(r.m) * 180) / Math.PI
      return [
        Math.abs(r.m) < 1e-9
          ? { tone: 'good', text: `En $x=${fmt(x0)}$ la pendiente es **0**: la tangente es horizontal. Ahí puede haber un máximo, un mínimo o un punto de inflexión.` }
          : { tone: 'good', text: `En $x=${fmt(x0)}$ la función está **${r.m > 0 ? 'creciendo' : 'decreciendo'}**: por cada unidad que avanzas en $x$, $y$ ${r.m > 0 ? 'sube' : 'baja'} aproximadamente $${fmt(Math.abs(r.m))}$ unidades.` },
        { tone: 'info', text: `La recta tangente tiene una inclinación de $${fmt(deg, 2)}^\\circ$ respecto al eje $x$.` },
        close(r.m, r.numeric, 1e-3)
          ? { tone: 'info', text: `La comprobación numérica da $${fmt(r.numeric)}$: coincide con la fórmula.` }
          : { tone: 'warn', text: `La comprobación numérica da $${fmt(r.numeric)}$. Si no coincide, la función probablemente tiene un pico o un salto en ese punto.` },
      ]
    },
    visual: (raw, r) => {
      const v = local(s.id, raw), x0 = n(v, 'x0')
      const f = (x: number) => s.f(x, v)
      const w = 3
      const pts = sample(f, x0 - w, x0 + w)
      const yRange = robustRange([...pts.map(p => p[1]), r.y0])
      return {
        type: 'plot',
        curves: [
          { points: pts, tone: 'a', label: `y=${s.fTex(v)}` },
          { points: [[x0 - w, r.y0 - r.m * w], [x0 + w, r.y0 + r.m * w]], tone: 'accent', dashed: true, label: L`\text{recta tangente}` },
        ],
        marks: [{ x: x0, y: r.y0, label: `pendiente ${fmt(r.m, 3)}` }],
        xRange: [x0 - w, x0 + w],
        yRange,
        caption: 'La derivada es la **pendiente de la recta tangente**: qué tan rápido cambia $y$ justo en ese punto.',
      }
    },
  })
}

/** Caso de la regla de la cadena con u = px + q: sólo hay que describir f(u) y f'(u) */
export interface ChainSpec {
  id: string
  label: string
  example?: string
  rule: string
  extra?: NumberInput[]
  p: number
  q: number
  x0: number
  fTex: (u: string, v: Values) => string
  dTex: (u: string, v: Values) => string
  f: (u: number, v: Values) => number
  df: (u: number, v: Values) => number
  /** Error si u no está en el dominio */
  domain?: (u: number, v: Values) => string | null
}

/** Quita los paréntesis exteriores: '(2x+1)' → '2x+1' (para exponentes, raíces y fracciones) */
export function bare(u: string): string {
  if (!u.startsWith('(') || !u.endsWith(')')) return u
  let depth = 0
  for (let i = 0; i < u.length - 1; i++) {
    if (u[i] === '(') depth++
    else if (u[i] === ')') depth--
    if (depth === 0) return u
  }
  return u.slice(1, -1)
}

/**
 * u entre paréntesis salvo que sea sólo la variable: 'x', '(2x+1)', '(5)'.
 * Así fTex/dTex pueden escribir `\cos ${u}` o `${u}^2` sin preocuparse.
 */
const paren = (s: string) => (s === 'x' ? s : `(${s})`)

export function chainCalc(c: ChainSpec): Calculator {
  const uOf = (x: number, v: Values) => n(v, 'p') * x + n(v, 'q')
  return derivCalc({
    id: c.id,
    label: c.label,
    example: c.example,
    inputs: [
      { kind: 'number', id: 'p', label: 'Coeficiente de x en u', symbol: 'p', default: c.p },
      { kind: 'number', id: 'q', label: 'Término constante de u', symbol: 'q', default: c.q },
      ...(c.extra ?? []),
    ],
    x0: c.x0,
    fTex: (v) => c.fTex(paren(lin(n(v, 'p'), n(v, 'q'))), v),
    f: (x, v) => c.f(uOf(x, v), v),
    d: (x, v) => c.df(uOf(x, v), v) * n(v, 'p'),
    check: (x0, v) => {
      if (n(v, 'p') === 0) fail('Con $p=0$, $u$ es una constante y la derivada siempre es 0. Usa un valor distinto de 0.')
      const msg = c.domain?.(uOf(x0, v), v)
      if (msg) fail(msg)
    },
    steps: (v, x0) => {
      const p = n(v, 'p'), q = n(v, 'q'), u0 = uOf(x0, v)
      const U = paren(lin(p, q))
      const tail = p === 1 ? '' : L`\cdot${fp(p)}`
      return [
        { label: 'Fórmula del formulario', latex: c.rule },
        { label: 'Identificamos $u$ y su derivada', latex: L`u=${lin(p, q)}\qquad u'=${fmt(p)}` },
        { label: "Sustituimos $u$ y $u'$", latex: L`y'=${c.dTex(U, v)}${tail}` },
        { label: `Evaluamos en $x_0=${fmt(x0)}$: primero $u$`, latex: L`u=${lin(p, q, x0)}=${fmt(u0)}` },
        { label: 'Y luego la derivada', latex: L`y'(${fmt(x0)})=${c.dTex(`(${fmt(u0)})`, v)}${tail}=${fmt(c.df(u0, v) * p)}` },
      ]
    },
  })
}

// ─── Fábrica: integral definida ──────────────────────────────────────────────

export interface IntegralSpec {
  id: string
  label: string
  example?: string
  inputs: NumberInput[]
  lo: number
  hi: number
  /** Símbolo de la variable de integración (x o u) */
  dvar?: string
  fTex: (v: Values) => string
  f: (x: number, v: Values) => number
  /** Antiderivada; x puede ser la variable o un número ya sustituido */
  FTex: (x: X, v: Values) => string
  F: (x: number, v: Values) => number
  /** Pasos antes de integrar: regla del formulario, sustitución… */
  setup?: (v: Values) => CalcStep[]
  check?: (lo: number, hi: number, v: Values) => void
}

interface IntResult { exact: number; Fa: number; Fb: number; numeric: number; abs: number }

export function integralCalc(s: IntegralSpec): Calculator {
  const dv = s.dvar ?? 'x'
  const inputs = prefixed(s.id, [
    ...s.inputs,
    { kind: 'number', id: 'lo', label: 'Límite inferior', symbol: dv === 'x' ? 'a' : 'u_1', default: s.lo },
    { kind: 'number', id: 'hi', label: 'Límite superior', symbol: dv === 'x' ? 'b' : 'u_2', default: s.hi },
  ])
  const sub = (x: X) => (x === 'x' ? 'x' : x)
  return calc<IntResult>({
    id: s.id,
    label: s.label,
    example: s.example,
    inputs,
    compute: (raw) => {
      const v = local(s.id, raw), a = n(v, 'lo'), b = n(v, 'hi')
      s.check?.(a, b, v)
      const f = (x: number) => s.f(x, v)
      const bad = sample(f, a, b, 400).find(([, y]) => !Number.isFinite(y))
      if (bad) fail(`La función no está definida en todo el intervalo: falla cerca de $${dv}=${fmt(bad[0], 3)}$. Elige límites dentro de su dominio.`)
      const Fa = s.F(a, v), Fb = s.F(b, v)
      const exact = Fb - Fa
      const numeric = integrate(f, a, b)
      if (!close(exact, numeric, 1e-3)) {
        fail('La función tiene una **asíntota** (se va a infinito) dentro del intervalo, así que $F(b)-F(a)$ no aplica. Elige un intervalo donde la función sea continua.')
      }
      return { exact, Fa, Fb, numeric, abs: integrate(x => Math.abs(f(x)), a, b) }
    },
    steps: (raw, r) => {
      const v = local(s.id, raw), a = n(v, 'lo'), b = n(v, 'hi')
      return [
        ...(s.setup?.(v) ?? []),
        { label: 'Antiderivada', latex: L`\int ${s.fTex(v)}\,d${dv}=${s.FTex(sub('x'), v)}+C` },
        { label: 'Evaluamos en el límite superior', latex: L`F(${fmt(b)})=${s.FTex(b, v)}=${fmt(r.Fb)}` },
        { label: 'Evaluamos en el límite inferior', latex: L`F(${fmt(a)})=${s.FTex(a, v)}=${fmt(r.Fa)}` },
        { label: 'Teorema fundamental del cálculo: restamos (la $C$ se cancela)', latex: L`F(${fmt(b)})-F(${fmt(a)})=${fmt(r.Fb)}-${fp(r.Fa)}=${fmt(r.exact)}` },
        { label: 'Comprobación numérica (regla de Simpson)', latex: L`\int_{${fmt(a)}}^{${fmt(b)}}${s.fTex(v)}\,d${dv}\approx${fmt(r.numeric)}` },
      ]
    },
    answer: (raw, r) => {
      const v = local(s.id, raw)
      return L`\int_{${fmt(n(v, 'lo'))}}^{${fmt(n(v, 'hi'))}}${s.fTex(v)}\,d${dv}=${fmt(r.exact)}`
    },
    extras: (raw, r) => {
      const v = local(s.id, raw), a = n(v, 'lo'), b = n(v, 'hi')
      return [
        { label: 'Antiderivada', latex: `F(${dv})=${s.FTex('x', v)}` },
        ...(a !== b ? [{ label: 'Valor promedio', latex: L`\bar f=${fmt(r.exact / (b - a))}` }] : []),
        ...(!close(r.abs, Math.abs(r.exact)) ? [{ label: 'Área total (sin signo)', latex: fmt(r.abs) }] : []),
      ]
    },
    interpret: (raw, r) => {
      const v = local(s.id, raw), a = n(v, 'lo'), b = n(v, 'hi')
      const out: { tone: 'info' | 'good' | 'warn'; text: string }[] = []
      if (a > b) out.push({ tone: 'warn', text: 'El límite inferior es mayor que el superior: la integral cambia de signo, $\\int_a^b = -\\int_b^a$.' })
      if (close(r.abs, Math.abs(r.exact))) {
        out.push({ tone: 'good', text: `La curva queda ${(r.exact >= 0) === (a <= b) ? '**arriba**' : '**abajo**'} del eje en todo el intervalo, así que la integral es directamente el área: $${fmt(Math.abs(r.exact))}$ unidades².` })
      } else {
        out.push({ tone: 'warn', text: `La función cruza el eje: las partes de abajo **restan**. La integral (área con signo) es $${fmt(r.exact)}$, pero el área total pintada es $${fmt(r.abs)}$.` })
      }
      if (a !== b) out.push({ tone: 'info', text: `En promedio, la función vale $${fmt(r.exact / (b - a))}$ en ese intervalo: un rectángulo de esa altura y base $${fmt(Math.abs(b - a))}$ tiene la misma área (con signo).` })
      out.push({ tone: 'info', text: 'La “$+C$” desaparece al restar $F(b)-F(a)$: cualquier antiderivada da el mismo resultado.' })
      return out
    },
    visual: (raw) => {
      const v = local(s.id, raw), a = Math.min(n(v, 'lo'), n(v, 'hi')), b = Math.max(n(v, 'lo'), n(v, 'hi'))
      const f = (x: number) => s.f(x, v)
      const pad = Math.max((b - a) * 0.35, 0.5)
      const pts = sample(f, a - pad, b + pad)
      const inside = sample(f, a, b, 200)
      return {
        type: 'plot',
        curves: [{ points: pts, tone: 'a', label: `y=${s.fTex(v)}` }],
        areas: areasUnder(inside),
        xRange: [a - pad, b + pad],
        yRange: robustRange([...pts.map(p => p[1]), 0]),
        caption: 'El área **azul** (arriba del eje) suma y la **roja** (abajo) resta.',
      }
    },
  })
}

/** Separa el área bajo la curva en la parte positiva (azul) y la negativa (roja) */
export function areasUnder(pts: [number, number][]): PlotArea[] {
  const zero = pts.map(([x]) => [x, 0] as [number, number])
  return [
    { upper: pts.map(([x, y]) => [x, Math.max(y, 0)]), lower: zero, tone: 'a' },
    { upper: zero, lower: pts.map(([x, y]) => [x, Math.min(y, 0)]), tone: 'warn' },
  ]
}

/** Gráfica de una o varias funciones en [a, b] */
export function plotFns(fns: { f: (x: number) => number; tone: PlotCurve['tone']; label?: string; dashed?: boolean }[], a: number, b: number) {
  const curves = fns.map(g => ({ points: sample(g.f, a, b), tone: g.tone, label: g.label, dashed: g.dashed }))
  return { curves, yRange: robustRange(curves.flatMap(c => c.points.map(p => p[1]))) }
}

/** Ángulo en grados, para las calculadoras de trigonometría */
export const rad = (deg: number) => (deg * Math.PI) / 180

/** Puntos de la circunferencia unitaria */
export function unitCircle(r = 1): [number, number][] {
  return Array.from({ length: 161 }, (_, i) => {
    const t = (2 * Math.PI * i) / 160
    return [r * Math.cos(t), r * Math.sin(t)] as [number, number]
  })
}

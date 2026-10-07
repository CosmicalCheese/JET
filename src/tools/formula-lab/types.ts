/* ─── Formula Lab: data schema ───
 *
 * Tres capas separadas:
 *   formula data  →  calculation engine (compute / steps / interpret)  →  UI genérica
 *
 * Un archivo de fórmulas sólo describe contenido y matemáticas; nunca JSX.
 * Todo texto admite LaTeX inline entre $…$ y **negritas**.
 */

export type AreaId = 'matematicas' | 'calculo' | 'estadistica' | 'fisica' | 'quimica'

export type CategoryId =
  | 'algebra'
  | 'trigonometria'
  | 'vectores'
  | 'geometria'
  | 'derivadas'
  | 'integrales'
  | 'aplicaciones-integral'
  | 'probabilidad'
  | 'estadistica'
  | 'mecanica'
  | 'energia'
  | 'electricidad'
  | 'termodinamica'
  | 'ondas'
  | 'fluidos'
  | 'disoluciones'
  | 'atomica'
  | 'electroquimica'
  | 'termoquimica'

export interface Category {
  id: CategoryId
  area: AreaId
  label: string
  description: string
}

// ─── Inputs ──────────────────────────────────────────────────────────────────

interface InputBase {
  id: string
  label: string
  /** Símbolo LaTeX que aparece junto al campo */
  symbol: string
}

export interface NumberInput extends InputBase {
  kind: 'number'
  default: number
  unit?: string
  step?: number
}

export interface VectorInput extends InputBase {
  kind: 'vector'
  /** 2 o 3 componentes; la UI permite cambiar entre 2D y 3D salvo que fixedDims lo impida */
  default: number[]
  fixedDims?: number
}

export interface PairsInput extends InputBase {
  kind: 'pairs'
  xLabel: string
  yLabel: string
  default: [number, number][]
}

export interface ListInput extends InputBase {
  kind: 'list'
  default: number[]
}

export type InputDef = NumberInput | VectorInput | PairsInput | ListInput

export type InputValue = number | number[] | [number, number][]
export type Values = Record<string, InputValue>

// ─── Engine output ───────────────────────────────────────────────────────────

export interface CalcStep {
  /** Texto corto que explica qué se hace en este paso (admite $…$) */
  label?: string
  latex: string
}

export interface Interpretation {
  tone: 'info' | 'good' | 'warn'
  text: string
}

export type PlotTone = 'a' | 'b' | 'accent' | 'warn' | 'muted'
export interface PlotCurve { points: [number, number][]; tone: PlotTone; label?: string; dashed?: boolean }
/** Región entre dos poligonales con las mismas x (la de arriba y la de abajo) */
export interface PlotArea { upper: [number, number][]; lower: [number, number][]; tone: PlotTone; label?: string }
export interface PlotSegment { from: [number, number]; to: [number, number]; tone: PlotTone; label?: string; dashed?: boolean }
export interface PlotMark { x: number; y: number; tone?: PlotTone; label?: string }

export type VisualSpec =
  | { type: 'vectors'; a: number[]; b: number[] }
  /** Escena 3D que se gira arrastrando; view 'top' arranca viendo el plano xy (útil para datos 2D) */
  | { type: 'vectors3d'; mode: 'dot' | 'cross' | 'points' | 'area'; a: number[]; b: number[]; view?: 'top'; origin?: number[] }
  | { type: 'spectrum'; nm: number }
  | { type: 'levels'; ni: number; nf: number; nm: number }
  | { type: 'ph'; ph: number }
  | { type: 'regression'; points: [number, number][]; b0: number; b1: number }
  | { type: 'normal'; z: number; shade: 'left' | 'center'; label?: string }
  | { type: 'bars'; xs: number[]; ps: number[]; highlight: number }
  | { type: 'snell'; n1: number; n2: number; theta1: number; theta2: number | null }
  | { type: 'motion'; x0: number; v0: number; a: number; t: number }
  /** Plano cartesiano genérico: funciones, áreas, segmentos y puntos. `equal` no deforma (círculos, triángulos) */
  | {
    type: 'plot'
    curves?: PlotCurve[]
    areas?: PlotArea[]
    segments?: PlotSegment[]
    marks?: PlotMark[]
    xRange?: [number, number]
    yRange?: [number, number]
    equal?: boolean
    caption?: string
  }

/**
 * Una forma de usar la fórmula (p. ej. "despejar V", "despejar R").
 * `compute` produce los números; `steps` e `interpret` los presentan.
 * `compute` lanza Error con un mensaje en español si la entrada no es válida.
 */
export interface Calculator<R = unknown> {
  id: string
  label: string
  /** Qué representa el ejemplo precargado, p. ej. "luz que pasa del aire al agua" */
  example?: string
  inputs: InputDef[]
  compute: (v: Values) => R
  steps: (v: Values, r: R) => CalcStep[]
  /** Resultado final en LaTeX, p. ej. "\\vec a\\cdot\\vec b = 11" */
  answer: (v: Values, r: R) => string
  extras?: (v: Values, r: R) => { label: string; latex: string }[]
  interpret: (v: Values, r: R) => Interpretation[]
  visual?: (v: Values, r: R) => VisualSpec | undefined
  /** Enlace a la herramienta de JET con estos datos precargados */
  tryInTool?: (v: Values, r: R) => { path: string; label: string; prefill?: () => void }
}

/** Mantiene el tipo de R dentro del calculador y lo borra hacia afuera */
export function calc<R>(c: Calculator<R>): Calculator {
  return c as unknown as Calculator
}

// ─── Formula ─────────────────────────────────────────────────────────────────

export interface Formula {
  id: string
  name: string
  category: CategoryId
  /** Sección del Formulario de Ciencias Básicas ENECB 2026 */
  ref?: string
  latex: string
  forms?: { label: string; latex: string }[]
  /** Una línea: qué calcula */
  summary: string
  /** ¿Qué estamos intentando encontrar? */
  goal: string
  variables: { symbol: string; meaning: string; unit?: string }[]
  whenToUse: string[]
  intuition: string[]
  derivation?: { intro?: string; steps: CalcStep[]; outro?: string }
  calculators: Calculator[]
  commonMistakes?: string[]
  related?: string[]
  toolLink?: { path: string; label: string }
  keywords?: string[]
}

// ─── Helpers para leer valores ───────────────────────────────────────────────

export const num = (v: Values, k: string) => v[k] as number
export const vec = (v: Values, k: string) => v[k] as number[]
export const pairs = (v: Values, k: string) => v[k] as [number, number][]
export const list = (v: Values, k: string) => v[k] as number[]

export function fail(msg: string): never {
  throw new Error(msg)
}

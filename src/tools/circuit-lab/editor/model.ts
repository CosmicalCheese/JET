/* ─── Circuit Lab: documento del editor ───
 *
 * El editor guarda lo que el usuario dibujó: componentes con posición y
 * rotación sobre una cuadrícula, y cables como segmentos entre puntos de la
 * cuadrícula. La conectividad es geométrica (como en un protoboard): dos cosas
 * están unidas si comparten un punto, o si un extremo cae sobre un cable.
 *
 * `toCircuit` traduce ese dibujo al modelo del motor (engine/types.ts), que no
 * sabe nada de coordenadas.
 */

import { TERMINAL_COUNT, type Circuit, type CircuitComponent, type ComponentKind, type Wire } from '../engine/types.ts'

/** Rotación en pasos de 90° en sentido horario. */
export type Rotation = 0 | 1 | 2 | 3

export type Placed = CircuitComponent & { x: number; y: number; rot: Rotation }

/** Cable recto entre dos puntos de la cuadrícula. */
export interface Segment {
  id: string
  x1: number
  y1: number
  x2: number
  y2: number
}

export interface CircuitDoc {
  version: 1
  components: Placed[]
  wires: Segment[]
}

export interface Pt {
  x: number
  y: number
}

// ─── Geometría ───────────────────────────────────────────────────────────────

/** Medio largo de un componente de dos terminales, en celdas. */
export const HALF = 2

export function rotate(p: Pt, rot: Rotation): Pt {
  let { x, y } = p
  for (let i = 0; i < rot; i++) [x, y] = [-y, x]
  return { x: x + 0, y: y + 0 } // + 0 evita -0
}

/** Terminales en coordenadas locales (antes de rotar), en el orden del motor. */
export function localTerminals(kind: ComponentKind): Pt[] {
  switch (kind) {
    case 'ground':
      return [{ x: 0, y: 0 }]
    case 'bjt': // C, B, E
    case 'mosfet': // D, G, S
      return [{ x: 1, y: -2 }, { x: -2, y: 0 }, { x: 1, y: 2 }]
    case 'opamp': // +, −, salida
      return [{ x: -2, y: 1 }, { x: -2, y: -1 }, { x: 2, y: 0 }]
    case 'gate': // A, B, Y
      return [{ x: -2, y: -1 }, { x: -2, y: 1 }, { x: 2, y: 0 }]
    case 'logic-input':
    case 'clock': // salida a la derecha
      return [{ x: 2, y: 0 }]
    case 'probe': // entrada a la izquierda
      return [{ x: -2, y: 0 }]
    case 'dff': // D, CLK, Q, Q̄
      return [{ x: -2, y: -1 }, { x: -2, y: 1 }, { x: 2, y: -1 }, { x: 2, y: 1 }]
    default:
      return [{ x: -HALF, y: 0 }, { x: HALF, y: 0 }]
  }
}

/** Caja del cuerpo en coordenadas locales (celdas): [x0, y0, x1, y1]. Para seleccionar y resaltar. */
export function bodyBox(kind: ComponentKind): [number, number, number, number] {
  switch (kind) {
    case 'ground': return [-0.8, -0.3, 0.8, 1.4]
    case 'bjt':
    case 'mosfet':
    case 'opamp':
    case 'gate': return [-1.6, -1.6, 1.6, 1.6]
    case 'dff': return [-1.4, -2, 1.4, 2]
    case 'logic-input':
    case 'clock': return [-1.3, -1, 1.3, 1]
    case 'probe': return [-1.3, -1, 1, 1]
    default: return [-(HALF - 0.4), -1, HALF - 0.4, 1]
  }
}

export function terminalPoints(c: Placed): Pt[] {
  return localTerminals(c.kind).map((p) => {
    const r = rotate(p, c.rot)
    return { x: c.x + r.x, y: c.y + r.y }
  })
}

export const keyOf = (p: Pt) => `${p.x},${p.y}`

/** ¿p está sobre el segmento (extremos incluidos)? */
export function onSegment(p: Pt, s: Segment): boolean {
  const cross = (s.x2 - s.x1) * (p.y - s.y1) - (s.y2 - s.y1) * (p.x - s.x1)
  if (cross !== 0) return false
  return (
    p.x >= Math.min(s.x1, s.x2) && p.x <= Math.max(s.x1, s.x2) &&
    p.y >= Math.min(s.y1, s.y2) && p.y <= Math.max(s.y1, s.y2)
  )
}

/** Ruta en L entre dos puntos de la cuadrícula. */
export function route(a: Pt, b: Pt): Pt[] {
  if (a.x === b.x || a.y === b.y) return [a, b]
  const corner = Math.abs(b.x - a.x) >= Math.abs(b.y - a.y) ? { x: b.x, y: a.y } : { x: a.x, y: b.y }
  return [a, corner, b]
}

/** Tramo de un segmento entre dos puntos de conexión; es un cable del motor. */
export interface Piece {
  segment: string
  a: Pt
  b: Pt
}

export interface Translation {
  circuit: Circuit
  /** Cable del motor → tramo dibujado (para animar la corriente). */
  pieces: Map<string, Piece>
}

export function toCircuit(doc: CircuitDoc): Translation {
  const segments = doc.wires.filter((s) => s.x1 !== s.x2 || s.y1 !== s.y2)

  // Puntos donde algo se conecta.
  const points = new Map<string, Pt>()
  const terminalsAt = new Map<string, { component: string; terminal: number }[]>()
  for (const c of doc.components) {
    terminalPoints(c).forEach((p, terminal) => {
      const k = keyOf(p)
      points.set(k, p)
      if (!terminalsAt.has(k)) terminalsAt.set(k, [])
      terminalsAt.get(k)!.push({ component: c.id, terminal })
    })
  }
  for (const s of segments) {
    points.set(keyOf({ x: s.x1, y: s.y1 }), { x: s.x1, y: s.y1 })
    points.set(keyOf({ x: s.x2, y: s.y2 }), { x: s.x2, y: s.y2 })
  }

  const wires: Wire[] = []
  const pieces = new Map<string, Piece>()
  const junctions = new Set<string>()

  // Cada segmento se parte en los puntos de conexión que caen sobre él.
  for (const s of segments) {
    const along = (p: Pt) => Math.abs(p.x - s.x1) + Math.abs(p.y - s.y1)
    const stops = [...points.values()].filter((p) => onSegment(p, s)).sort((p, q) => along(p) - along(q))
    for (let i = 0; i + 1 < stops.length; i++) {
      const a = stops[i]
      const b = stops[i + 1]
      const id = `${s.id}#${i}`
      wires.push({ id, a: { junction: keyOf(a) }, b: { junction: keyOf(b) } })
      pieces.set(id, { segment: s.id, a, b })
      junctions.add(keyOf(a))
      junctions.add(keyOf(b))
    }
  }

  // Terminales que tocan un cable o a otro terminal.
  for (const [k, terms] of terminalsAt) {
    if (!junctions.has(k) && terms.length < 2) continue
    for (const t of terms) {
      wires.push({ id: `${t.component}:${t.terminal}`, a: t, b: { junction: k } })
    }
  }

  const components = doc.components.map(stripLayout)
  return { circuit: { components, wires }, pieces }
}

function stripLayout(p: Placed): CircuitComponent {
  const c: Partial<Placed> = { ...p }
  delete c.x
  delete c.y
  delete c.rot
  return c as CircuitComponent
}

// ─── Edición ─────────────────────────────────────────────────────────────────

/**
 * Reemplaza un componente (movido, rotado o con otro valor). Los extremos de
 * cable que tocaban sus terminales se mueven con ellos para no desconectarse.
 */
export function replaceComponent(doc: CircuitDoc, next: Placed): CircuitDoc {
  const prev = doc.components.find((c) => c.id === next.id)
  if (!prev) return doc
  const from = terminalPoints(prev)
  const to = terminalPoints(next)
  const follow = (x: number, y: number): Pt => {
    const i = from.findIndex((p) => p.x === x && p.y === y)
    return i >= 0 ? to[i] : { x, y }
  }
  const wires = doc.wires
    .map((w) => {
      const a = follow(w.x1, w.y1)
      const b = follow(w.x2, w.y2)
      return { ...w, x1: a.x, y1: a.y, x2: b.x, y2: b.y }
    })
    .filter((w) => w.x1 !== w.x2 || w.y1 !== w.y2)
  return { ...doc, components: doc.components.map((c) => (c.id === next.id ? next : c)), wires }
}

// ─── Creación ────────────────────────────────────────────────────────────────

export const ID_PREFIX: Record<ComponentKind, string> = {
  resistor: 'R',
  'voltage-source': 'V',
  'current-source': 'I',
  ground: 'GND',
  switch: 'S',
  voltmeter: 'VM',
  ammeter: 'A',
  capacitor: 'C',
  inductor: 'L',
  diode: 'D',
  led: 'LED',
  zener: 'DZ',
  'ac-source': 'V',
  bjt: 'Q',
  mosfet: 'M',
  opamp: 'U',
  gate: 'G',
  not: 'N',
  'logic-input': 'IN',
  clock: 'CLK',
  probe: 'P',
  dff: 'FF',
}

export function nextId(taken: Iterable<string>, prefix: string): string {
  const used = new Set(taken)
  for (let n = 1; ; n++) if (!used.has(`${prefix}${n}`)) return `${prefix}${n}`
}

export function createComponent(kind: ComponentKind, id: string, at: Pt, rot: Rotation = 0): Placed {
  const base = { id, x: at.x, y: at.y, rot }
  switch (kind) {
    case 'resistor': return { ...base, kind, resistance: 1000 }
    case 'voltage-source': return { ...base, kind, voltage: 9 }
    case 'current-source': return { ...base, kind, current: 0.01 }
    case 'switch': return { ...base, kind, closed: true }
    case 'ground': return { ...base, kind }
    case 'voltmeter': return { ...base, kind }
    case 'ammeter': return { ...base, kind }
    case 'capacitor': return { ...base, kind, capacitance: 100e-6 }
    case 'inductor': return { ...base, kind, inductance: 1 }
    case 'diode': return { ...base, kind }
    case 'led': return { ...base, kind, color: 'red' }
    case 'zener': return { ...base, kind, zenerVoltage: 5.1 }
    case 'ac-source': return { ...base, kind, amplitude: 5, frequency: 60, offset: 0, phase: 0 }
    case 'bjt': return { ...base, kind, polarity: 'npn', beta: 100 }
    case 'mosfet': return { ...base, kind, polarity: 'n', threshold: 2, k: 0.1 }
    case 'opamp': return { ...base, kind, saturation: 12 }
    case 'gate': return { ...base, kind, op: 'and' }
    case 'not': return { ...base, kind }
    case 'logic-input': return { ...base, kind, high: false }
    case 'clock': return { ...base, kind, frequency: 1 }
    case 'probe': return { ...base, kind }
    case 'dff': return { ...base, kind }
  }
}

/** Polilínea → un segmento por tramo, con ids sacados de `ids`. */
export function polyline(ids: { next: () => string }, ...pts: [number, number][]): Segment[] {
  const out: Segment[] = []
  for (let i = 0; i + 1 < pts.length; i++) {
    const [x1, y1] = pts[i]
    const [x2, y2] = pts[i + 1]
    out.push({ id: ids.next(), x1, y1, x2, y2 })
  }
  return out
}

export function wireIds(doc: Pick<CircuitDoc, 'wires'>) {
  let n = doc.wires.reduce((max, w) => Math.max(max, Number(w.id.replace(/^w/, '')) || 0), 0)
  return { next: () => `w${++n}` }
}

export function emptyDoc(): CircuitDoc {
  return { version: 1, components: [], wires: [] }
}

/** Valida (por encima) un JSON importado. */
export function isCircuitDoc(value: unknown): value is CircuitDoc {
  const v = value as CircuitDoc
  return (
    !!v && v.version === 1 && Array.isArray(v.components) && Array.isArray(v.wires) &&
    v.components.every((c) => typeof c.id === 'string' && c.kind in TERMINAL_COUNT && Number.isFinite(c.x) && Number.isFinite(c.y) && [0, 1, 2, 3].includes(c.rot)) &&
    v.wires.every((w) => typeof w.id === 'string' && [w.x1, w.y1, w.x2, w.y2].every(Number.isFinite))
  )
}

/* ─── Lógica digital ───
 *
 * Los componentes digitales viven dentro del mismo simulador analógico:
 *   - Entradas: alta impedancia (10 MΩ a GND, así una entrada al aire lee 0).
 *     Un voltaje mayor a 2.5 V es un 1.
 *   - Salidas: una fuente de 0 o 5 V con 25 Ω en serie, referida a GND (ahí
 *     está la alimentación). Pueden encender un LED, y dos salidas en corto
 *     no rompen el cálculo.
 *
 * Cada salida se calcula con las entradas del paso de tiempo anterior: es un
 * retardo de propagación de un paso. Así los lazos de realimentación
 * (flip-flops hechos con compuertas, osciladores) funcionan sin trucos.
 */

import type { CircuitComponent, DCSolution, GateOp, ReactiveState } from './types.ts'

export const VDD = 5
export const V_THRESHOLD = VDD / 2
export const R_OUT = 25
export const G_IN = 1e-7

export type DigitalComponent = Extract<CircuitComponent, { kind: 'gate' | 'not' | 'logic-input' | 'clock' | 'probe' | 'dff' }>

export function isDigital(c: CircuitComponent): c is DigitalComponent {
  return c.kind === 'gate' || c.kind === 'not' || c.kind === 'logic-input' || c.kind === 'clock' ||
    c.kind === 'probe' || c.kind === 'dff'
}

/** Qué terminales son entradas y cuáles salidas. */
export function digitalPins(c: DigitalComponent): { inputs: number[]; outputs: number[] } {
  switch (c.kind) {
    case 'gate': return { inputs: [0, 1], outputs: [2] }
    case 'not': return { inputs: [0], outputs: [1] }
    case 'logic-input':
    case 'clock': return { inputs: [], outputs: [0] }
    case 'probe': return { inputs: [0], outputs: [] }
    case 'dff': return { inputs: [0, 1], outputs: [2, 3] }
  }
}

export function applyOp(op: GateOp, a: number, b: number): number {
  switch (op) {
    case 'and': return a & b
    case 'or': return a | b
    case 'xor': return a ^ b
    case 'nand': return 1 - (a & b)
    case 'nor': return 1 - (a | b)
    case 'xnor': return 1 - (a ^ b)
  }
}

export const levelOf = (v: number) => (v > V_THRESHOLD ? 1 : 0)

export function clockLevel(frequency: number, t: number): number {
  return Math.floor(2 * frequency * t + 1e-9) % 2
}

/** Nivel (0/1) de cada salida en este instante, según el estado lógico guardado. */
export function outputLevels(c: DigitalComponent, logic: ReactiveState, time: number): number[] {
  switch (c.kind) {
    case 'logic-input': return [c.high ? 1 : 0]
    case 'clock': return [clockLevel(c.frequency, time)]
    case 'gate': return [logic[`${c.id}#y`] ?? applyOp(c.op, 0, 0)]
    case 'not': return [logic[`${c.id}#y`] ?? 1]
    case 'dff': {
      const q = logic[`${c.id}#q`] ?? 0
      return [q, 1 - q]
    }
    case 'probe': return []
  }
}

/** Estado lógico para el siguiente paso, a partir de los voltajes recién resueltos. */
export function nextLogic(components: CircuitComponent[], sol: DCSolution, prev: ReactiveState): ReactiveState {
  const next: ReactiveState = {}
  const input = (c: CircuitComponent, t: number) => levelOf(sol.netVoltages[sol.terminalNets[c.id][t]])
  for (const c of components) {
    if (c.kind === 'gate') next[`${c.id}#y`] = applyOp(c.op, input(c, 0), input(c, 1))
    else if (c.kind === 'not') next[`${c.id}#y`] = 1 - input(c, 0)
    else if (c.kind === 'dff') {
      const clk = input(c, 1)
      const before = prev[`${c.id}#clk`] ?? clk
      let q = prev[`${c.id}#q`] ?? 0
      if (before === 0 && clk === 1) q = input(c, 0) // flanco de subida: Q copia D
      next[`${c.id}#q`] = q
      next[`${c.id}#clk`] = clk
    }
  }
  return next
}

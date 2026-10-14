/* ─── Simulación en el tiempo ───
 *
 * Cada paso resuelve el circuito con los modelos compañeros de capacitores y
 * bobinas (ver dc.ts) y guarda el nuevo voltaje / corriente de cada uno.
 * Euler implícito: estable con cualquier dt (no explota al abrir o cerrar un
 * switch), con un error pequeño si dt ≪ τ.
 */

import { solveCircuit } from './dc.ts'
import type { Circuit, CircuitComponent, DCResult, ReactiveState } from './types.ts'

export function isReactive(c: CircuitComponent): boolean {
  return c.kind === 'capacitor' || c.kind === 'inductor'
}

/** Cambia con el tiempo: hay que simular paso a paso. */
export function isDynamic(c: CircuitComponent): boolean {
  return isReactive(c) || c.kind === 'ac-source'
}

export interface StepResult {
  result: DCResult
  /** Estado tras el paso. Si el circuito no tiene solución, se conserva el anterior. */
  state: ReactiveState
}

/**
 * Avanza un paso `dt` hasta el instante `time` (el final del paso, porque
 * Euler implícito evalúa ahí las fuentes).
 */
export function transientStep(circuit: Circuit, state: ReactiveState, dt: number, time = 0): StepResult {
  // El estado también guarda los voltajes de control de diodos y transistores
  // (claves "id#k"): son el mejor punto de partida para Newton-Raphson.
  const result = solveCircuit(circuit, { kind: 'transient', dt, state, guess: state, time })
  if (!result.ok) return { result, state }
  const next: ReactiveState = { ...result.guess }
  for (const c of circuit.components) {
    if (c.kind === 'inductor') next[c.id] = result.components[c.id].current
    else if (c.kind === 'capacitor') next[c.id] = result.components[c.id].voltage
  }
  return { result, state: next }
}

/** Avanza `steps` pasos de `dt` desde t = `t0`. Útil en tests y para adelantar la simulación. */
export function simulate(circuit: Circuit, state: ReactiveState, dt: number, steps: number, t0 = 0): StepResult {
  let out: StepResult = { result: { ok: false, issues: [] }, state }
  for (let k = 0; k < steps; k++) out = transientStep(circuit, out.state, dt, t0 + (k + 1) * dt)
  return out
}

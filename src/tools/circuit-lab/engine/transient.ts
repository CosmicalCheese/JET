/* ─── Simulación en el tiempo ───
 *
 * Cada paso resuelve el circuito con los modelos compañeros de capacitores y
 * bobinas (ver dc.ts) y guarda el nuevo voltaje / corriente de cada uno.
 * Euler implícito: estable con cualquier dt (no explota al abrir o cerrar un
 * switch), con un error pequeño si dt ≪ τ.
 */

import { solveCircuit } from './dc.ts'
import { isDiodeLike } from './diode.ts'
import type { Circuit, CircuitComponent, DCResult, ReactiveState } from './types.ts'

export function isReactive(c: CircuitComponent): boolean {
  return c.kind === 'capacitor' || c.kind === 'inductor'
}

export interface StepResult {
  result: DCResult
  /** Estado tras el paso. Si el circuito no tiene solución, se conserva el anterior. */
  state: ReactiveState
}

export function transientStep(circuit: Circuit, state: ReactiveState, dt: number): StepResult {
  // El estado también guarda el voltaje de cada diodo: es el mejor punto de
  // partida para Newton-Raphson en el paso siguiente.
  const result = solveCircuit(circuit, { kind: 'transient', dt, state, guess: state })
  if (!result.ok) return { result, state }
  const next: ReactiveState = {}
  for (const c of circuit.components) {
    if (c.kind === 'inductor') next[c.id] = result.components[c.id].current
    else if (c.kind === 'capacitor' || isDiodeLike(c)) next[c.id] = result.components[c.id].voltage
  }
  return { result, state: next }
}

/** Avanza `steps` pasos de `dt`. Útil en tests y para adelantar la simulación. */
export function simulate(circuit: Circuit, state: ReactiveState, dt: number, steps: number): StepResult {
  let out: StepResult = { result: { ok: false, issues: [] }, state }
  for (let k = 0; k < steps; k++) out = transientStep(circuit, out.state, dt)
  return out
}

/* ─── Circuit Lab: modelo de datos ───
 *
 * El motor no sabe nada de geometría ni de UI: un circuito es una lista de
 * componentes y una lista de cables que unen sus terminales. El editor
 * guardará posición/rotación aparte y convertirá su dibujo a este modelo.
 *
 * Unidades SI en todo el motor: V, A, Ω, W.
 *
 * Convención de signos (pasiva) para cualquier componente de 2 terminales:
 *   voltage = V(terminal 0) − V(terminal 1)
 *   current = corriente que entra por el terminal 0, atraviesa el componente
 *             y sale por el terminal 1
 *   power   = voltage · current   (>0 absorbe, <0 entrega energía)
 */

export type ComponentKind =
  | 'resistor'
  | 'voltage-source'
  | 'current-source'
  | 'ground'
  | 'switch'
  | 'voltmeter'
  | 'ammeter'
  | 'capacitor'
  | 'inductor'
  | 'diode'
  | 'led'
  | 'zener'

interface ComponentBase {
  id: string
}

export interface Resistor extends ComponentBase {
  kind: 'resistor'
  /** Ω, > 0 */
  resistance: number
}

/** Terminal 0 = positivo (+), terminal 1 = negativo (−). */
export interface VoltageSource extends ComponentBase {
  kind: 'voltage-source'
  /** V */
  voltage: number
}

/** Empuja `current` amperes fuera del terminal 0 hacia el circuito externo. */
export interface CurrentSource extends ComponentBase {
  kind: 'current-source'
  /** A */
  current: number
}

/** Un solo terminal (0), fijado a 0 V. Todos los GND son el mismo nodo. */
export interface Ground extends ComponentBase {
  kind: 'ground'
}

/** Cerrado se comporta como un cable ideal; abierto, como nada. */
export interface Switch extends ComponentBase {
  kind: 'switch'
  closed: boolean
}

/** Ideal (resistencia infinita). Lee V(terminal 0) − V(terminal 1). */
export interface Voltmeter extends ComponentBase {
  kind: 'voltmeter'
}

/** Ideal (resistencia cero). Lee la corriente del terminal 0 al 1. */
export interface Ammeter extends ComponentBase {
  kind: 'ammeter'
}

/** Guarda energía en el campo eléctrico: i = C·dV/dt. Voltaje = V(0) − V(1). */
export interface Capacitor extends ComponentBase {
  kind: 'capacitor'
  /** F, > 0 */
  capacitance: number
}

/** Bobina: guarda energía en el campo magnético: V = L·di/dt. Corriente del terminal 0 al 1. */
export interface Inductor extends ComponentBase {
  kind: 'inductor'
  /** H, > 0 */
  inductance: number
}

/** Diodo de silicio. Terminal 0 = ánodo, terminal 1 = cátodo (la barra). */
export interface Diode extends ComponentBase {
  kind: 'diode'
}

export type LedColor = 'red' | 'yellow' | 'green' | 'blue' | 'white'

/** LED: un diodo que emite luz. Terminal 0 = ánodo, 1 = cátodo. */
export interface Led extends ComponentBase {
  kind: 'led'
  color: LedColor
}

/** Zener: conduce en inversa al llegar a `zenerVoltage`. Terminal 0 = ánodo, 1 = cátodo. */
export interface Zener extends ComponentBase {
  kind: 'zener'
  /** V, > 0 */
  zenerVoltage: number
}

export type CircuitComponent =
  | Resistor
  | VoltageSource
  | CurrentSource
  | Ground
  | Switch
  | Voltmeter
  | Ammeter
  | Capacitor
  | Inductor
  | Diode
  | Led
  | Zener

/** Extremo de un cable: el terminal de un componente o una unión libre. */
export type Endpoint =
  | { component: string; terminal: number }
  | { junction: string }

/** Cable ideal (0 Ω). Su corriente positiva va de `a` hacia `b`. */
export interface Wire {
  id: string
  a: Endpoint
  b: Endpoint
}

export interface Circuit {
  components: CircuitComponent[]
  wires: Wire[]
}

// ─── Resultados ──────────────────────────────────────────────────────────────

export interface ComponentState {
  voltage: number
  current: number
  power: number
}

export type IssueCode =
  | 'invalid-value'
  | 'unknown-endpoint'
  | 'duplicate-id'
  | 'short-circuit'
  | 'source-loop'
  | 'current-source-open'
  | 'floating'
  | 'singular'
  | 'no-convergence'

export interface CircuitIssue {
  code: IssueCode
  /** Mensaje para el usuario (español). */
  message: string
  /** Componentes o cables involucrados, para resaltarlos en el editor. */
  ids: string[]
}

export interface DCSolution {
  ok: true
  /** Voltaje de cada nodo eléctrico (net), relativo a GND. */
  netVoltages: number[]
  /** Net de cada terminal: terminalNets[componentId][terminal]. */
  terminalNets: Record<string, number[]>
  /** Net de cada unión libre. */
  junctionNets: Record<string, number>
  components: Record<string, ComponentState>
  /** Corriente por cable, positiva de `a` hacia `b`. */
  wireCurrents: Record<string, number>
  /** Avisos no fatales (p. ej. partes flotantes sin referencia a GND). */
  warnings: CircuitIssue[]
}

export interface DCFailure {
  ok: false
  issues: CircuitIssue[]
}

export type DCResult = DCSolution | DCFailure

export const TERMINAL_COUNT: Record<ComponentKind, number> = {
  resistor: 2,
  'voltage-source': 2,
  'current-source': 2,
  ground: 1,
  switch: 2,
  voltmeter: 2,
  ammeter: 2,
  capacitor: 2,
  inductor: 2,
  diode: 2,
  led: 2,
  zener: 2,
}

// ─── Simulación en el tiempo ─────────────────────────────────────────────────

/** Lo que "recuerdan" los elementos reactivos: voltaje de cada capacitor y corriente de cada bobina. */
export type ReactiveState = Record<string, number>

/** Voltaje inicial de cada diodo para Newton-Raphson (normalmente, el de la solución anterior). */
export type DiodeGuess = Record<string, number>

/**
 * dc: régimen permanente (capacitor = abierto, bobina = cable).
 * transient: un paso de tiempo `dt` partiendo de `state`.
 */
export type SolveMode =
  | { kind: 'dc'; guess?: DiodeGuess }
  | { kind: 'transient'; dt: number; state: ReactiveState; guess?: DiodeGuess }

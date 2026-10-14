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
  | 'ac-source'
  | 'bjt'
  | 'mosfet'
  | 'opamp'

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

/**
 * Fuente senoidal: V(t) = offset + amplitude · sen(2π·frequency·t + phase).
 * Terminal 0 = +, terminal 1 = −.
 */
export interface AcSource extends ComponentBase {
  kind: 'ac-source'
  /** V pico */
  amplitude: number
  /** Hz, > 0 */
  frequency: number
  /** V */
  offset: number
  /** grados */
  phase: number
}

/** Transistor bipolar. Terminales: 0 = colector, 1 = base, 2 = emisor. */
export interface Bjt extends ComponentBase {
  kind: 'bjt'
  polarity: 'npn' | 'pnp'
  /** Ganancia de corriente β = Ic/Ib en zona activa, > 0 */
  beta: number
}

/** MOSFET de enriquecimiento. Terminales: 0 = drenador, 1 = compuerta, 2 = fuente. */
export interface Mosfet extends ComponentBase {
  kind: 'mosfet'
  polarity: 'n' | 'p'
  /** Voltaje de umbral |Vth| (V), > 0 */
  threshold: number
  /** Transconductancia k (A/V²): Id = k/2 · (Vgs − Vth)² en saturación, > 0 */
  k: number
}

/**
 * Amplificador operacional (ganancia 10⁵, se satura en ±saturation).
 * Terminales: 0 = entrada + (no inversora), 1 = entrada − (inversora), 2 = salida.
 * La salida se mide respecto a GND: la alimentación está implícita.
 */
export interface OpAmp extends ComponentBase {
  kind: 'opamp'
  /** V, > 0 */
  saturation: number
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
  | AcSource
  | Bjt
  | Mosfet
  | OpAmp

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
  /** 2 terminales: V(0) − V(1). Transistor: V_CE o V_DS. Op-amp: V_salida respecto a GND. */
  voltage: number
  /** 2 terminales: del terminal 0 al 1. Transistor: I_C o I_D. Op-amp: corriente que entrega la salida. */
  current: number
  power: number
  /** Corriente que entra al componente por cada terminal. */
  terminalCurrents: number[]
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
  | 'needs-ground'

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
  /** Net de GND, o null si no hay. */
  groundNet: number | null
  /** Voltajes de control de los dispositivos no lineales (punto de partida del siguiente cálculo). */
  guess: DiodeGuess
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
  'ac-source': 2,
  bjt: 3,
  mosfet: 3,
  opamp: 3,
}

// ─── Simulación en el tiempo ─────────────────────────────────────────────────

/** Lo que "recuerdan" los elementos reactivos: voltaje de cada capacitor y corriente de cada bobina. */
export type ReactiveState = Record<string, number>

/**
 * Punto de partida de Newton-Raphson para cada dispositivo no lineal
 * (normalmente, la solución anterior). Claves "id#k": k-ésimo voltaje de control.
 */
export type DiodeGuess = Record<string, number>

/**
 * dc: régimen permanente (capacitor = abierto, bobina = cable).
 * transient: un paso de tiempo `dt` partiendo de `state`.
 */
export type SolveMode =
  | { kind: 'dc'; guess?: DiodeGuess; time?: number }
  /** `time`: instante al final del paso (para las fuentes que dependen del tiempo). */
  | { kind: 'transient'; dt: number; state: ReactiveState; guess?: DiodeGuess; time?: number }

import type { ComponentKind, GateOp, LedColor } from '../engine/types.ts'

/** Letra de los instrumentos: va fuera del grupo rotado para no girar. */
export const METER_LETTER: Partial<Record<ComponentKind, string>> = { voltmeter: 'V', ammeter: 'A' }

export const KIND_LABEL: Record<ComponentKind, string> = {
  resistor: 'Resistencia',
  'voltage-source': 'Batería / fuente DC',
  'current-source': 'Fuente de corriente',
  ground: 'Tierra (GND)',
  switch: 'Interruptor',
  voltmeter: 'Voltímetro',
  ammeter: 'Amperímetro',
  capacitor: 'Capacitor',
  inductor: 'Bobina (inductor)',
  diode: 'Diodo',
  led: 'LED',
  zener: 'Diodo Zener',
  'ac-source': 'Fuente AC (senoidal)',
  bjt: 'Transistor BJT',
  mosfet: 'Transistor MOSFET',
  opamp: 'Amplificador operacional',
  gate: 'Compuerta lógica',
  not: 'Inversor (NOT)',
  'logic-input': 'Entrada lógica (0/1)',
  clock: 'Reloj',
  probe: 'Sonda lógica',
  dff: 'Flip-flop D',
}

export const GATE_NAME: Record<GateOp, string> = {
  and: 'AND', or: 'OR', xor: 'XOR', nand: 'NAND', nor: 'NOR', xnor: 'XNOR',
}

/** Nombre de cada terminal (para 3 terminales). */
export const TERMINAL_NAMES: Partial<Record<ComponentKind, string[]>> = {
  bjt: ['C', 'B', 'E'],
  mosfet: ['D', 'G', 'S'],
  opamp: ['+', '−', 'salida'],
  gate: ['A', 'B', 'Y'],
  not: ['A', 'Y'],
  'logic-input': ['salida'],
  clock: ['salida'],
  probe: ['entrada'],
  dff: ['D', 'CLK', 'Q', 'Q̄'],
}

export const LED_NAME: Record<LedColor, string> = {
  red: 'rojo',
  yellow: 'amarillo',
  green: 'verde',
  blue: 'azul',
  white: 'blanco',
}

/** Color de la luz (para el brillo en el lienzo). */
export const LED_HEX: Record<LedColor, string> = {
  red: '#ef4444',
  yellow: '#facc15',
  green: '#22c55e',
  blue: '#3b82f6',
  white: '#a5b4fc',
}

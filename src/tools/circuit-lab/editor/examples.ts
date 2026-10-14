/* ─── Circuitos de ejemplo ───
 * Coordenadas en celdas de la cuadrícula. Una batería con rot 1 queda vertical
 * con el + arriba; una resistencia con rot 1 tiene el terminal 0 arriba.
 */

import { createComponent, polyline, type CircuitDoc, type Placed } from './model.ts'

function counter() {
  let n = 0
  return { next: () => `w${++n}` }
}

function ohm(): CircuitDoc {
  const w = counter()
  const V1 = createComponent('voltage-source', 'V1', { x: 0, y: 0 }, 1)
  const R1 = createComponent('resistor', 'R1', { x: 10, y: 0 }, 1)
  const A1 = createComponent('ammeter', 'A1', { x: 5, y: -4 }, 0)
  if (V1.kind === 'voltage-source') V1.voltage = 10
  return {
    version: 1,
    components: [V1, R1, A1, createComponent('ground', 'GND1', { x: 0, y: 4 })],
    wires: [
      ...polyline(w, [0, -2], [0, -4], [3, -4]),
      ...polyline(w, [7, -4], [10, -4], [10, -2]),
      ...polyline(w, [0, 2], [0, 4], [10, 4], [10, 2]),
    ],
  }
}

function divider(): CircuitDoc {
  const w = counter()
  const V1 = createComponent('voltage-source', 'V1', { x: 0, y: 0 }, 1)
  if (V1.kind === 'voltage-source') V1.voltage = 12
  const R2 = createComponent('resistor', 'R2', { x: 10, y: 3 }, 1)
  if (R2.kind === 'resistor') R2.resistance = 2000
  return {
    version: 1,
    components: [
      V1,
      createComponent('resistor', 'R1', { x: 10, y: -3 }, 1),
      R2,
      createComponent('voltmeter', 'VM1', { x: 16, y: 3 }, 1),
      createComponent('ground', 'GND1', { x: 0, y: 6 }),
    ],
    wires: [
      ...polyline(w, [0, -2], [0, -6], [10, -6], [10, -5]),
      ...polyline(w, [10, -1], [10, 1]),
      ...polyline(w, [10, 0], [16, 0], [16, 1]),
      ...polyline(w, [0, 2], [0, 6], [10, 6], [10, 5]),
      ...polyline(w, [10, 6], [16, 6], [16, 5]),
    ],
  }
}

function parallel(): CircuitDoc {
  const w = counter()
  const V1 = createComponent('voltage-source', 'V1', { x: 0, y: 2 }, 1)
  if (V1.kind === 'voltage-source') V1.voltage = 6
  const R1 = createComponent('resistor', 'R1', { x: 10, y: 4 }, 1)
  const R2 = createComponent('resistor', 'R2', { x: 18, y: 4 }, 1)
  if (R1.kind === 'resistor') R1.resistance = 3000
  if (R2.kind === 'resistor') R2.resistance = 6000
  return {
    version: 1,
    components: [
      V1, R1, R2,
      createComponent('ammeter', 'A1', { x: 10, y: -1 }, 1),
      createComponent('ammeter', 'A2', { x: 18, y: -1 }, 1),
      createComponent('ground', 'GND1', { x: 0, y: 8 }),
    ],
    wires: [
      ...polyline(w, [0, 0], [0, -5], [18, -5], [18, -3]),
      ...polyline(w, [10, -5], [10, -3]),
      ...polyline(w, [10, 1], [10, 2]),
      ...polyline(w, [18, 1], [18, 2]),
      ...polyline(w, [0, 4], [0, 8], [18, 8], [18, 6]),
      ...polyline(w, [10, 8], [10, 6]),
    ],
  }
}

function switchLamp(): CircuitDoc {
  const w = counter()
  const V1 = createComponent('voltage-source', 'V1', { x: 0, y: 0 }, 1)
  if (V1.kind === 'voltage-source') V1.voltage = 5
  const R1 = createComponent('resistor', 'R1', { x: 10, y: 0 }, 1)
  if (R1.kind === 'resistor') R1.resistance = 100
  const S1 = createComponent('switch', 'S1', { x: 5, y: -4 }, 0)
  if (S1.kind === 'switch') S1.closed = false
  return {
    version: 1,
    components: [V1, R1, S1, createComponent('ammeter', 'A1', { x: 5, y: 4 }, 2), createComponent('ground', 'GND1', { x: 0, y: 4 })],
    wires: [
      ...polyline(w, [0, -2], [0, -4], [3, -4]),
      ...polyline(w, [7, -4], [10, -4], [10, -2]),
      ...polyline(w, [10, 2], [10, 4], [7, 4]),
      ...polyline(w, [3, 4], [0, 4], [0, 2]),
    ],
  }
}

function rc(): CircuitDoc {
  const w = counter()
  const V1 = createComponent('voltage-source', 'V1', { x: 0, y: 0 }, 1)
  if (V1.kind === 'voltage-source') V1.voltage = 10
  const S2 = createComponent('switch', 'S2', { x: 20, y: -1 }, 1)
  if (S2.kind === 'switch') S2.closed = false
  return {
    version: 1,
    components: [
      V1,
      createComponent('switch', 'S1', { x: 4, y: -4 }, 0),
      createComponent('resistor', 'R1', { x: 10, y: -4 }, 0),
      createComponent('capacitor', 'C1', { x: 14, y: 0 }, 1),
      S2,
      createComponent('resistor', 'R2', { x: 20, y: 3 }, 1),
      createComponent('ground', 'GND1', { x: 0, y: 4 }),
    ],
    wires: [
      ...polyline(w, [0, -2], [0, -4], [2, -4]),
      ...polyline(w, [6, -4], [8, -4]),
      ...polyline(w, [12, -4], [14, -4], [14, -2]),
      ...polyline(w, [14, 2], [14, 4], [0, 4], [0, 2]),
      ...polyline(w, [14, -4], [20, -4], [20, -3]),
      ...polyline(w, [20, 5], [20, 6], [14, 6], [14, 4]),
    ],
  }
}

function rl(): CircuitDoc {
  const w = counter()
  const V1 = createComponent('voltage-source', 'V1', { x: 0, y: 0 }, 1)
  if (V1.kind === 'voltage-source') V1.voltage = 10
  const R1 = createComponent('resistor', 'R1', { x: 10, y: -4 }, 0)
  if (R1.kind === 'resistor') R1.resistance = 100
  return {
    version: 1,
    components: [
      V1,
      createComponent('switch', 'S1', { x: 4, y: -4 }, 0),
      R1,
      createComponent('inductor', 'L1', { x: 14, y: 0 }, 1),
      createComponent('resistor', 'R2', { x: 20, y: 0 }, 1),
      createComponent('ground', 'GND1', { x: 0, y: 4 }),
    ],
    wires: [
      ...polyline(w, [0, -2], [0, -4], [2, -4]),
      ...polyline(w, [6, -4], [8, -4]),
      ...polyline(w, [12, -4], [14, -4], [14, -2]),
      ...polyline(w, [14, 2], [14, 4], [0, 4], [0, 2]),
      ...polyline(w, [14, -4], [20, -4], [20, -2]),
      ...polyline(w, [20, 2], [20, 4], [14, 4]),
    ],
  }
}

function led(): CircuitDoc {
  const w = counter()
  const R1 = createComponent('resistor', 'R1', { x: 5, y: -4 }, 0)
  if (R1.kind === 'resistor') R1.resistance = 330
  return {
    version: 1,
    components: [
      createComponent('voltage-source', 'V1', { x: 0, y: 0 }, 1),
      R1,
      createComponent('led', 'LED1', { x: 10, y: 0 }, 1),
      createComponent('ground', 'GND1', { x: 0, y: 4 }),
    ],
    wires: [
      ...polyline(w, [0, -2], [0, -4], [3, -4]),
      ...polyline(w, [7, -4], [10, -4], [10, -2]),
      ...polyline(w, [10, 2], [10, 4], [0, 4], [0, 2]),
    ],
  }
}

function zener(): CircuitDoc {
  const w = counter()
  const V1 = createComponent('voltage-source', 'V1', { x: 0, y: 0 }, 1)
  if (V1.kind === 'voltage-source') V1.voltage = 12
  const R1 = createComponent('resistor', 'R1', { x: 5, y: -4 }, 0)
  if (R1.kind === 'resistor') R1.resistance = 470
  return {
    version: 1,
    components: [
      V1,
      R1,
      // rot 3: cátodo (terminal 1) arriba → polarizado en inversa
      createComponent('zener', 'DZ1', { x: 10, y: 0 }, 3),
      createComponent('resistor', 'RL', { x: 16, y: 0 }, 1),
      createComponent('voltmeter', 'VM1', { x: 21, y: 0 }, 1),
      createComponent('ground', 'GND1', { x: 0, y: 4 }),
    ],
    wires: [
      ...polyline(w, [0, -2], [0, -4], [3, -4]),
      ...polyline(w, [7, -4], [10, -4], [10, -2]),
      ...polyline(w, [10, -4], [16, -4], [16, -2]),
      ...polyline(w, [16, -4], [21, -4], [21, -2]),
      ...polyline(w, [0, 2], [0, 4], [21, 4], [21, 2]),
      ...polyline(w, [10, 4], [10, 2]),
      ...polyline(w, [16, 4], [16, 2]),
    ],
  }
}

function set<K extends Placed['kind']>(c: Placed, kind: K, patch: Partial<Extract<Placed, { kind: K }>>): Placed {
  return c.kind === kind ? ({ ...c, ...patch } as Placed) : c
}

function halfWave(): CircuitDoc {
  const w = counter()
  return {
    version: 1,
    components: [
      set(createComponent('ac-source', 'V1', { x: 0, y: 0 }, 1), 'ac-source', { amplitude: 10, frequency: 60 }),
      createComponent('diode', 'D1', { x: 5, y: -4 }, 0),
      createComponent('resistor', 'RL', { x: 10, y: 0 }, 1),
      createComponent('ground', 'GND1', { x: 0, y: 4 }),
    ],
    wires: [
      ...polyline(w, [0, -2], [0, -4], [3, -4]),
      ...polyline(w, [7, -4], [10, -4], [10, -2]),
      ...polyline(w, [10, 2], [10, 4], [0, 4], [0, 2]),
    ],
  }
}

/**
 * Puente de diodos: D1 y D2 llevan los dos lados de la fuente al + de la
 * carga; D3 y D4 regresan desde GND. S1 conecta el capacitor de filtro.
 */
function fullWave(): CircuitDoc {
  const w = counter()
  return {
    version: 1,
    components: [
      set(createComponent('ac-source', 'V1', { x: 0, y: 0 }, 1), 'ac-source', { amplitude: 12, frequency: 60 }),
      createComponent('diode', 'D1', { x: 6, y: -6 }, 0),
      createComponent('diode', 'D3', { x: 6, y: -2 }, 2),
      createComponent('diode', 'D4', { x: 6, y: 2 }, 2),
      createComponent('diode', 'D2', { x: 6, y: 6 }, 0),
      createComponent('resistor', 'RL', { x: 16, y: 0 }, 1),
      set(createComponent('switch', 'S1', { x: 20, y: -6 }, 0), 'switch', { closed: false }),
      set(createComponent('capacitor', 'C1', { x: 24, y: 0 }, 1), 'capacitor', { capacitance: 470e-6 }),
      createComponent('ground', 'GND1', { x: 16, y: 4 }),
    ],
    wires: [
      ...polyline(w, [0, -2], [0, -6], [4, -6]),
      ...polyline(w, [4, -6], [4, -2]),
      ...polyline(w, [0, 2], [0, 6], [4, 6]),
      ...polyline(w, [4, 2], [4, 6]),
      ...polyline(w, [8, -6], [16, -6], [16, -2]),
      ...polyline(w, [8, 6], [12, 6], [12, -6]),
      ...polyline(w, [8, -2], [8, 2], [16, 2]),
      ...polyline(w, [16, 2], [16, 4]),
      ...polyline(w, [16, -6], [18, -6]),
      ...polyline(w, [22, -6], [24, -6], [24, -2]),
      ...polyline(w, [24, 2], [24, 4], [16, 4]),
    ],
  }
}

/** Transistor como interruptor: S1 da corriente de base y el LED enciende. */
function transistorSwitch(kind: 'bjt' | 'mosfet'): CircuitDoc {
  const w = counter()
  const Q = kind === 'bjt'
    ? createComponent('bjt', 'Q1', { x: 11, y: 7 }, 0)
    : createComponent('mosfet', 'M1', { x: 11, y: 7 }, 0)
  const base = kind === 'bjt'
    ? [set(createComponent('resistor', 'RB', { x: 6, y: 7 }, 0), 'resistor', { resistance: 10e3 })]
    // Resistencia pull-down: con S1 abierto descarga la compuerta y el MOSFET se apaga.
    : [set(createComponent('resistor', 'RG', { x: 6, y: 9 }, 1), 'resistor', { resistance: 100e3 })]
  return {
    version: 1,
    components: [
      createComponent('voltage-source', 'V1', { x: 0, y: 0 }, 1),
      set(createComponent('resistor', 'RC', { x: 12, y: -4 }, 1), 'resistor', { resistance: 330 }),
      set(createComponent('led', 'LED1', { x: 12, y: 2 }, 1), 'led', { color: 'green' }),
      Q,
      ...base,
      set(createComponent('switch', 'S1', { x: 3, y: 2 }, 1), 'switch', { closed: false }),
      createComponent('ground', 'GND1', { x: 0, y: 12 }),
    ],
    wires: [
      ...polyline(w, [0, -2], [0, -6], [12, -6]),
      ...polyline(w, [12, -2], [12, 0]),
      ...polyline(w, [12, 4], [12, 5]),
      ...polyline(w, [3, 0], [3, -6]),
      ...(kind === 'bjt'
        ? [...polyline(w, [3, 4], [3, 7], [4, 7]), ...polyline(w, [8, 7], [9, 7])]
        : [...polyline(w, [3, 4], [3, 7], [9, 7]), ...polyline(w, [6, 11], [6, 12])]),
      ...polyline(w, [12, 9], [12, 12], [0, 12], [0, 2]),
    ],
  }
}

/** Amplificador inversor: ganancia −RF/RIN = −10, con una señal AC de entrada. */
function invertingAmp(): CircuitDoc {
  const w = counter()
  return {
    version: 1,
    components: [
      set(createComponent('ac-source', 'V1', { x: 0, y: 2 }, 1), 'ac-source', { amplitude: 0.5, frequency: 100 }),
      createComponent('resistor', 'RIN', { x: 8, y: 0 }, 0),
      set(createComponent('resistor', 'RF', { x: 14, y: -4 }, 0), 'resistor', { resistance: 10e3 }),
      createComponent('opamp', 'U1', { x: 14, y: 1 }, 0),
      set(createComponent('resistor', 'RL', { x: 22, y: 3 }, 1), 'resistor', { resistance: 10e3 }),
      createComponent('ground', 'GND1', { x: 0, y: 6 }),
    ],
    wires: [
      ...polyline(w, [0, 0], [6, 0]),
      ...polyline(w, [10, 0], [12, 0]),
      ...polyline(w, [12, 0], [12, -4]),
      ...polyline(w, [16, -4], [18, -4], [18, 1]),
      ...polyline(w, [16, 1], [22, 1]),
      ...polyline(w, [12, 2], [12, 6]),
      ...polyline(w, [0, 4], [0, 6], [22, 6], [22, 5]),
    ],
  }
}

export interface Example {
  id: string
  name: string
  description: string
  build: () => CircuitDoc
  /** Componentes que se grafican al cargar el ejemplo. */
  traces?: string[]
}

export const EXAMPLES: Example[] = [
  { id: 'ohm', name: 'Ley de Ohm', description: '10 V sobre 1 kΩ, con amperímetro en serie.', build: ohm },
  { id: 'divisor', name: 'Divisor de voltaje', description: '12 V repartidos entre 1 kΩ y 2 kΩ.', build: divider },
  { id: 'paralelo', name: 'Resistencias en paralelo', description: 'La corriente se reparte: más por la rama de menor resistencia.', build: parallel },
  { id: 'switch', name: 'Interruptor', description: 'Ciérralo (doble clic) para que circule corriente.', build: switchLamp },
  {
    id: 'led', name: 'LED con resistencia',
    description: '9 V, 330 Ω y un LED rojo: unos 21 mA. Baja la resistencia para ver qué pasa.', build: led,
  },
  {
    id: 'zener', name: 'Regulador Zener',
    description: 'La carga recibe ≈ 5.1 V aunque cambies V1: el Zener absorbe la diferencia.', build: zener,
  },
  {
    id: 'media-onda', name: 'Rectificador de media onda',
    description: 'El diodo deja pasar solo los semiciclos positivos de la AC.', build: halfWave, traces: ['V1', 'RL'],
  },
  {
    id: 'onda-completa', name: 'Rectificador de onda completa (puente)',
    description: 'Los dos semiciclos llegan positivos a la carga. Cierra S1 para filtrar con el capacitor.',
    build: fullWave, traces: ['V1', 'RL'],
  },
  {
    id: 'bjt', name: 'Transistor BJT como interruptor',
    description: 'Cierra S1: una corriente de base pequeña enciende el LED.', build: () => transistorSwitch('bjt'),
  },
  {
    id: 'mosfet', name: 'MOSFET como interruptor',
    description: 'Cierra S1: el voltaje en la compuerta enciende el LED sin tomar corriente.', build: () => transistorSwitch('mosfet'),
  },
  {
    id: 'inversor', name: 'Amplificador inversor (op-amp)',
    description: 'Ganancia −RF/RIN = −10: la salida es la entrada invertida y 10 veces mayor.',
    build: invertingAmp, traces: ['V1', 'U1'],
  },
  {
    id: 'rc', name: 'Carga y descarga de un capacitor',
    description: 'τ = RC = 100 ms. Abre S1 y cierra S2 para descargarlo.', build: rc, traces: ['C1'],
  },
  {
    id: 'rl', name: 'Circuito RL',
    description: 'Al cerrar S1 la corriente sube con τ ≈ 11 ms; al abrirlo la bobina sigue empujando corriente por R2.', build: rl, traces: ['L1'],
  },
]

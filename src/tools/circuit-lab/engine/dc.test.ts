import { test } from 'node:test'
import assert from 'node:assert/strict'
import { solveDC } from './dc.ts'
import type { Circuit, CircuitComponent, DCResult, DCSolution, Endpoint, IssueCode } from './types.ts'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const R = (id: string, resistance: number): CircuitComponent => ({ id, kind: 'resistor', resistance })
const V = (id: string, voltage: number): CircuitComponent => ({ id, kind: 'voltage-source', voltage })
const I = (id: string, current: number): CircuitComponent => ({ id, kind: 'current-source', current })
const GND = (id = 'GND'): CircuitComponent => ({ id, kind: 'ground' })
const SW = (id: string, closed: boolean): CircuitComponent => ({ id, kind: 'switch', closed })
const VM = (id: string): CircuitComponent => ({ id, kind: 'voltmeter' })
const AM = (id: string): CircuitComponent => ({ id, kind: 'ammeter' })

/** "R1.0" → terminal 0 de R1; "*n" → unión libre n. */
function ep(s: string): Endpoint {
  if (s.startsWith('*')) return { junction: s.slice(1) }
  const [component, terminal] = s.split('.')
  return { component, terminal: Number(terminal) }
}

/** Cables w1, w2… en el orden dado. */
function circuit(components: CircuitComponent[], wires: [string, string][]): Circuit {
  return { components, wires: wires.map(([a, b], i) => ({ id: `w${i + 1}`, a: ep(a), b: ep(b) })) }
}

function solved(result: DCResult): DCSolution {
  if (!result.ok) assert.fail(`se esperaba solución, hubo: ${result.issues.map((i) => i.message).join(' | ')}`)
  return result
}

function failsWith(result: DCResult, code: IssueCode): string[] {
  assert.equal(result.ok, false, 'se esperaba que el solver rechazara el circuito')
  if (result.ok) return []
  const issue = result.issues.find((i) => i.code === code)
  assert.ok(issue, `se esperaba ${code}, hubo: ${result.issues.map((i) => i.code).join(', ')}`)
  return issue.ids
}

const close = (actual: number, expected: number, label = '') =>
  assert.ok(
    Math.abs(actual - expected) <= 1e-9 * Math.max(1, Math.abs(expected)),
    `${label} esperado ${expected}, obtenido ${actual}`,
  )

/** Batería V1 (+ arriba) con GND en el negativo; `top` es lo que va al +. */
function battery(volts: number, top: [string, string][], bottom: [string, string][], extra: CircuitComponent[]) {
  return circuit(
    [V('V1', volts), GND(), ...extra],
    [['V1.1', 'GND.0'], ...top, ...bottom],
  )
}

// ─── Ley de Ohm y divisores ──────────────────────────────────────────────────

test('ley de Ohm: 10 V sobre 1 kΩ → 10 mA', () => {
  const s = solved(solveDC(battery(10, [['V1.0', 'R1.0']], [['R1.1', 'V1.1']], [R('R1', 1000)])))
  close(s.components.R1.voltage, 10)
  close(s.components.R1.current, 0.01)
  close(s.components.R1.power, 0.1)
  // La fuente entrega (potencia negativa) exactamente lo que disipa R1.
  close(s.components.V1.current, -0.01)
  close(s.components.V1.power, -0.1)
})

test('divisor 12 V, R1 = 1 kΩ, R2 = 2 kΩ → Vout = 8 V, I = 4 mA', () => {
  const s = solved(
    solveDC(
      battery(
        12,
        [['V1.0', 'R1.0'], ['R1.1', '*out'], ['*out', 'R2.0']],
        [['R2.1', 'GND.0']],
        [R('R1', 1000), R('R2', 2000)],
      ),
    ),
  )
  close(s.netVoltages[s.junctionNets.out], 8)
  close(s.components.R1.current, 0.004)
  close(s.components.R1.voltage, 4)
  close(s.components.R1.power, 0.016)
  close(s.components.R2.voltage, 8)
})

test('divisor simétrico 10 V, 1 kΩ / 1 kΩ → 5 V', () => {
  const s = solved(
    solveDC(
      battery(10, [['V1.0', 'R1.0'], ['R1.1', 'R2.0']], [['R2.1', 'GND.0']], [R('R1', 1000), R('R2', 1000)]),
    ),
  )
  close(s.netVoltages[s.terminalNets.R2[0]], 5)
})

test('resistencias en paralelo: 6 V sobre 3 kΩ ∥ 6 kΩ = 2 kΩ → 3 mA', () => {
  const s = solved(
    solveDC(
      battery(
        6,
        [['V1.0', '*top'], ['*top', 'R1.0'], ['*top', 'R2.0']],
        [['R1.1', '*bot'], ['R2.1', '*bot'], ['*bot', 'GND.0']],
        [R('R1', 3000), R('R2', 6000)],
      ),
    ),
  )
  close(s.components.R1.current, 0.002)
  close(s.components.R2.current, 0.001)
  close(s.components.V1.current, -0.003)
  // El cable que alimenta la unión lleva la suma; los de cada rama, su parte.
  close(s.wireCurrents.w2, 0.003, 'cable V1→top')
  close(s.wireCurrents.w3, 0.002, 'cable top→R1')
  close(s.wireCurrents.w4, 0.001, 'cable top→R2')
})

test('puente de Wheatstone desbalanceado (comparado con análisis a mano)', () => {
  // 10 V; rama izquierda R1=1k (arriba) R2=2k (abajo); derecha R3=3k, R4=4k; Rg=500 Ω entre medios.
  const s = solved(
    solveDC(
      battery(
        10,
        [['V1.0', 'R1.0'], ['V1.0', 'R3.0'], ['R1.1', '*a'], ['R2.0', '*a'], ['R3.1', '*b'], ['R4.0', '*b'],
          ['Rg.0', '*a'], ['Rg.1', '*b']],
        [['R2.1', 'GND.0'], ['R4.1', 'GND.0']],
        [R('R1', 1000), R('R2', 2000), R('R3', 3000), R('R4', 4000), R('Rg', 500)],
      ),
    ),
  )
  // Nodal a mano:
  //   a: (Va−10)/1k + Va/2k + (Va−Vb)/0.5k = 0
  //   b: (Vb−10)/3k + Vb/4k + (Vb−Va)/0.5k = 0
  // → Va = 780/121 ≈ 6.4463, Vb = 760/121 ≈ 6.2810
  const Va = s.netVoltages[s.junctionNets.a]
  const Vb = s.netVoltages[s.junctionNets.b]
  close(Va, 780 / 121, 'Va')
  close(Vb, 760 / 121, 'Vb')
  close(s.components.Rg.current, (Va - Vb) / 500)
})

test('fuente de corriente: 2 mA en 1 kΩ → 2 V', () => {
  const s = solved(
    solveDC(circuit([I('I1', 0.002), R('R1', 1000), GND()], [['I1.0', 'R1.0'], ['R1.1', 'GND.0'], ['I1.1', 'GND.0']])),
  )
  close(s.components.R1.voltage, 2)
  close(s.components.R1.current, 0.002)
  // Convención pasiva: la fuente entrega potencia.
  close(s.components.I1.power, -0.004)
})

// ─── Instrumentos y switch ───────────────────────────────────────────────────

test('voltímetro y amperímetro ideales no alteran el circuito', () => {
  const s = solved(
    solveDC(
      battery(
        9,
        [['V1.0', 'A1.0'], ['A1.1', 'R1.0'], ['R1.1', 'R2.0'], ['VM1.0', 'R2.0'], ['VM1.1', 'R2.1']],
        [['R2.1', 'GND.0']],
        [AM('A1'), R('R1', 1000), R('R2', 2000), VM('VM1')],
      ),
    ),
  )
  close(s.components.A1.current, 0.003)
  close(s.components.A1.voltage, 0)
  close(s.components.VM1.voltage, 6)
  close(s.components.VM1.current, 0)
})

test('switch abierto corta la corriente; cerrado la deja pasar', () => {
  const build = (closed: boolean) =>
    battery(5, [['V1.0', 'S1.0'], ['S1.1', 'R1.0']], [['R1.1', 'GND.0']], [SW('S1', closed), R('R1', 100)])

  const open = solved(solveDC(build(false)))
  close(open.components.R1.current, 0)
  close(open.components.S1.voltage, 5, 'el switch abierto ve todo el voltaje')

  const closed = solved(solveDC(build(true)))
  close(closed.components.R1.current, 0.05)
  close(closed.components.S1.current, 0.05)
  close(closed.components.S1.voltage, 0)
})

test('GND no acumula corriente y el cable de retorno lleva la de R1', () => {
  const s = solved(solveDC(battery(10, [['V1.0', 'R1.0']], [['R1.1', 'GND.0']], [R('R1', 1000)])))
  // Con un solo GND, su terminal no lleva corriente: el retorno va por cables a la batería.
  close(s.components.GND.current, 0)
  close(s.wireCurrents.w3, 0.01, 'R1 → GND')
})

// ─── Errores y avisos ────────────────────────────────────────────────────────

test('cable directo entre los bornes de la batería → cortocircuito', () => {
  const ids = failsWith(solveDC(battery(5, [['V1.0', 'V1.1']], [], [])), 'short-circuit')
  assert.deepEqual(ids, ['V1'])
})

test('dos fuentes distintas en paralelo → lazo de fuentes', () => {
  const ids = failsWith(
    solveDC(circuit([V('V1', 5), V('V2', 3), GND()], [['V1.0', 'V2.0'], ['V1.1', 'V2.1'], ['V1.1', 'GND.0']])),
    'source-loop',
  )
  assert.deepEqual(ids.sort(), ['V1', 'V2'])
})

test('amperímetro conectado directo a la batería (en paralelo) → lazo de fuentes', () => {
  failsWith(solveDC(battery(5, [['V1.0', 'A1.0']], [['A1.1', 'GND.0']], [AM('A1')])), 'source-loop')
})

test('fuente de corriente sin camino de retorno', () => {
  failsWith(
    solveDC(circuit([I('I1', 0.001), R('R1', 1000), GND()], [['I1.0', 'R1.0'], ['I1.1', 'GND.0']])),
    'current-source-open',
  )
})

test('valores inválidos y extremos inexistentes', () => {
  failsWith(solveDC(battery(5, [['V1.0', 'R1.0']], [['R1.1', 'GND.0']], [R('R1', 0)])), 'invalid-value')
  failsWith(solveDC(battery(5, [['V1.0', 'R9.0']], [], [])), 'unknown-endpoint')
  failsWith(solveDC(battery(5, [['V1.0', 'V1.2']], [], [])), 'unknown-endpoint')
  failsWith(solveDC(circuit([R('X', 1), R('X', 2)], [])), 'duplicate-id')
})

test('sin GND: resuelve con referencia automática y avisa', () => {
  const s = solved(
    solveDC(circuit([V('V1', 10), R('R1', 1000)], [['V1.0', 'R1.0'], ['R1.1', 'V1.1']])),
  )
  close(s.components.R1.current, 0.01)
  close(s.components.R1.voltage, 10)
  assert.equal(s.warnings.length, 1)
  assert.equal(s.warnings[0].code, 'floating')
})

test('parte flotante junto a un circuito aterrizado', () => {
  const s = solved(
    solveDC(
      circuit(
        [V('V1', 10), R('R1', 1000), GND(), R('R2', 1000), VM('VM1')],
        [['V1.0', 'R1.0'], ['R1.1', 'V1.1'], ['V1.1', 'GND.0'], ['VM1.0', 'V1.0'], ['VM1.1', 'R2.0']],
      ),
    ),
  )
  close(s.components.R1.current, 0.01)
  assert.equal(s.warnings.length, 1)
  assert.deepEqual(s.warnings[0].ids.sort(), ['R2', 'VM1'])
})

test('lazo de cables ideales no rompe el solver', () => {
  // Dos cables en paralelo entre V1+ y R1: la corriente se asigna a uno solo.
  const s = solved(
    solveDC(battery(10, [['V1.0', 'R1.0'], ['V1.0', 'R1.0']], [['R1.1', 'GND.0']], [R('R1', 1000)])),
  )
  close(s.components.R1.current, 0.01)
  close(s.wireCurrents.w2 + s.wireCurrents.w3, 0.01)
})

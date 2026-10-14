import { useState } from 'react'
import { LineChart, Trash2, ToggleLeft, ToggleRight, MousePointerClick } from 'lucide-react'
import { cn } from '../../lib/utils'
import { Tex } from '../formula-lab/Tex'
import { FormulaLink } from '../formula-lab/FormulaLink'
import type { Circuit, ComponentState, DCResult, DCSolution } from './engine/types.ts'
import { firstOrder, nodeBalance, parallelGroup, seriesChain } from './engine/analysis.ts'
import { isReactive } from './engine/transient.ts'
import { keyOf, type CircuitDoc, type Placed, type Translation } from './editor/model.ts'
import { KIND_LABEL, LED_NAME } from './editor/labels.ts'
import { LED_VF } from './engine/diode.ts'
import type { LedColor } from './engine/types.ts'
import { formatSI, parseSI } from './editor/units.ts'
import type { Selection } from './editor/CircuitCanvas.tsx'

/** 0.004, 'A' → "4\ \mathrm{mA}" */
function siTex(value: number, unit: string): string {
  const [num, rest = ''] = formatSI(value, unit).split(' ')
  return `${num}\\ \\mathrm{${rest.replace('µ', '\\mu ').replace('Ω', '\\Omega')}}`
}

interface Props {
  doc: CircuitDoc
  translation: Translation
  result: DCResult
  selection: Selection
  onChange: (next: Placed, coalesceKey?: string) => void
  onDelete: () => void
  traces: string[]
  onToggleTrace: (id: string) => void
}

export function Inspector({ doc, translation, result, selection, onChange, onDelete, traces, onToggleTrace }: Props) {
  if (selection?.type === 'component') {
    const c = doc.components.find((k) => k.id === selection.id)
    if (c) {
      return (
        <ComponentPanel key={c.id} c={c} circuit={translation.circuit} result={result} onChange={onChange}
          onDelete={onDelete} traced={traces.includes(c.id)} onToggleTrace={() => onToggleTrace(c.id)} />
      )
    }
  }
  if (selection?.type === 'wire') {
    return <WirePanel id={selection.id} translation={translation} result={result} onDelete={onDelete} />
  }
  return <Help />
}

// ─── Componente ──────────────────────────────────────────────────────────────

function ComponentPanel({ c, circuit, result, onChange, onDelete, traced, onToggleTrace }: {
  c: Placed
  circuit: Circuit
  result: DCResult
  onChange: Props['onChange']
  onDelete: () => void
  traced: boolean
  onToggleTrace: () => void
}) {
  const state = result.ok ? result.components[c.id] : undefined

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs text-zinc-400 font-medium">{KIND_LABEL[c.kind]}</p>
          <h3 className="text-lg font-bold text-zinc-900">{c.id}</h3>
        </div>
        <div className="flex items-center gap-1">
          {c.kind !== 'ground' && (
            <button onClick={onToggleTrace} title={traced ? 'Quitar de las gráficas' : 'Graficar V(t) e I(t)'}
              className={cn('p-2 rounded-lg', traced ? 'text-blue-600 bg-blue-50' : 'text-zinc-400 hover:text-blue-600 hover:bg-blue-50')}>
              <LineChart size={16} />
            </button>
          )}
          <button onClick={onDelete} title="Borrar (Supr)"
            className="p-2 rounded-lg text-zinc-400 hover:text-red-600 hover:bg-red-50">
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {c.kind === 'capacitor' && (
        <ValueEditor label="Capacitancia" unit="F" value={c.capacitance} positive
          slider={{ min: -9, max: -2, step: 0.01, toSlider: Math.log10, fromSlider: (s) => Number((10 ** s).toPrecision(3)) }}
          onChange={(capacitance) => onChange({ ...c, capacitance }, `${c.id}.value`)} />
      )}
      {c.kind === 'inductor' && (
        <ValueEditor label="Inductancia" unit="H" value={c.inductance} positive
          slider={{ min: -6, max: 1, step: 0.01, toSlider: Math.log10, fromSlider: (s) => Number((10 ** s).toPrecision(3)) }}
          onChange={(inductance) => onChange({ ...c, inductance }, `${c.id}.value`)} />
      )}
      {c.kind === 'led' && (
        <label className="block space-y-1.5">
          <span className="block text-xs font-medium text-zinc-500">Color</span>
          <select
            value={c.color}
            onChange={(e) => onChange({ ...c, color: e.target.value as LedColor })}
            className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
          >
            {(Object.keys(LED_VF) as LedColor[]).map((k) => (
              <option key={k} value={k}>{LED_NAME[k]} (≈ {LED_VF[k]} V a 20 mA)</option>
            ))}
          </select>
        </label>
      )}
      {c.kind === 'zener' && (
        <ValueEditor label="Voltaje Zener" unit="V" value={c.zenerVoltage} positive
          slider={{ min: 1, max: 30, step: 0.1 }}
          onChange={(zenerVoltage) => onChange({ ...c, zenerVoltage }, `${c.id}.value`)} />
      )}
      {c.kind === 'resistor' && (
        <ValueEditor label="Resistencia" unit="Ω" value={c.resistance} positive
          slider={{ min: 0, max: 7, step: 0.01, toSlider: Math.log10, fromSlider: (s) => Number((10 ** s).toPrecision(3)) }}
          onChange={(resistance) => onChange({ ...c, resistance }, `${c.id}.value`)} />
      )}
      {c.kind === 'voltage-source' && (
        <ValueEditor label="Voltaje" unit="V" value={c.voltage}
          slider={{ min: -24, max: 24, step: 0.5 }}
          onChange={(voltage) => onChange({ ...c, voltage }, `${c.id}.value`)} />
      )}
      {c.kind === 'current-source' && (
        <ValueEditor label="Corriente" unit="A" value={c.current}
          slider={{ min: -0.1, max: 0.1, step: 0.001 }}
          onChange={(current) => onChange({ ...c, current }, `${c.id}.value`)} />
      )}
      {c.kind === 'switch' && (
        <button
          onClick={() => onChange({ ...c, closed: !c.closed })}
          className={cn(
            'w-full inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium border',
            c.closed ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-zinc-50 border-zinc-200 text-zinc-600',
          )}
        >
          {c.closed ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
          {c.closed ? 'Cerrado — clic para abrir' : 'Abierto — clic para cerrar'}
        </button>
      )}

      {state && <Readouts c={c} state={state} />}
      {state && result.ok && <Explanation c={c} state={state} circuit={circuit} solution={result} />}
    </div>
  )
}

function Readouts({ c, state }: { c: Placed; state: ComponentState }) {
  if (c.kind === 'ground') return null
  const rows: [string, string, string?][] = []
  if (c.kind === 'voltmeter') rows.push(['Lectura', formatSI(state.voltage, 'V')])
  else if (c.kind === 'ammeter') rows.push(['Lectura', formatSI(state.current, 'A')])
  else {
    rows.push(['Voltaje', formatSI(state.voltage, 'V')])
    rows.push(['Corriente', formatSI(state.current, 'A')])
    if (c.kind !== 'switch') {
      const p = state.power
      rows.push(['Potencia', formatSI(Math.abs(p), 'W'), Math.abs(p) < 1e-12 ? undefined : p > 0 ? 'absorbe' : 'entrega'])
    }
    if (c.kind === 'capacitor') {
      rows.push(['Carga  Q = CV', formatSI(c.capacitance * state.voltage, 'C')])
      rows.push(['Energía  ½CV²', formatSI(0.5 * c.capacitance * state.voltage ** 2, 'J')])
    }
    if (c.kind === 'inductor') rows.push(['Energía  ½LI²', formatSI(0.5 * c.inductance * state.current ** 2, 'J')])
    if (c.kind === 'led') rows.push(['Brillo', `${Math.round(100 * Math.min(1, Math.max(0, state.current) / 0.02))} %`])
  }
  return (
    <dl className="rounded-xl border border-zinc-200 bg-white divide-y divide-zinc-100">
      {rows.map(([k, v, note]) => (
        <div key={k} className="flex items-baseline justify-between px-3 py-2">
          <dt className="text-xs text-zinc-500">{k}</dt>
          <dd className="text-sm font-semibold text-zinc-900 tabular-nums">
            {v} {note && <span className="text-xs font-normal text-zinc-400">({note})</span>}
          </dd>
        </div>
      ))}
    </dl>
  )
}

function box(children: React.ReactNode, title = '¿Por qué?') {
  return (
    <div className="rounded-xl border border-violet-200 bg-violet-50/60 p-3 space-y-2 text-sm text-zinc-700">
      <p className="text-xs font-semibold text-violet-700">{title}</p>
      {children}
    </div>
  )
}

const sub = (id: string) => `_{\\mathrm{${id}}}`
const joinIds = (ids: string[]) => ids.length === 1 ? ids[0] : `${ids.slice(0, -1).join(', ')} y ${ids[ids.length - 1]}`

/** Divisor de voltaje: la resistencia comparte corriente con otras en serie. */
function SeriesExplanation({ id, circuit, solution }: { id: string; circuit: Circuit; solution: DCSolution }) {
  const chain = seriesChain(circuit, solution, id)
  if (!chain) return null
  const me = chain.resistors.find((r) => r.id === id)!
  const others = chain.resistors.filter((r) => r.id !== id).map((r) => r.id)
  return (
    <div className="border-t border-violet-200 pt-2 space-y-2">
      <p>
        <strong>En serie con {joinIds(others)}:</strong> por todas pasa la misma corriente y el voltaje de la cadena
        ({formatSI(chain.voltage, 'V')}) se reparte en proporción a cada resistencia.
      </p>
      <Tex display latex={`R_{eq} = ${chain.resistors.map((r) => siTex(r.resistance, 'Ω')).join(' + ')} = ${siTex(chain.total, 'Ω')}`} />
      <Tex display latex={`V${sub(id)} = V\\,\\frac{R${sub(id)}}{R_{eq}}`} />
      <Tex display latex={`= ${siTex(chain.voltage, 'V')}\\cdot\\frac{${siTex(me.resistance, 'Ω')}}{${siTex(chain.total, 'Ω')}} = ${siTex((chain.voltage * me.resistance) / chain.total, 'V')}`} />
      <div className="flex flex-wrap gap-1.5">
        <FormulaLink id="divisor-de-voltaje" label="Divisor de voltaje" />
        <FormulaLink id="resistencias-en-serie" label="Serie" />
      </div>
    </div>
  )
}

/** La resistencia comparte voltaje con otras en paralelo; la corriente se reparte. */
function ParallelExplanation({ id, circuit, solution }: { id: string; circuit: Circuit; solution: DCSolution }) {
  const group = parallelGroup(circuit, solution, id)
  if (!group) return null
  const me = group.resistors.find((r) => r.id === id)!
  const others = group.resistors.filter((r) => r.id !== id).map((r) => r.id)
  return (
    <div className="border-t border-violet-200 pt-2 space-y-2">
      <p>
        <strong>En paralelo con {joinIds(others)}:</strong> todas tienen el mismo voltaje ({formatSI(group.voltage, 'V')})
        y la corriente se reparte: la rama de menor resistencia lleva más.
      </p>
      <Tex display latex={`\\frac{1}{R_{eq}} = ${group.resistors.map((r) => `\\frac{1}{${siTex(r.resistance, 'Ω')}}`).join(' + ')}`} />
      <Tex display latex={`R_{eq} = ${siTex(group.total, 'Ω')}`} />
      <Tex display latex={`I${sub(id)} = \\frac{V}{R${sub(id)}}`} />
      <Tex display latex={`= \\frac{${siTex(group.voltage, 'V')}}{${siTex(me.resistance, 'Ω')}} = ${siTex(me.current, 'A')}`} />
      <Tex display latex={`I = ${group.resistors.map((r) => siTex(r.current, 'A')).join(' + ')} = ${siTex(group.current, 'A')}`} />
      <div className="flex flex-wrap gap-1.5">
        <FormulaLink id="resistencias-en-paralelo" label="Paralelo" />
        <FormulaLink id="leyes-de-kirchhoff" label="Kirchhoff" />
      </div>
    </div>
  )
}

/** Diodo, LED o Zener: en qué zona está trabajando y por qué. */
function DiodeExplanation({ c, state }: { c: Placed; state: ComponentState }) {
  const { voltage: V, current: I } = state
  const conducting = I > 1e-6
  const breakdown = c.kind === 'zener' && I < -1e-6
  const typical = c.kind === 'led' ? `${LED_VF[c.color]}\\ \\mathrm{V}` : '0.7\\ \\mathrm{V}'

  return (
    <>
      <p>La corriente de un diodo crece de forma exponencial con el voltaje (ecuación de Shockley):</p>
      <Tex display latex={`I = I_s\\left(e^{V/nV_T} - 1\\right)`} />
      {conducting && (
        <>
          <p>
            <strong>Conduce</strong> (polarización directa): con {formatSI(V, 'V')} entre sus terminales deja pasar{' '}
            {formatSI(I, 'A')}. Como la curva es tan empinada, en la práctica se aproxima con una caída fija:
          </p>
          <Tex display latex={`V_D \\approx ${typical}`} />
        </>
      )}
      {breakdown && (
        <p>
          <strong>En ruptura Zener:</strong> conduce al revés ({formatSI(-I, 'A')}) y mantiene ≈{' '}
          {formatSI(-V, 'V')} entre sus terminales aunque cambie la corriente. Por eso se usa como regulador de voltaje.
        </p>
      )}
      {!conducting && !breakdown && (
        <p>
          <strong>Bloquea:</strong> {V < 0 ? 'está en polarización inversa' : 'el voltaje no alcanza para encenderlo'},
          así que casi no pasa corriente ({formatSI(I, 'A')}).
          {c.kind === 'zener' && ` En inversa empezaría a conducir al llegar a ${formatSI(c.zenerVoltage, 'V')}.`}
        </p>
      )}
      {c.kind === 'led' && conducting && I > 0.03 && (
        <p className="text-red-700">
          <strong>Demasiada corriente:</strong> un LED real se quemaría (trabajan con 10–20 mA). Pon o aumenta una
          resistencia en serie:
        </p>
      )}
      {c.kind === 'led' && <Tex display latex={`R = \\frac{V_{fuente} - V_f}{I}`} />}
      <div className="flex flex-wrap gap-1.5">
        <FormulaLink id="diodo" label="Diodos y LEDs" />
        {c.kind === 'led' && <FormulaLink id="ley-de-ohm" label="Ley de Ohm" />}
      </div>
    </>
  )
}

/** Capacitor o bobina: hacia dónde va y qué tan rápido (respuesta de primer orden). */
function ReactiveExplanation({ c, state, circuit }: { c: Placed; state: ComponentState; circuit: Circuit }) {
  const cap = c.kind === 'capacitor'
  const fo = firstOrder(circuit, c.id)
  const single = circuit.components.filter(isReactive).length === 1
  const unit = cap ? 'V' : 'A'
  const now = cap ? state.voltage : state.current
  const X = cap ? 'V_C' : 'I_L'
  const value = cap && c.kind === 'capacitor' ? siTex(c.capacitance, 'F') : c.kind === 'inductor' ? siTex(c.inductance, 'H') : ''

  return (
    <>
      <p>
        {cap
          ? 'Un capacitor no deja que su voltaje cambie de golpe: para cambiarlo hay que meterle o sacarle carga, y eso toma tiempo.'
          : 'Una bobina no deja que su corriente cambie de golpe: se opone a cualquier cambio generando un voltaje.'}
      </p>
      <Tex display latex={cap ? `i = C\\,\\frac{dV}{dt}` : `V = L\\,\\frac{di}{dt}`} />
      {fo && single && Number.isFinite(fo.tau) && fo.tau > 0 && (
        <>
          <p>
            {cap ? 'Se carga o descarga' : 'Su corriente cambia'} hacia <strong>{formatSI(fo.final, unit)}</strong> con
            una constante de tiempo:
          </p>
          <Tex display latex={cap
            ? `\\tau = R_{th}\\,C = ${siTex(fo.rth, 'Ω')}\\cdot ${value} = ${siTex(fo.tau, 's')}`
            : `\\tau = \\frac{L}{R_{th}} = \\frac{${value}}{${siTex(fo.rth, 'Ω')}} = ${siTex(fo.tau, 's')}`} />
          <Tex display latex={`${X}(t) = ${X}(\\infty) + \\big(${X}(0) - ${X}(\\infty)\\big)\\,e^{-t/\\tau}`} />
          <p>
            Ahora: <strong>{formatSI(now, unit)}</strong>
            {Math.abs(fo.final - now) <= 1e-3 * Math.max(Math.abs(fo.final), 1e-9)
              ? '; ya llegó a su valor final. '
              : `; le falta ${formatSI(Math.abs(fo.final - now), unit)} para llegar. `}
            Cada τ recorre el 63 % de lo que falta; tras 5τ = {formatSI(5 * fo.tau, 's')} prácticamente llegó.
          </p>
          <p className="text-xs text-zinc-500">
            R<sub>th</sub> es la resistencia que “ve” {c.id} con las fuentes apagadas (equivalente de Thévenin).
          </p>
        </>
      )}
      {fo && single && !Number.isFinite(fo.tau) && (
        <p>No hay ningún camino para cargarlo o descargarlo: conserva su voltaje ({formatSI(now, unit)}).</p>
      )}
      {fo && single && fo.tau === 0 && (
        <p>
          El circuito de la bobina está abierto: su corriente tendría que desaparecer de golpe, lo que produce un pico
          de voltaje enorme (la “chispa” al desconectar un motor o un relevador).
        </p>
      )}
      {!single && (
        <p className="text-xs text-zinc-500">
          Con varios capacitores o bobinas la respuesta mezcla varias constantes de tiempo; grafícalo para verla.
        </p>
      )}
      <FormulaLink id={cap ? 'circuito-rc' : 'circuito-rl'} label={cap ? 'Circuito RC' : 'Circuito RL'} />
    </>
  )
}

/** "¿Por qué?": la fórmula que explica el valor, con los números del circuito. */
function Explanation({ c, state, circuit, solution }: {
  c: Placed
  state: ComponentState
  circuit: Circuit
  solution: DCSolution
}) {
  const { voltage: V, current: I, power: P } = state

  switch (c.kind) {
    case 'resistor':
      return box(
        <>
          <Tex display latex={`V = I\\cdot R`} />
          <Tex display latex={`${siTex(V, 'V')} = ${siTex(I, 'A')}\\cdot ${siTex(c.resistance, 'Ω')}`} />
          <p>
            La corriente que pasa por {c.id} es el voltaje entre sus terminales dividido entre su resistencia.
            Esa energía se convierte en calor:
          </p>
          <Tex display latex={`P = V\\cdot I = ${siTex(P, 'W')}`} />
          <div className="flex flex-wrap gap-1.5 pt-1">
            <FormulaLink id="ley-de-ohm" label="Ley de Ohm" />
            <FormulaLink id="potencia-electrica" label="Potencia eléctrica" />
          </div>
          <SeriesExplanation id={c.id} circuit={circuit} solution={solution} />
          <ParallelExplanation id={c.id} circuit={circuit} solution={solution} />
        </>,
      )
    case 'diode':
    case 'led':
    case 'zener':
      return box(<DiodeExplanation c={c} state={state} />)
    case 'capacitor':
    case 'inductor':
      return box(<ReactiveExplanation c={c} state={state} circuit={circuit} />)
    case 'voltage-source':
      return box(
        <>
          <p>
            La batería mantiene {formatSI(c.voltage, 'V')} entre su + y su −. La corriente que entrega la decide el
            resto del circuito: con menos resistencia, más corriente.
          </p>
          <Tex display latex={`P = V\\cdot I = ${siTex(Math.abs(P), 'W')}`} />
          <p className="text-xs text-zinc-500">
            Corriente negativa = sale por el + (la batería entrega energía).
          </p>
          <FormulaLink id="potencia-electrica" label="Potencia eléctrica" />
        </>,
      )
    case 'current-source':
      return box(
        <p>
          Empuja siempre {formatSI(c.current, 'A')} por el circuito; el voltaje en sus terminales
          ({formatSI(V, 'V')}) es el que haga falta para lograrlo.
        </p>,
      )
    case 'ammeter':
      return box(
        <p>
          Se conecta <strong>en serie</strong>: la corriente tiene que atravesarlo. Es ideal (0 Ω), así que no cambia
          el circuito. Lectura positiva = la corriente entra por su +.
        </p>,
      )
    case 'voltmeter':
      return box(
        <p>
          Se conecta <strong>en paralelo</strong>: mide la diferencia de voltaje entre sus dos puntas,
          V(+) − V(−). Es ideal (resistencia infinita), así que no le quita corriente al circuito.
        </p>,
      )
    case 'switch':
      return box(
        <p>
          {c.closed
            ? `Cerrado se comporta como un cable: deja pasar ${formatSI(I, 'A')} sin caída de voltaje.`
            : `Abierto no deja pasar corriente; por eso entre sus terminales aparece ${formatSI(V, 'V')}.`}
        </p>,
      )
    case 'ground':
      return box(<p>Es el punto de referencia: 0 V. Todos los voltajes del circuito se miden respecto a él.</p>)
  }
}

interface SliderSpec {
  min: number
  max: number
  step: number
  toSlider?: (v: number) => number
  fromSlider?: (s: number) => number
}

function ValueEditor({ label, unit, value, positive, slider, onChange }: {
  label: string
  unit: string
  value: number
  positive?: boolean
  slider: SliderSpec
  onChange: (v: number) => void
}) {
  const shown = formatSI(value, unit)
  const [draft, setDraft] = useState<string | null>(null)
  const parsed = draft === null ? value : parseSI(draft)
  const invalid = draft !== null && (parsed === null || (positive && parsed <= 0))

  const commit = () => {
    if (draft !== null && !invalid && parsed !== null) onChange(parsed)
    setDraft(null)
  }
  const toS = slider.toSlider ?? ((v: number) => v)
  const fromS = slider.fromSlider ?? ((s: number) => s)

  return (
    <div className="space-y-2">
      <label className="block text-xs font-medium text-zinc-500">{label}</label>
      <input
        value={draft ?? shown}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={(e) => e.target.select()}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
          if (e.key === 'Escape') setDraft(null)
        }}
        className={cn(
          'w-full rounded-lg border bg-white px-3 py-2 text-sm font-semibold tabular-nums outline-none focus:ring-1',
          invalid ? 'border-red-300 focus:ring-red-400' : 'border-zinc-200 focus:border-blue-400 focus:ring-blue-400',
        )}
      />
      {invalid && <p className="text-xs text-red-600">Escribe un número, p. ej. 4.7k, 220, 100m.</p>}
      <input
        type="range"
        min={slider.min}
        max={slider.max}
        step={slider.step}
        value={Math.max(slider.min, Math.min(slider.max, toS(value)))}
        onChange={(e) => onChange(fromS(Number(e.target.value)))}
        className="w-full accent-blue-600"
        aria-label={`${label} (deslizador)`}
      />
    </div>
  )
}

// ─── Cable ───────────────────────────────────────────────────────────────────

function WirePanel({ id, translation, result, onDelete }: {
  id: string
  translation: Translation
  result: DCResult
  onDelete: () => void
}) {
  const pieces = [...translation.pieces.entries()].filter(([, p]) => p.segment === id)
  const v = result.ok && pieces[0] ? result.netVoltages[result.junctionNets[keyOf(pieces[0][1].a)]] : undefined
  const currents = result.ok ? pieces.map(([pid]) => Math.abs(result.wireCurrents[pid] ?? 0)) : []
  const same = currents.every((i) => Math.abs(i - currents[0]) < 1e-12)
  const net = result.ok && pieces[0] ? result.junctionNets[keyOf(pieces[0][1].a)] : undefined
  const balance = result.ok && net !== undefined ? nodeBalance(translation.circuit, result, net) : null
  const ins = balance?.flows.filter((f) => f.current > 0) ?? []
  const outs = balance?.flows.filter((f) => f.current < 0) ?? []
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs text-zinc-400 font-medium">Cable</p>
          <h3 className="text-lg font-bold text-zinc-900">{id}</h3>
        </div>
        <button onClick={onDelete} title="Borrar (Supr)"
          className="p-2 rounded-lg text-zinc-400 hover:text-red-600 hover:bg-red-50">
          <Trash2 size={16} />
        </button>
      </div>
      {v !== undefined && (
        <dl className="rounded-xl border border-zinc-200 bg-white divide-y divide-zinc-100">
          <div className="flex justify-between px-3 py-2">
            <dt className="text-xs text-zinc-500">Voltaje del nodo</dt>
            <dd className="text-sm font-semibold tabular-nums">{formatSI(v, 'V')}</dd>
          </div>
          <div className="flex justify-between px-3 py-2">
            <dt className="text-xs text-zinc-500">Corriente</dt>
            <dd className="text-sm font-semibold tabular-nums">
              {currents.length && same ? formatSI(currents[0], 'A') : 'distinta en cada tramo'}
            </dd>
          </div>
        </dl>
      )}
      <p className="text-sm text-zinc-500">
        Un cable ideal no tiene resistencia: todos sus puntos están al mismo voltaje.
      </p>
      {balance && balance.flows.length >= 3 && box(
        <>
          <p>
            Este cable es parte de un <strong>nodo</strong> donde se unen {balance.flows.length} ramas.
            La carga no se acumula: lo que entra es lo que sale.
          </p>
          <Tex display latex={`${ins.map((f) => `I${sub(f.id)}`).join(' + ')} = ${outs.map((f) => `I${sub(f.id)}`).join(' + ')}`} />
          <Tex display latex={`${ins.map((f) => siTex(f.current, 'A')).join(' + ')} = ${outs.map((f) => siTex(-f.current, 'A')).join(' + ')}`} />
          <FormulaLink id="leyes-de-kirchhoff" label="Leyes de Kirchhoff" />
        </>,
        'Ley de corrientes de Kirchhoff',
      )}
    </div>
  )
}

// ─── Ayuda ───────────────────────────────────────────────────────────────────

function Help() {
  const tips = [
    'Elige un componente en la barra y haz clic en el lienzo para colocarlo.',
    'Arrastra desde un terminal (círculo naranja) para tender un cable.',
    'Arrastra un componente para moverlo. R lo gira, Supr lo borra.',
    'Doble clic en un interruptor para abrirlo o cerrarlo.',
    'Rueda del mouse: zoom. Arrastra el fondo para desplazarte.',
  ]
  return (
    <div className="space-y-4 text-sm text-zinc-600">
      <div className="flex items-center gap-2 text-zinc-900 font-semibold">
        <MousePointerClick size={16} /> Selecciona algo para ver sus valores
      </div>
      <ul className="space-y-1.5 list-disc pl-4">
        {tips.map((t) => <li key={t}>{t}</li>)}
      </ul>
      <div className="space-y-1.5 text-xs">
        <p className="font-semibold text-zinc-500">Colores</p>
        <Legend color="rgb(22,163,74)" text="voltaje alto" />
        <Legend color="#a1a1aa" text="0 V (tierra)" />
        <Legend color="rgb(220,38,38)" text="voltaje negativo" />
        <Legend color="#facc15" text="corriente (los puntos se mueven en su sentido)" dot />
      </div>
    </div>
  )
}

function Legend({ color, text, dot }: { color: string; text: string; dot?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className={dot ? 'w-2.5 h-2.5 rounded-full' : 'w-5 h-1 rounded-full'} style={{ background: color }} />
      {text}
    </div>
  )
}

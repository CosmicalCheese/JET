import { X } from 'lucide-react'
import type { Sample } from './useSimulation.ts'
import { formatSI } from './editor/units.ts'

const W = 600
const H = 90
const V_COLOR = '#16a34a'
const I_COLOR = '#d97706'

/** Osciloscopio: V(t) e I(t) de cada componente graficado, cada una con su propia escala. */
export function Scope({ traces, samples, onRemove }: {
  traces: string[]
  samples: Sample[]
  onRemove: (id: string) => void
}) {
  if (!traces.length) return null
  const t0 = samples[0]?.t ?? 0
  const t1 = samples[samples.length - 1]?.t ?? 0
  const span = t1 - t0 || 1

  return (
    <div className="rounded-xl border border-zinc-200 bg-white divide-y divide-zinc-100">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-xs text-zinc-500">
        <span className="font-semibold text-zinc-700">Gráficas</span>
        <span className="flex items-center gap-3">
          <Swatch color={V_COLOR} label="voltaje V(t)" />
          <Swatch color={I_COLOR} label="corriente I(t)" />
          <span>últimos {formatSI(t1 - t0, 's')}</span>
        </span>
      </div>
      {traces.map((id) => {
        const pts = samples.filter((s) => s.values[id])
        const last = pts[pts.length - 1]?.values[id]
        // Una corriente de fuga (entradas lógicas, voltímetros) no aporta nada: solo se grafica el voltaje.
        const showI = pts.some((s) => Math.abs(s.values[id].i) >= 1e-6)
        return (
          <div key={id} className="px-4 py-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-zinc-800">{id}</span>
              <span className="flex items-center gap-3 tabular-nums">
                {last && <span style={{ color: V_COLOR }}>V = {formatSI(last.v, 'V')}</span>}
                {last && showI && <span style={{ color: I_COLOR }}>I = {formatSI(last.i, 'A')}</span>}
                <button onClick={() => onRemove(id)} title="Quitar gráfica"
                  className="p-1 rounded text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100">
                  <X size={13} />
                </button>
              </span>
            </div>
            <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="block w-full h-20 mt-1">
              <line x1={0} x2={W} y1={H / 2} y2={H / 2} stroke="#e4e4e7" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
              <Line pts={pts.map((s) => [(s.t - t0) / span, s.values[id].v])} color={V_COLOR} />
              {showI && <Line pts={pts.map((s) => [(s.t - t0) / span, s.values[id].i])} color={I_COLOR} />}
            </svg>
          </div>
        )
      })}
    </div>
  )
}

/** Escala simétrica alrededor de 0 para que la línea punteada sea el cero. */
function Line({ pts, color }: { pts: [number, number][]; color: string }) {
  if (pts.length < 2) return null
  const max = Math.max(1e-12, ...pts.map(([, y]) => Math.abs(y)))
  const points = pts.map(([x, y]) => `${(x * W).toFixed(1)},${(H / 2 - (y / max) * (H / 2 - 6)).toFixed(1)}`).join(' ')
  return <polyline points={points} fill="none" stroke={color} strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
}

function Swatch({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="w-4 h-0.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  )
}

import { useId } from 'react'
import type { PlotArea, PlotCurve, PlotMark, PlotSegment, PlotTone } from './types'
import { fmt, round } from './format'
import { Rich, Tex } from './Tex'

const W = 360
const H = 260
const L = 34 // espacio para las etiquetas del eje y
const B = 22 // espacio para las etiquetas del eje x
const T = 10
const R = 10

const TONE: Record<PlotTone, string> = {
  a: '#2563eb',      // blue-600
  b: '#059669',      // emerald-600
  accent: '#7c3aed', // violet-600
  warn: '#e11d48',   // rose-600
  muted: '#a1a1aa',  // zinc-400
}
const C = { axis: '#a1a1aa', grid: '#f4f4f5', text: '#71717a' }

function niceTicks(min: number, max: number, count = 6): number[] {
  const span = max - min || 1
  const step0 = span / count
  const mag = 10 ** Math.floor(Math.log10(step0))
  const step = [1, 2, 5, 10].map(m => m * mag).find(s => s >= step0) ?? step0
  const out: number[] = []
  for (let t = Math.ceil(min / step) * step; t <= max + step * 1e-9; t += step) out.push(round(t, 10))
  return out
}

interface Props {
  curves?: PlotCurve[]
  areas?: PlotArea[]
  segments?: PlotSegment[]
  marks?: PlotMark[]
  xRange?: [number, number]
  yRange?: [number, number]
  equal?: boolean
  caption?: string
}

export function PlotVisual({ curves = [], areas = [], segments = [], marks = [], xRange, yRange, equal, caption }: Props) {
  const uid = useId().replace(/:/g, '')

  // ── Rango de los datos ──
  const pts: [number, number][] = [
    ...curves.flatMap(c => c.points),
    ...areas.flatMap(a => [...a.upper, ...a.lower]),
    ...segments.flatMap(s => [s.from, s.to]),
    ...marks.map(m => [m.x, m.y] as [number, number]),
  ].filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y))
  if (pts.length === 0) return null

  let [x0, x1] = xRange ?? [Math.min(...pts.map(p => p[0])), Math.max(...pts.map(p => p[0]))]
  let [y0, y1] = yRange ?? [Math.min(...pts.map(p => p[1])), Math.max(...pts.map(p => p[1]))]
  if (x1 - x0 < 1e-9) { x0 -= 1; x1 += 1 }
  if (y1 - y0 < 1e-9) { y0 -= 1; y1 += 1 }
  if (!xRange) { const d = (x1 - x0) * 0.04; x0 -= d; x1 += d }
  if (!yRange) { const d = (y1 - y0) * 0.08; y0 -= d; y1 += d }

  // escala uniforme (para círculos y triángulos) o independiente en cada eje
  let sx = (W - L - R) / (x1 - x0), sy = (H - T - B) / (y1 - y0)
  let ox = L, oy = T
  if (equal) {
    const s = Math.min(sx, sy)
    ox = L + ((W - L - R) - s * (x1 - x0)) / 2
    oy = T + ((H - T - B) - s * (y1 - y0)) / 2
    sx = sy = s
  }
  const X = (x: number) => ox + (x - x0) * sx
  const Y = (y: number) => oy + (y1 - y) * sy
  const plotW = (x1 - x0) * sx, plotH = (y1 - y0) * sy

  // Las asíntotas (tan, 1/x…) no se unen: cortamos el trazo si el valor no es finito,
  // se sale mucho de la ventana o salta de un extremo al otro
  const span = y1 - y0
  const path = (points: [number, number][]) => {
    let d = ''
    let prev: [number, number] | null = null
    for (const p of points) {
      const [x, y] = p
      const ok = Number.isFinite(y) && y > y0 - 4 * span && y < y1 + 4 * span
      if (!ok) { prev = null; continue }
      const jump = prev && Math.abs(y - prev[1]) > 2 * span
      d += `${prev && !jump ? 'L' : 'M'}${X(x).toFixed(2)},${Y(y).toFixed(2)}`
      prev = p
    }
    return d
  }
  const polygon = (a: PlotArea) => {
    const up = a.upper.filter(([, y]) => Number.isFinite(y))
    const lo = a.lower.filter(([, y]) => Number.isFinite(y))
    return [...up, ...[...lo].reverse()].map(([x, y]) => `${X(x).toFixed(2)},${Y(y).toFixed(2)}`).join(' ')
  }

  const xt = niceTicks(x0, x1, equal ? 6 : 7)
  const yt = niceTicks(y0, y1, 5)
  const legend = [
    ...curves.filter(c => c.label).map(c => ({ label: c.label!, tone: c.tone, kind: c.dashed ? 'dash' : 'line' })),
    ...areas.filter(a => a.label).map(a => ({ label: a.label!, tone: a.tone, kind: 'area' })),
  ]

  return (
    <figure className="space-y-2">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto max-h-[340px] bg-white rounded-lg border border-zinc-100" role="img">
        <defs>
          <clipPath id={`${uid}clip`}>
            <rect x={ox} y={oy} width={plotW} height={plotH} />
          </clipPath>
        </defs>

        {/* cuadrícula y etiquetas */}
        {xt.map(t => (
          <g key={`x${t}`}>
            <line x1={X(t)} x2={X(t)} y1={oy} y2={oy + plotH} stroke={C.grid} />
            <text x={X(t)} y={oy + plotH + 14} fontSize={10} fill={C.text} textAnchor="middle">{fmt(t, 2)}</text>
          </g>
        ))}
        {yt.map(t => (
          <g key={`y${t}`}>
            <line x1={ox} x2={ox + plotW} y1={Y(t)} y2={Y(t)} stroke={C.grid} />
            <text x={ox - 5} y={Y(t) + 3} fontSize={10} fill={C.text} textAnchor="end">{fmt(t, 2)}</text>
          </g>
        ))}

        <g clipPath={`url(#${uid}clip)`}>
          {/* ejes x = 0 e y = 0 cuando caen dentro de la ventana */}
          {y0 <= 0 && y1 >= 0 && <line x1={ox} x2={ox + plotW} y1={Y(0)} y2={Y(0)} stroke={C.axis} />}
          {x0 <= 0 && x1 >= 0 && <line x1={X(0)} x2={X(0)} y1={oy} y2={oy + plotH} stroke={C.axis} />}

          {areas.map((a, i) => (
            <polygon key={`a${i}`} points={polygon(a)} fill={TONE[a.tone]} fillOpacity={0.18} />
          ))}
          {curves.map((c, i) => (
            <path key={`c${i}`} d={path(c.points)} fill="none" stroke={TONE[c.tone]} strokeWidth={c.dashed ? 1.5 : 2.2} strokeDasharray={c.dashed ? '5 4' : undefined} strokeLinejoin="round" />
          ))}
          {segments.map((s, i) => (
            <line key={`s${i}`} x1={X(s.from[0])} y1={Y(s.from[1])} x2={X(s.to[0])} y2={Y(s.to[1])} stroke={TONE[s.tone]} strokeWidth={2} strokeDasharray={s.dashed ? '4 3' : undefined} />
          ))}
        </g>

        {segments.filter(s => s.label).map((s, i) => {
          const mx = (X(s.from[0]) + X(s.to[0])) / 2, my = (Y(s.from[1]) + Y(s.to[1])) / 2
          return (
            <text key={`sl${i}`} x={mx} y={my - 5} fontSize={11} fontWeight={600} fill={TONE[s.tone]} textAnchor="middle" paintOrder="stroke" stroke="white" strokeWidth={3}>
              {s.label}
            </text>
          )
        })}
        {marks.filter(m => Number.isFinite(m.y) && m.y >= y0 && m.y <= y1).map((m, i) => (
          <g key={`m${i}`}>
            <circle cx={X(m.x)} cy={Y(m.y)} r={4} fill={TONE[m.tone ?? 'accent']} stroke="white" strokeWidth={1.5} />
            {m.label && (
              <text
                x={X(m.x) + (X(m.x) > ox + plotW - 70 ? -7 : 7)}
                y={Y(m.y) - 7}
                fontSize={11}
                fontWeight={600}
                fill={TONE[m.tone ?? 'accent']}
                textAnchor={X(m.x) > ox + plotW - 70 ? 'end' : 'start'}
                paintOrder="stroke"
                stroke="white"
                strokeWidth={3}
              >
                {m.label}
              </text>
            )}
          </g>
        ))}
      </svg>
      {legend.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-600">
          {legend.map((l, i) => (
            <span key={i} className="inline-flex items-center gap-1.5">
              {l.kind === 'area'
                ? <span className="w-3 h-3 rounded-sm" style={{ background: TONE[l.tone], opacity: 0.3 }} />
                : <span className="w-4 h-0 border-t-2" style={{ borderColor: TONE[l.tone], borderStyle: l.kind === 'dash' ? 'dashed' : 'solid' }} />}
              <Tex latex={l.label} />
            </span>
          ))}
        </div>
      )}
      {caption && <figcaption className="text-xs text-zinc-500 leading-relaxed"><Rich text={caption} /></figcaption>}
    </figure>
  )
}

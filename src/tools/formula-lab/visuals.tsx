import { useId } from 'react'
import type { VisualSpec } from './types'
import { fmt, normalCDF, round, toRad } from './format'
import { Tex } from './Tex'

const W = 360
const H = 240
const PAD = 28

const C = {
  a: '#2563eb',      // blue-600
  b: '#059669',      // emerald-600
  accent: '#7c3aed', // violet-600
  warn: '#e11d48',   // rose-600
  axis: '#d4d4d8',   // zinc-300
  grid: '#f4f4f5',   // zinc-100
  text: '#71717a',   // zinc-500
  ink: '#27272a',    // zinc-800
}

export function Visual({ spec }: { spec: VisualSpec }) {
  switch (spec.type) {
    case 'vectors': return <VectorsVisual {...spec} />
    case 'regression': return <RegressionVisual {...spec} />
    case 'normal': return <NormalVisual {...spec} />
    case 'bars': return <BarsVisual {...spec} />
    case 'snell': return <SnellVisual {...spec} />
    case 'motion': return <MotionVisual {...spec} />
  }
}

function Frame({ children, caption }: { children: React.ReactNode; caption?: React.ReactNode }) {
  return (
    <figure className="space-y-2">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto max-h-[320px] bg-white rounded-lg border border-zinc-100" role="img">
        {children}
      </svg>
      {caption && <figcaption className="text-xs text-zinc-500 leading-relaxed">{caption}</figcaption>}
    </figure>
  )
}

/** Escala lineal de un dominio a un rango de píxeles */
function scale(d0: number, d1: number, r0: number, r1: number) {
  const k = d1 === d0 ? 1 : (r1 - r0) / (d1 - d0)
  return (v: number) => r0 + (v - d0) * k
}

function niceTicks(min: number, max: number, count = 5): number[] {
  const span = max - min || 1
  const step0 = span / count
  const mag = 10 ** Math.floor(Math.log10(step0))
  const step = [1, 2, 5, 10].map(m => m * mag).find(s => s >= step0) ?? step0
  const out: number[] = []
  for (let t = Math.ceil(min / step) * step; t <= max + step * 1e-9; t += step) out.push(round(t, 10))
  return out
}

function Arrow({ id, color }: { id: string; color: string }) {
  return (
    <marker id={id} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" fill={color} />
    </marker>
  )
}

// ─── Vectores: producto punto (proyección) y cruz (paralelogramo) ────────────

function VectorsVisual({ mode, a, b }: { mode: 'dot' | 'cross'; a: number[]; b: number[] }) {
  const uid = useId().replace(/:/g, '')
  const flat = a.length === 2 || (a[2] === 0 && b[2] === 0)
  const ma = Math.hypot(...a), mb = Math.hypot(...b)
  if (ma === 0 || mb === 0) return null

  // En 2D usamos las coordenadas reales; en 3D dibujamos en el plano que forman a y b
  let pa: [number, number], pb: [number, number]
  if (flat) {
    pa = [a[0], a[1]]
    pb = [b[0], b[1]]
  } else {
    const dot = a.reduce((s, c, i) => s + c * b[i], 0)
    const th = Math.acos(Math.max(-1, Math.min(1, dot / (ma * mb))))
    pa = [ma, 0]
    pb = [mb * Math.cos(th), mb * Math.sin(th)]
  }

  const k = (pa[0] * pb[0] + pa[1] * pb[1]) / (pa[0] ** 2 + pa[1] ** 2)
  const proj: [number, number] = [pa[0] * k, pa[1] * k]
  const sum: [number, number] = [pa[0] + pb[0], pa[1] + pb[1]]
  const pts = [[0, 0], pa, pb, ...(mode === 'dot' ? [proj] : [sum])]
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1])
  let x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys)
  const span = Math.max(x1 - x0, y1 - y0, 1e-9)
  x0 -= span * 0.12; x1 += span * 0.12; y0 -= span * 0.12; y1 += span * 0.12
  // escala uniforme para no deformar ángulos
  const s = Math.min((W - 2 * PAD) / (x1 - x0), (H - 2 * PAD) / (y1 - y0))
  const cx = (W - s * (x1 - x0)) / 2, cy = (H - s * (y1 - y0)) / 2
  const X = (x: number) => cx + (x - x0) * s
  const Y = (y: number) => H - (cy + (y - y0) * s)

  const angA = Math.atan2(pa[1], pa[0]), angB = Math.atan2(pb[1], pb[0])
  let delta = angB - angA
  while (delta > Math.PI) delta -= 2 * Math.PI
  while (delta <= -Math.PI) delta += 2 * Math.PI
  const rArc = 26
  const arcEnd = [X(0) + rArc * Math.cos(angA + delta), Y(0) - rArc * Math.sin(angA + delta)]
  const arcStart = [X(0) + rArc * Math.cos(angA), Y(0) - rArc * Math.sin(angA)]
  const mid = angA + delta / 2
  const deg = Math.abs(delta) * 180 / Math.PI

  return (
    <Frame
      caption={mode === 'dot'
        ? <>La línea punteada baja desde la punta de <Tex latex="\vec b" /> hasta la recta de <Tex latex="\vec a" />. El segmento violeta es la <b>sombra</b> de <Tex latex="\vec b" /> sobre <Tex latex="\vec a" />: el producto punto es esa sombra × <Tex latex="|\vec a|" />.{!flat && ' (Vista en el plano que forman los dos vectores.)'}</>
        : <>El área sombreada es el paralelogramo que forman <Tex latex="\vec a" /> y <Tex latex="\vec b" />. Su área es <Tex latex="|\vec a\times\vec b|" />, y el vector resultado sale perpendicular a esta hoja.{!flat && ' (Vista en el plano que forman los dos vectores.)'}</>}
    >
      <defs>
        <Arrow id={`${uid}a`} color={C.a} />
        <Arrow id={`${uid}b`} color={C.b} />
      </defs>
      {flat && (
        <g stroke={C.axis} strokeWidth={1}>
          <line x1={0} x2={W} y1={Y(0)} y2={Y(0)} />
          <line x1={X(0)} x2={X(0)} y1={0} y2={H} />
        </g>
      )}
      {mode === 'cross' && (
        <polygon
          points={[[0, 0], pa, sum, pb].map(p => `${X(p[0])},${Y(p[1])}`).join(' ')}
          fill="#f59e0b" fillOpacity={0.18} stroke="#f59e0b" strokeOpacity={0.6} strokeDasharray="4 3"
        />
      )}
      {mode === 'dot' && (
        <>
          {/* recta de a extendida */}
          <line x1={X(-pa[0] * 3)} y1={Y(-pa[1] * 3)} x2={X(pa[0] * 3)} y2={Y(pa[1] * 3)} stroke={C.a} strokeOpacity={0.15} />
          <line x1={X(pb[0])} y1={Y(pb[1])} x2={X(proj[0])} y2={Y(proj[1])} stroke={C.text} strokeDasharray="4 3" />
          {(() => {
            // la sombra se dibuja desplazada del lado opuesto a b para que no la tape a
            const ux = X(pa[0]) - X(0), uy = Y(pa[1]) - Y(0)
            const len = Math.hypot(ux, uy) || 1
            let nx = -uy / len, ny = ux / len
            const side = (X(pb[0]) - X(0)) * nx + (Y(pb[1]) - Y(0)) * ny
            if (side > 0) { nx = -nx; ny = -ny }
            const off = 7
            return (
              <g stroke={C.accent} strokeWidth={3} strokeLinecap="round">
                <line x1={X(0) + nx * off} y1={Y(0) + ny * off} x2={X(proj[0]) + nx * off} y2={Y(proj[1]) + ny * off} />
                <line x1={X(proj[0])} y1={Y(proj[1])} x2={X(proj[0]) + nx * off} y2={Y(proj[1]) + ny * off} strokeWidth={1} />
              </g>
            )
          })()}
        </>
      )}
      {deg > 1 && deg < 179 && (
        <>
          <path
            d={`M${arcStart[0]},${arcStart[1]} A${rArc},${rArc} 0 0 ${delta > 0 ? 0 : 1} ${arcEnd[0]},${arcEnd[1]}`}
            fill="none" stroke={C.ink} strokeWidth={1}
          />
          <text x={X(0) + (rArc + 14) * Math.cos(mid)} y={Y(0) - (rArc + 14) * Math.sin(mid) + 4} fontSize={11} fill={C.ink} textAnchor="middle">
            {fmt(deg, 1)}°
          </text>
        </>
      )}
      <line x1={X(0)} y1={Y(0)} x2={X(pa[0])} y2={Y(pa[1])} stroke={C.a} strokeWidth={2.5} markerEnd={`url(#${uid}a)`} />
      <line x1={X(0)} y1={Y(0)} x2={X(pb[0])} y2={Y(pb[1])} stroke={C.b} strokeWidth={2.5} markerEnd={`url(#${uid}b)`} />
      <text x={X(pa[0]) + 6} y={Y(pa[1]) - 6} fontSize={13} fontWeight={600} fill={C.a}>a</text>
      <text x={X(pb[0]) + 6} y={Y(pb[1]) - 6} fontSize={13} fontWeight={600} fill={C.b}>b</text>
    </Frame>
  )
}

// ─── Regresión: puntos, recta y residuos como cuadrados ──────────────────────

function RegressionVisual({ points, b0, b1 }: { points: [number, number][]; b0: number; b1: number }) {
  const xs = points.map(p => p[0]), ys = points.map(p => p[1])
  let xMin = Math.min(...xs), xMax = Math.max(...xs)
  const yHat = xs.map(x => b0 + b1 * x)
  let yMin = Math.min(...ys, ...yHat), yMax = Math.max(...ys, ...yHat)
  const dx = (xMax - xMin || 1) * 0.12, dy = (yMax - yMin || 1) * 0.15
  xMin -= dx; xMax += dx; yMin -= dy; yMax += dy
  const L = 40, B = 26
  const X = scale(xMin, xMax, L, W - 12)
  const Y = scale(yMin, yMax, H - B, 12)
  const pxPerY = (H - B - 12) / (yMax - yMin)
  const sse = points.reduce((s, [x, y]) => s + (y - (b0 + b1 * x)) ** 2, 0)

  return (
    <Frame caption={<>Cada cuadrado rojo tiene como lado el residuo <Tex latex="e_i=y_i-\hat y_i" />. La recta de mínimos cuadrados es la que hace <b>mínima el área total</b> de los cuadrados: <Tex latex={`\\sum e_i^2=${fmt(sse)}`} />.</>}>
      {niceTicks(xMin, xMax).map(t => (
        <g key={`x${t}`}>
          <line x1={X(t)} x2={X(t)} y1={12} y2={H - B} stroke={C.grid} />
          <text x={X(t)} y={H - 8} fontSize={10} fill={C.text} textAnchor="middle">{fmt(t, 2)}</text>
        </g>
      ))}
      {niceTicks(yMin, yMax).map(t => (
        <g key={`y${t}`}>
          <line x1={L} x2={W - 12} y1={Y(t)} y2={Y(t)} stroke={C.grid} />
          <text x={L - 6} y={Y(t) + 3} fontSize={10} fill={C.text} textAnchor="end">{fmt(t, 2)}</text>
        </g>
      ))}
      <line x1={L} x2={L} y1={12} y2={H - B} stroke={C.axis} />
      <line x1={L} x2={W - 12} y1={H - B} y2={H - B} stroke={C.axis} />
      {points.map(([x, y], i) => {
        const e = y - (b0 + b1 * x)
        const side = Math.abs(e) * pxPerY
        if (side < 0.5) return null
        const top = Math.min(Y(y), Y(b0 + b1 * x))
        const left = X(x) + side > W - 12 ? X(x) - side : X(x)
        return <rect key={i} x={left} y={top} width={side} height={side} fill={C.warn} fillOpacity={0.12} stroke={C.warn} strokeOpacity={0.5} />
      })}
      <line x1={X(xMin)} y1={Y(b0 + b1 * xMin)} x2={X(xMax)} y2={Y(b0 + b1 * xMax)} stroke={C.accent} strokeWidth={2} />
      {points.map(([x, y], i) => (
        <circle key={i} cx={X(x)} cy={Y(y)} r={4} fill={C.a} stroke="white" strokeWidth={1.5} />
      ))}
    </Frame>
  )
}

// ─── Normal estándar ─────────────────────────────────────────────────────────

const pdf = (z: number) => Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI)

function NormalVisual({ z, shade, label }: { z: number; shade: 'left' | 'center'; label?: string }) {
  const zc = Math.max(-4, Math.min(4, z))
  const X = scale(-4, 4, 16, W - 16)
  const Y = scale(0, 0.42, H - 28, 14)
  const curve = (a: number, b: number) => {
    const pts: string[] = []
    for (let i = 0; i <= 120; i++) {
      const t = a + ((b - a) * i) / 120
      pts.push(`${X(t)},${Y(pdf(t))}`)
    }
    return pts
  }
  const area = shade === 'left' ? normalCDF(z) : normalCDF(Math.abs(z)) - normalCDF(-Math.abs(z))
  const [s0, s1] = shade === 'left' ? [-4, zc] : [-Math.abs(zc), Math.abs(zc)]

  return (
    <Frame caption={<>{label ?? 'Área sombreada'}: <Tex latex={`${fmt(area, 4)}\\ (${fmt(area * 100, 2)}\\%)`} /> del área total bajo la campana.</>}>
      <line x1={8} x2={W - 8} y1={Y(0)} y2={Y(0)} stroke={C.axis} />
      {s1 > s0 && (
        <polygon points={[`${X(s0)},${Y(0)}`, ...curve(s0, s1), `${X(s1)},${Y(0)}`].join(' ')} fill={C.a} fillOpacity={0.18} />
      )}
      <polyline points={curve(-4, 4).join(' ')} fill="none" stroke={C.a} strokeWidth={2} />
      {[-3, -2, -1, 0, 1, 2, 3].map(t => (
        <text key={t} x={X(t)} y={H - 10} fontSize={10} fill={C.text} textAnchor="middle">{t}</text>
      ))}
      {(shade === 'left' ? [zc] : [-Math.abs(zc), Math.abs(zc)]).map((t, i) => (
        <g key={i}>
          <line x1={X(t)} x2={X(t)} y1={Y(0)} y2={Y(pdf(t)) - 10} stroke={C.accent} strokeWidth={1.5} />
          <text x={X(t)} y={Y(pdf(t)) - 14} fontSize={11} fontWeight={600} fill={C.accent} textAnchor="middle">
            z = {fmt(shade === 'left' ? z : (i === 0 ? -Math.abs(z) : Math.abs(z)), 2)}
          </text>
        </g>
      ))}
    </Frame>
  )
}

// ─── Barras de una distribución discreta ─────────────────────────────────────

function BarsVisual({ xs, ps, highlight }: { xs: number[]; ps: number[]; highlight: number }) {
  // recortamos colas despreciables para que el gráfico sea legible
  let lo = 0, hi = xs.length - 1
  const maxP = Math.max(...ps)
  while (lo < highlight && ps[lo] < maxP * 0.005) lo++
  while (hi > highlight && ps[hi] < maxP * 0.005) hi--
  const sx = xs.slice(lo, hi + 1), sp = ps.slice(lo, hi + 1)
  const L = 40, B = 24
  const bw = (W - L - 12) / sx.length
  const Y = scale(0, maxP * 1.1, H - B, 12)
  const every = Math.ceil(sx.length / 15)

  return (
    <Frame caption={<>Cada barra es <Tex latex="P(X=x)" />. La barra azul es el valor que preguntaste.</>}>
      {niceTicks(0, maxP * 1.1, 4).map(t => (
        <g key={t}>
          <line x1={L} x2={W - 12} y1={Y(t)} y2={Y(t)} stroke={C.grid} />
          <text x={L - 6} y={Y(t) + 3} fontSize={10} fill={C.text} textAnchor="end">{fmt(t, 3)}</text>
        </g>
      ))}
      {sx.map((x, i) => (
        <g key={x}>
          <rect
            x={L + i * bw + bw * 0.12} width={bw * 0.76}
            y={Y(sp[i])} height={Y(0) - Y(sp[i])}
            fill={x === highlight ? C.a : '#d4d4d8'} rx={2}
          />
          {(i % every === 0 || x === highlight) && (
            <text x={L + i * bw + bw / 2} y={H - 8} fontSize={10} fill={x === highlight ? C.a : C.text} fontWeight={x === highlight ? 700 : 400} textAnchor="middle">{x}</text>
          )}
        </g>
      ))}
      <line x1={L} x2={W - 12} y1={Y(0)} y2={Y(0)} stroke={C.axis} />
    </Frame>
  )
}

// ─── Refracción ──────────────────────────────────────────────────────────────

function SnellVisual({ n1, n2, theta1, theta2 }: { n1: number; n2: number; theta1: number; theta2: number | null }) {
  const uid = useId().replace(/:/g, '')
  const ox = W / 2, oy = H / 2, r = 100
  const t1 = toRad(theta1)
  const inc = [ox - r * Math.sin(t1), oy - r * Math.cos(t1)]
  const out = theta2 === null
    ? [ox + r * Math.sin(t1), oy - r * Math.cos(t1)]
    : [ox + r * Math.sin(toRad(theta2)), oy + r * Math.cos(toRad(theta2))]
  const tint = (n: number) => `rgba(37, 99, 235, ${Math.min(0.28, (n - 1) * 0.35)})`

  return (
    <Frame caption={theta2 === null
      ? 'Reflexión total interna: la luz no puede salir del medio 1 y rebota por completo.'
      : <>Los ángulos se miden desde la <b>normal</b> (línea punteada). Un medio más azul tiene un índice <Tex latex="n" /> mayor: ahí la luz va más lento.</>}>
      <defs><Arrow id={`${uid}r`} color="#f59e0b" /></defs>
      <rect x={0} y={0} width={W} height={oy} fill={tint(n1)} />
      <rect x={0} y={oy} width={W} height={H - oy} fill={tint(n2)} />
      <line x1={0} x2={W} y1={oy} y2={oy} stroke={C.text} />
      <line x1={ox} x2={ox} y1={10} y2={H - 10} stroke={C.text} strokeDasharray="4 4" />
      <line x1={inc[0]} y1={inc[1]} x2={ox} y2={oy} stroke="#f59e0b" strokeWidth={2.5} markerEnd={`url(#${uid}r)`} />
      <line x1={ox} y1={oy} x2={out[0]} y2={out[1]} stroke="#f59e0b" strokeWidth={2.5} markerEnd={`url(#${uid}r)`} />
      <text x={10} y={20} fontSize={12} fill={C.ink}>n₁ = {fmt(n1, 3)}</text>
      <text x={10} y={H - 10} fontSize={12} fill={C.ink}>n₂ = {fmt(n2, 3)}</text>
      <text x={ox - 34} y={oy - 40} fontSize={11} fill={C.ink} textAnchor="end">θ₁ = {fmt(theta1, 1)}°</text>
      {theta2 !== null && <text x={ox + 34} y={oy + 50} fontSize={11} fill={C.ink}>θ₂ = {fmt(theta2, 1)}°</text>}
    </Frame>
  )
}

// ─── MRUA: posición contra tiempo ────────────────────────────────────────────

function MotionVisual({ x0, v0, a, t }: { x0: number; v0: number; a: number; t: number }) {
  const tMax = Math.max(t * 1.4, 1)
  const xAt = (s: number) => x0 + v0 * s + 0.5 * a * s * s
  const samples = Array.from({ length: 81 }, (_, i) => (tMax * i) / 80)
  const xsv = samples.map(xAt)
  let lo = Math.min(...xsv), hi = Math.max(...xsv)
  const pad = (hi - lo || 1) * 0.1
  lo -= pad; hi += pad
  const L = 44, B = 26
  const X = scale(0, tMax, L, W - 12)
  const Y = scale(lo, hi, H - B, 12)

  return (
    <Frame caption={<>Gráfica posición–tiempo. Es una parábola por el término <Tex latex="\tfrac12at^2" />. El punto marca el instante <Tex latex={`t=${fmt(t)}\\ \\mathrm{s}`} />.</>}>
      {niceTicks(0, tMax).map(s => (
        <g key={`t${s}`}>
          <line x1={X(s)} x2={X(s)} y1={12} y2={H - B} stroke={C.grid} />
          <text x={X(s)} y={H - 8} fontSize={10} fill={C.text} textAnchor="middle">{fmt(s, 2)}</text>
        </g>
      ))}
      {niceTicks(lo, hi).map(v => (
        <g key={`x${v}`}>
          <line x1={L} x2={W - 12} y1={Y(v)} y2={Y(v)} stroke={C.grid} />
          <text x={L - 6} y={Y(v) + 3} fontSize={10} fill={C.text} textAnchor="end">{fmt(v, 2)}</text>
        </g>
      ))}
      <line x1={L} x2={L} y1={12} y2={H - B} stroke={C.axis} />
      <polyline points={samples.map((s, i) => `${X(s)},${Y(xsv[i])}`).join(' ')} fill="none" stroke={C.a} strokeWidth={2} />
      <line x1={X(t)} x2={X(t)} y1={Y(xAt(t))} y2={H - B} stroke={C.accent} strokeDasharray="3 3" />
      <circle cx={X(t)} cy={Y(xAt(t))} r={5} fill={C.accent} stroke="white" strokeWidth={1.5} />
      <text x={W - 14} y={24} fontSize={10} fill={C.text} textAnchor="end">x (m) vs t (s)</text>
    </Frame>
  )
}

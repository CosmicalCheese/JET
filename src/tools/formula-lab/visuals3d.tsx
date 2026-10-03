import { useRef, useState } from 'react'
import { cn } from '../../lib/utils'
import { fmt } from './format'
import { Tex } from './Tex'

/* ─── Gráfica 3D interactiva (SVG con proyección ortográfica) ───
 * Se gira arrastrando (mouse o dedo). Usamos SVG en lugar de WebGL para que el
 * texto sea nítido, funcione en cualquier teléfono y comparta estilo con las
 * gráficas 2D.
 */

type V3 = [number, number, number]

const to3 = (v: number[]): V3 => [v[0] ?? 0, v[1] ?? 0, v[2] ?? 0]
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k]
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const norm = (a: V3) => Math.sqrt(dot(a, a))

const W = 360
const H = 300
const DEG = Math.PI / 180

const VIEWS = {
  iso: { az: 35 * DEG, el: 24 * DEG, label: '3D' },
  top: { az: -90 * DEG, el: 89.9 * DEG, label: 'Desde arriba (xy)' },
  front: { az: -90 * DEG, el: 0, label: 'De frente (xz)' },
}
type ViewId = keyof typeof VIEWS

const C = {
  a: '#2563eb',
  b: '#059669',
  accent: '#7c3aed',
  amber: '#f59e0b',
  axis: '#a1a1aa',
  plane: '#f4f4f5',
  text: '#71717a',
  ink: '#27272a',
}

export interface Vectors3DProps {
  mode: 'dot' | 'cross' | 'points' | 'area'
  a: number[]
  b: number[]
  view?: 'top'
  /** Punto desde el que salen a y b (modo área con tres puntos) */
  origin?: number[]
}

export function Vectors3DVisual({ mode, a, b, view, origin }: Vectors3DProps) {
  const [cam, setCam] = useState(() => VIEWS[view ?? 'iso'])
  const drag = useRef<{ x: number; y: number } | null>(null)

  const A = to3(a), B = to3(b)

  // Cámara: d apunta del origen hacia el observador; r = derecha, u = arriba en pantalla
  const { az, el } = cam
  const r: V3 = [-Math.sin(az), Math.cos(az), 0]
  const u: V3 = [-Math.sin(el) * Math.cos(az), -Math.sin(el) * Math.sin(az), Math.cos(el)]

  // Puntos de la escena según el modo
  const C3 = cross(A, B)
  const big = Math.max(norm(A), norm(B))
  let cShown: V3 | null = null
  let cRescaled = false
  if (mode === 'cross' && norm(C3) > 1e-12) {
    const lc = norm(C3)
    // |a×b| es un área, no una longitud: lo dibujamos a una escala que deje ver bien a y b
    if (lc > 1.3 * big || lc < 0.3 * big) { cShown = mul(C3, (1.3 * big) / lc); cRescaled = true }
    else cShown = C3
  }
  const kProj = dot(A, A) > 0 ? dot(A, B) / dot(A, A) : 0
  const proj = mul(A, kProj)
  const Q1: V3 = [B[0], A[1], A[2]]
  const Q2: V3 = [B[0], B[1], A[2]]

  // Con vectores la escena gira alrededor del origen. Con dos puntos lejanos al origen
  // centramos la vista en la caja que forman, con ejes y plano de referencia en P₁.
  const O: V3 = [0, 0, 0]
  // En modo área la figura sale de `origin` (o del origen) y la vista se centra en ella.
  const Og = to3(origin ?? [0, 0, 0])
  const OA = add(Og, A), OB = add(Og, B), OAB = add(OA, B)
  const base = mode === 'points' ? A : mode === 'area' ? Og : O
  const center = mode === 'points' ? mul(add(A, B), 0.5) : mode === 'area' ? mul(add(Og, OAB), 0.5) : O
  const scenePts: V3[] = mode === 'points' ? [A, B, Q1, Q2] : mode === 'area' ? [Og, OA, OB, OAB] : [O, A, B]
  if (mode === 'cross') scenePts.push(add(A, B), ...(cShown ? [cShown] : []))
  if (mode === 'dot') scenePts.push(proj)
  const R = Math.max(...scenePts.map(p => norm(sub(p, center))), 1e-9)
  const L = mode === 'points' ? R * 0.9 : mode === 'area' ? R * 1.1 : R * 1.15 // largo de los ejes
  const s = (Math.min(W, H) / 2 - 22) / (R * 1.2)

  const P = (p: V3): [number, number] => {
    const q = sub(p, center)
    return [W / 2 + s * dot(q, r), H / 2 - s * dot(q, u)]
  }

  const onDown = (e: React.PointerEvent) => {
    (e.currentTarget as Element).setPointerCapture(e.pointerId)
    drag.current = { x: e.clientX, y: e.clientY }
  }
  const onMove = (e: React.PointerEvent) => {
    if (!drag.current) return
    const dx = e.clientX - drag.current.x, dy = e.clientY - drag.current.y
    drag.current = { x: e.clientX, y: e.clientY }
    setCam(c => ({ ...c, az: c.az - dx * 0.012, el: Math.max(-89.9 * DEG, Math.min(89.9 * DEG, c.el + dy * 0.012)) }))
  }
  const onUp = () => { drag.current = null }

  const line = (p: V3, q: V3, props: React.SVGProps<SVGLineElement>) => {
    const [x1, y1] = P(p), [x2, y2] = P(q)
    return <line x1={x1} y1={y1} x2={x2} y2={y2} {...props} />
  }

  const arrow = (from: V3, to: V3, color: string, label: string, width = 2.5) => {
    const [x1, y1] = P(from), [x2, y2] = P(to)
    const dx = x2 - x1, dy = y2 - y1
    const len = Math.hypot(dx, dy)
    if (len < 1) return <circle cx={x2} cy={y2} r={3} fill={color} />
    const ux = dx / len, uy = dy / len
    const head = Math.min(10, len * 0.4)
    const bx = x2 - ux * head, by = y2 - uy * head
    return (
      <g>
        <line x1={x1} y1={y1} x2={bx} y2={by} stroke={color} strokeWidth={width} strokeLinecap="round" />
        <polygon points={`${x2},${y2} ${bx - uy * head * 0.5},${by + ux * head * 0.5} ${bx + uy * head * 0.5},${by - ux * head * 0.5}`} fill={color} />
        <text x={x2 + ux * 10} y={y2 + uy * 10 + 4} fontSize={13} fontWeight={600} fill={color} textAnchor="middle">{label}</text>
      </g>
    )
  }

  // línea punteada de la punta al plano de referencia: da sensación de profundidad
  const drop = (p: V3) => Math.abs(p[2] - base[2]) > 1e-9 && line(p, [p[0], p[1], base[2]], { stroke: C.text, strokeDasharray: '2 3', strokeOpacity: 0.6 })

  // arco del ángulo entre a y b, dibujado en el plano que forman
  let arc: React.ReactNode = null
  if (mode === 'dot' && norm(A) > 0 && norm(B) > 0) {
    const e1 = mul(A, 1 / norm(A))
    const bh = mul(B, 1 / norm(B))
    const w = add(bh, mul(e1, -dot(bh, e1)))
    if (norm(w) > 1e-9) {
      const e2 = mul(w, 1 / norm(w))
      const th = Math.acos(Math.max(-1, Math.min(1, dot(e1, bh))))
      const r0 = 0.3 * Math.min(norm(A), norm(B))
      const pts = Array.from({ length: 25 }, (_, i) => {
        const t = (th * i) / 24
        return P(add(mul(e1, r0 * Math.cos(t)), mul(e2, r0 * Math.sin(t))))
      })
      const [lx, ly] = P(add(mul(e1, r0 * 1.5 * Math.cos(th / 2)), mul(e2, r0 * 1.5 * Math.sin(th / 2))))
      arc = (
        <g>
          <polyline points={pts.map(p => p.join(',')).join(' ')} fill="none" stroke={C.ink} strokeWidth={1} />
          <text x={lx} y={ly + 4} fontSize={11} fill={C.ink} textAnchor="middle">{fmt(th / DEG, 1)}°</text>
        </g>
      )
    }
  }

  // la cuadrícula se centra bajo la figura en modo área; en los demás, en el punto base
  const planeC: V3 = mode === 'area' ? [center[0], center[1], base[2]] : base
  const planeCorners: V3[] = ([[-L, -L], [L, -L], [L, L], [-L, L]] as const).map(([x, y]) => add(planeC, [x, y, 0]))
  const gridSteps = [-0.5, 0, 0.5].map(k => k * L)

  const caption =
    mode === 'dot' ? <>La sombra violeta es la proyección de <Tex latex="\vec b" /> sobre <Tex latex="\vec a" />; el producto punto es esa sombra × <Tex latex="|\vec a|" />. El arco marca el ángulo entre ellos.</>
      : mode === 'cross' ? <>El área amarilla es el paralelogramo de <Tex latex="\vec a" /> y <Tex latex="\vec b" />; su área es <Tex latex="|\vec a\times\vec b|" />. El vector violeta <Tex latex="\vec a\times\vec b" /> sale perpendicular a ese plano{cRescaled ? ' (su largo real es el área; aquí se dibuja a otra escala para que se vea todo)' : ''}. Gíralo para comprobarlo.</>
        : mode === 'area' ? <>El paralelogramo (azul) tiene área <Tex latex="|\vec a\times\vec b|" />: base por altura. La diagonal lo parte en dos triángulos iguales; el amarillo mide la mitad.</>
        : <>La distancia <Tex latex="d" /> (violeta) es la diagonal de una caja cuyos lados son las diferencias <Tex latex="l" />, <Tex latex="m" /> y <Tex latex="n" />: Pitágoras dos veces.</>

  return (
    <figure className="space-y-2">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto max-h-[360px] bg-white rounded-lg border border-zinc-100 cursor-grab active:cursor-grabbing select-none"
        style={{ touchAction: 'none' }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        role="img"
        aria-label="Gráfica 3D: arrastra para girar"
      >
        {/* plano xy y cuadrícula */}
        <polygon points={planeCorners.map(p => P(p).join(',')).join(' ')} fill={C.plane} fillOpacity={0.7} stroke="#e4e4e7" />
        {gridSteps.map(k => (
          <g key={k} stroke="#e4e4e7">
            {line(add(planeC, [k, -L, 0]), add(planeC, [k, L, 0]), {})}
            {line(add(planeC, [-L, k, 0]), add(planeC, [L, k, 0]), {})}
          </g>
        ))}
        {/* ejes */}
        {(['x', 'y', 'z'] as const).map((name, i) => {
          const e: V3 = [0, 0, 0]; e[i] = 1
          const pos = add(base, mul(e, L)), neg = add(base, mul(e, -L))
          const [tx, ty] = P(add(base, mul(e, L * 1.08)))
          return (
            <g key={name}>
              {line(base, pos, { stroke: C.axis, strokeWidth: 1.2 })}
              {line(base, neg, { stroke: C.axis, strokeWidth: 1, strokeDasharray: '3 3' })}
              <text x={tx} y={ty + 4} fontSize={12} fill={C.text} textAnchor="middle" fontStyle="italic">{name}</text>
            </g>
          )
        })}

        {mode === 'cross' && (
          <polygon
            points={[[0, 0, 0] as V3, A, add(A, B), B].map(p => P(p).join(',')).join(' ')}
            fill={C.amber} fillOpacity={0.22} stroke={C.amber} strokeOpacity={0.7} strokeDasharray="4 3"
          />
        )}

        {mode === 'dot' && (
          <>
            {norm(A) > 0 && line(mul(A, -L / norm(A)), mul(A, L / norm(A)), { stroke: C.a, strokeOpacity: 0.12 })}
            {line(B, proj, { stroke: C.text, strokeDasharray: '4 3' })}
            {line([0, 0, 0], proj, { stroke: C.accent, strokeWidth: 7, strokeOpacity: 0.45, strokeLinecap: 'round' })}
          </>
        )}

        {mode === 'area' && (
          <>
            <polygon points={[Og, OA, OAB, OB].map(p => P(p).join(',')).join(' ')} fill={C.a} fillOpacity={0.1} stroke={C.a} strokeOpacity={0.5} strokeDasharray="4 3" />
            <polygon points={[Og, OA, OB].map(p => P(p).join(',')).join(' ')} fill={C.amber} fillOpacity={0.35} stroke={C.amber} strokeWidth={1.5} />
            {drop(OA)}{drop(OB)}
            {/* con tres puntos ya se etiquetan los vértices */}
            {arrow(Og, OA, C.a, origin ? '' : 'a')}
            {arrow(Og, OB, C.b, origin ? '' : 'b')}
            {origin && [['P', Og], ['Q', OA], ['R', OB]].map(([lab, p]) => {
              const [px, py] = P(p as V3)
              return (
                <g key={lab as string}>
                  <circle cx={px} cy={py} r={3.5} fill={C.ink} />
                  <text x={px - 10} y={py + 14} fontSize={12} fontWeight={600} fill={C.ink}>{lab as string}</text>
                </g>
              )
            })}
          </>
        )}

        {mode === 'area' ? null : mode === 'points' ? (
          <>
            {drop(A)}{drop(B)}
            {line(A, Q1, { stroke: C.a, strokeWidth: 2 })}
            {line(Q1, Q2, { stroke: C.b, strokeWidth: 2 })}
            {line(Q2, B, { stroke: C.amber, strokeWidth: 2 })}
            {line(A, B, { stroke: C.accent, strokeWidth: 3 })}
            {[['l', A, Q1, C.a], ['m', Q1, Q2, C.b], ['n', Q2, B, C.amber], ['d', A, B, C.accent]].map(([lab, p, q, col]) => {
              const [mx, my] = P(mul(add(p as V3, q as V3), 0.5))
              return <text key={lab as string} x={mx + 6} y={my - 6} fontSize={12} fontWeight={600} fontStyle="italic" fill={col as string}>{lab as string}</text>
            })}
            {[['P₁', A], ['P₂', B]].map(([lab, p]) => {
              const [px, py] = P(p as V3)
              return (
                <g key={lab as string}>
                  <circle cx={px} cy={py} r={4.5} fill={C.ink} stroke="white" strokeWidth={1.5} />
                  <text x={px + 8} y={py + 4} fontSize={12} fontWeight={600} fill={C.ink}>{lab as string}</text>
                </g>
              )
            })}
          </>
        ) : (
          <>
            {drop(A)}{drop(B)}
            {arc}
            {arrow([0, 0, 0], A, C.a, 'a')}
            {arrow([0, 0, 0], B, C.b, 'b')}
            {cShown && <>{drop(cShown)}{arrow([0, 0, 0], cShown, C.accent, 'a×b')}</>}
          </>
        )}
      </svg>
      <div className="flex flex-wrap items-center gap-1.5">
        {(Object.keys(VIEWS) as ViewId[]).map(id => {
          const active = Math.abs(cam.az - VIEWS[id].az) < 1e-6 && Math.abs(cam.el - VIEWS[id].el) < 1e-6
          return (
            <button
              key={id}
              onClick={() => setCam(VIEWS[id])}
              className={cn('px-2 py-1 rounded text-[11px] font-medium border transition-colors', active ? 'bg-zinc-800 border-zinc-800 text-white' : 'border-zinc-200 text-zinc-600 hover:bg-zinc-50')}
            >
              {VIEWS[id].label}
            </button>
          )
        })}
        <span className="text-[11px] text-zinc-400 ml-1">Arrastra la gráfica para girarla</span>
      </div>
      <figcaption className="text-xs text-zinc-500 leading-relaxed">{caption}</figcaption>
    </figure>
  )
}

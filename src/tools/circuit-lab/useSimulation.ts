import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { solveDC } from './engine/dc.ts'
import { isReactive, transientStep } from './engine/transient.ts'
import type { Circuit, DCResult, ReactiveState } from './engine/types.ts'

/** Pasos de integración por cuadro de animación. */
const SUBSTEPS = 20
/** El osciloscopio muestra los últimos 10 s reales (en tiempo simulado: 10 · timescale). */
const WINDOW_REAL_S = 10
const MAX_SAMPLES = 1500

export interface Sample {
  t: number
  values: Record<string, { v: number; i: number }>
}

export interface Simulation {
  result: DCResult
  /** Tiempo simulado, en s. */
  time: number
  samples: Sample[]
  /** Hay algo que depende del tiempo (capacitores, bobinas o gráficas). */
  active: boolean
  running: boolean
  setRunning: (running: boolean) => void
  /** Descarga capacitores, apaga bobinas y vuelve a t = 0. */
  reset: () => void
}

interface Frame {
  result: DCResult
  time: number
  samples: Sample[]
}

/**
 * Corre el circuito en el tiempo. `timescale` = segundos simulados por cada
 * segundo real. Sin capacitores, bobinas ni gráficas no hay nada que animar
 * y se resuelve una sola vez en DC.
 */
export function useSimulation(circuit: Circuit, timescale: number, traces: string[]): Simulation {
  const reactive = useMemo(() => circuit.components.some(isReactive), [circuit])
  const active = reactive || traces.length > 0
  const dcResult = useMemo(() => (active ? null : solveDC(circuit)), [active, circuit])

  const [running, setRunning] = useState(true)
  const [frame, setFrame] = useState<Frame | null>(null)

  // El ciclo de animación lee siempre lo último sin reiniciarse en cada edición.
  const live = useRef({ circuit, timescale, traces, running })
  useEffect(() => {
    live.current = { circuit, timescale, traces, running }
  })

  const sim = useRef({ state: {} as ReactiveState, time: 0, samples: [] as Sample[], shown: null as Circuit | null })

  const reset = useCallback(() => {
    sim.current = { state: {}, time: 0, samples: [], shown: null }
  }, [])

  useEffect(() => {
    if (!active) return
    let last = performance.now()
    let raf = requestAnimationFrame(function tick(now) {
      const elapsed = Math.min(0.05, (now - last) / 1000)
      last = now
      const { circuit: c, timescale: scale, traces: tr, running: run } = live.current
      const s = sim.current
      const dt = (Math.max(elapsed, 1 / 120) * scale) / SUBSTEPS

      let result: DCResult | null = null
      if (run) {
        for (let k = 0; k < SUBSTEPS; k++) {
          const step = transientStep(c, s.state, dt)
          result = step.result
          if (!result.ok) break
          s.state = step.state
          s.time += dt
        }
        if (result?.ok) {
          const values: Sample['values'] = {}
          for (const id of tr) {
            const st = result.components[id]
            if (st) values[id] = { v: st.voltage, i: st.current }
          }
          const from = s.time - WINDOW_REAL_S * scale
          s.samples = [...s.samples.filter((x) => x.t >= from).slice(-(MAX_SAMPLES - 1)), { t: s.time, values }]
        }
      } else if (s.shown !== c) {
        // En pausa solo se recalcula si cambió el circuito (para ver el efecto de una edición).
        result = transientStep(c, s.state, dt).result
      }
      if (result) {
        s.shown = c
        setFrame({ result, time: s.time, samples: s.samples })
      }
      raf = requestAnimationFrame(tick)
    })
    return () => cancelAnimationFrame(raf)
  }, [active])

  const result = dcResult ?? frame?.result ?? solveDC(circuit)
  return {
    result,
    time: active ? frame?.time ?? 0 : 0,
    samples: active ? frame?.samples ?? [] : [],
    active,
    running,
    setRunning,
    reset,
  }
}

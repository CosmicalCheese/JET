import { useMemo } from 'react'
import { convertLatexToMarkup } from 'mathlive'
import { cn } from '../../lib/utils'

/** Renderiza LaTeX siempre como matemáticas (a diferencia de MathDisplay, que adivina) */
export function Tex({ latex, display = false, className }: { latex: string; display?: boolean; className?: string }) {
  const html = useMemo(() => {
    try {
      return convertLatexToMarkup(latex, { defaultMode: display ? 'math' : 'inline-math' })
    } catch {
      return null
    }
  }, [latex, display])

  if (html === null) return <code className={className}>{latex}</code>
  return (
    <span
      className={cn(display ? 'block overflow-x-auto overflow-y-hidden py-1' : 'inline', className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

/** Texto con $LaTeX inline$ y **negritas** */
export function Rich({ text, className }: { text: string; className?: string }) {
  const parts = text.split(/(\$[^$]+\$|\*\*[^*]+\*\*)/g).filter(Boolean)
  return (
    <span className={className}>
      {parts.map((p, i) => {
        if (p.startsWith('$') && p.endsWith('$')) return <Tex key={i} latex={`\\textstyle ${p.slice(1, -1)}`} />
        if (p.startsWith('**') && p.endsWith('**')) return <strong key={i} className="font-semibold text-zinc-900"><Rich text={p.slice(2, -2)} /></strong>
        return <span key={i}>{p}</span>
      })}
    </span>
  )
}

import { Star } from 'lucide-react'
import { useRef, useState, type KeyboardEvent } from 'react'
import { cx } from './ui'

interface RatingStarsProps {
  value: number
  readOnly?: boolean
  onChange?: (value: number) => void
  label?: string
}

export function RatingStars({
  value,
  readOnly = false,
  onChange,
  label = 'avaliação',
}: RatingStarsProps) {
  const [hovered, setHovered] = useState<number | null>(null)
  const radioRefs = useRef<Array<HTMLButtonElement | null>>([])
  const activeValue = hovered ?? value
  const roundedValue = Math.round(value * 10) / 10

  const choose = (score: number) => {
    onChange?.(score)
    setHovered(null)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, score: number) => {
    const directions: Record<string, number> = {
      ArrowRight: 1,
      ArrowUp: 1,
      ArrowLeft: -1,
      ArrowDown: -1,
    }
    const direction = directions[event.key]
    if (!direction) return

    event.preventDefault()
    const nextScore = ((score - 1 + direction + 5) % 5) + 1
    choose(nextScore)
    radioRefs.current[nextScore - 1]?.focus()
  }

  if (readOnly) {
    return (
      <span
        className="inline-flex items-center gap-1 text-[#b36a20]"
        role="img"
        aria-label={`${roundedValue} de 5 estrelas`}
      >
        {Array.from({ length: 5 }, (_, index) => {
          const score = index + 1
          return (
            <Star
              key={score}
              size={18}
              aria-hidden="true"
              fill={score <= Math.round(value) ? 'currentColor' : 'none'}
            />
          )
        })}
      </span>
    )
  }

  return (
    <div
      className="inline-flex items-center gap-1"
      role="radiogroup"
      aria-label={`Avaliação: ${label}`}
      tabIndex={-1}
      onMouseLeave={() => setHovered(null)}
    >
      {Array.from({ length: 5 }, (_, index) => {
        const score = index + 1
        const selected = value === score
        return (
          <button
            key={score}
            ref={(element) => {
              radioRefs.current[index] = element
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={`${score} de 5 estrelas`}
            tabIndex={selected || (value === 0 && score === 1) ? 0 : -1}
            className={cx(
              'cursor-pointer rounded p-1 text-[#b36a20] outline-none focus-visible:ring-2 focus-visible:ring-forest-700',
              score <= activeValue ? 'opacity-100' : 'opacity-45',
            )}
            onClick={() => choose(score)}
            onKeyDown={(event) => handleKeyDown(event, score)}
            onMouseEnter={() => setHovered(score)}
          >
            <Star size={22} fill={score <= activeValue ? 'currentColor' : 'none'} />
          </button>
        )
      })}
    </div>
  )
}

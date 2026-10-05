import { cx } from './cx'

interface SectionHeadingProps {
  number: number
  title: string
  description: string
  /** Segunda seção em diante: ganha uma linha e um espaço acima. */
  separated?: boolean
}

/** Título numerado de uma seção de formulário. */
export function SectionHeading({
  number,
  title,
  description,
  separated = false,
}: SectionHeadingProps) {
  return (
    <div
      className={cx(
        'mb-6 flex items-start gap-[13px]',
        separated && 'mt-9 border-t border-line pt-[30px]',
      )}
    >
      <span className="grid size-[34px] shrink-0 place-items-center rounded-[10px] bg-forest-800 text-xs font-bold text-white">
        {number}
      </span>
      <div>
        <h2 className="mb-[3px] mt-0.5 font-sans text-lg tracking-[-0.02em]">{title}</h2>
        <p className="mb-0 text-[11px] text-muted">{description}</p>
      </div>
    </div>
  )
}

import { Check } from 'lucide-react'
import { cx } from './ui'

const steps = ['Conhecer o pet', 'Compatibilidade', 'Questionário', 'Solicitação']

interface FlowStepsProps {
  current: number
}

const connector =
  'before:absolute before:left-0 before:top-[15px] before:h-0.5 before:w-1/2 before:content-[""] first:before:hidden after:absolute after:right-0 after:top-[15px] after:h-0.5 after:w-1/2 after:content-[""] last:after:hidden'

export function FlowSteps({ current }: FlowStepsProps) {
  return (
    <ol className="mb-8 grid list-none grid-cols-4 p-0 md:mb-11" aria-label="Etapas da adoção">
      {steps.map((step, index) => {
        const done = index < current
        const isCurrent = index === current
        return (
          <li
            key={step}
            className={cx(
              'relative flex flex-col items-center gap-2 text-[11px] font-semibold text-[#929e98]',
              connector,
              'before:bg-[#dbe1dc] after:bg-[#dbe1dc]',
              done && 'before:bg-forest-700 after:bg-forest-700',
              isCurrent && 'before:bg-forest-700',
            )}
          >
            <span
              className={cx(
                'relative z-10 box-content grid size-[30px] place-items-center rounded-full border-4 border-[#f6f8f3] bg-[#e1e6e2] text-[#718078]',
                (done || isCurrent) && 'bg-forest-700 text-white',
                isCurrent && 'outline outline-[3px] outline-forest-700/15',
              )}
            >
              {done ? <Check size={14} /> : index + 1}
            </span>
            <span className={cx('hidden md:inline', isCurrent && 'font-bold text-forest-800')}>
              {step}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

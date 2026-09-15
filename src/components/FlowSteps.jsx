import { Check } from 'lucide-react'

const steps = ['Conhecer o pet', 'Compatibilidade', 'Questionário', 'Solicitação']

export function FlowSteps({ current }) {
  return (
    <ol className="flow-steps" aria-label="Etapas da adoção">
      {steps.map((step, index) => (
        <li key={step} className={index < current ? 'done' : index === current ? 'current' : ''}>
          <span className="step-dot">{index < current ? <Check size={14} /> : index + 1}</span>
          <span className="step-label">{step}</span>
        </li>
      ))}
    </ol>
  )
}

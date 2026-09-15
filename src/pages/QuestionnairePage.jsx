import { ArrowLeft, ArrowRight, CheckCircle2, Info } from 'lucide-react'
import { useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { FlowSteps } from '../components/FlowSteps'
import { Field } from '../components/UI'

const initialForm = {
  motivation: '',
  routine: '',
  aloneTime: 'Até 4 horas',
  adaptation: '',
  costs: false,
  commitment: false,
}

export function QuestionnairePage({ pets, onSubmit }) {
  const { petId } = useParams()
  const pet = pets.find((item) => item.id === petId)
  const navigate = useNavigate()
  const [form, setForm] = useState(initialForm)
  const [attempted, setAttempted] = useState(false)
  if (!pet) return <Navigate to="/pets" replace />

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }))
  const valid = form.motivation.trim().length >= 20 && form.routine.trim().length >= 20 && form.adaptation.trim().length >= 15 && form.costs && form.commitment
  const submit = (event) => {
    event.preventDefault()
    setAttempted(true)
    if (!valid) return
    const request = onSubmit(pet, form)
    navigate(`/solicitacoes/${request.id}/enviada`)
  }

  return (
    <div className="page-surface">
      <section className="container flow-page narrow-flow">
        <Link className="back-link" to={`/pets/${pet.id}/compatibilidade`}><ArrowLeft size={17} /> Voltar para compatibilidade</Link>
        <FlowSteps current={2} />
        <div className="flow-title compact"><span className="eyebrow">Questionário de adoção</span><h1>Conte um pouco sobre a vida que você imagina com {pet.name}.</h1><p>Suas respostas ajudam {pet.organization} a entender melhor sua rotina e suas expectativas.</p></div>
        <div className="questionnaire-layout">
          <form className="questionnaire-card" onSubmit={submit} noValidate>
            <div className="form-section-heading"><span>1</span><div><h2>Sua motivação e rotina</h2><p>Responda com sinceridade. Não existe resposta perfeita.</p></div></div>
            <Field label={`Por que você quer adotar ${pet.name}?`} hint={`${form.motivation.length}/500 caracteres`} full>
              <textarea maxLength="500" rows="5" value={form.motivation} onChange={(event) => update('motivation', event.target.value)} placeholder="Conte o que chamou sua atenção e o que espera dessa adoção..." />
            </Field>
            <Field label="Como é um dia comum na sua casa?" hint={`${form.routine.length}/500 caracteres`} full>
              <textarea maxLength="500" rows="5" value={form.routine} onChange={(event) => update('routine', event.target.value)} placeholder="Fale sobre horários, pessoas em casa, passeios e atividades..." />
            </Field>
            <Field label="Por quanto tempo o pet ficaria sozinho?" full>
              <select value={form.aloneTime} onChange={(event) => update('aloneTime', event.target.value)}><option>Até 2 horas</option><option>Até 4 horas</option><option>De 4 a 8 horas</option><option>Mais de 8 horas</option></select>
            </Field>
            <div className="form-section-heading second"><span>2</span><div><h2>Adaptação e compromisso</h2><p>A adoção é um compromisso para toda a vida do animal.</p></div></div>
            <Field label="Como você pretende conduzir o período de adaptação?" hint={`${form.adaptation.length}/350 caracteres`} full>
              <textarea maxLength="350" rows="4" value={form.adaptation} onChange={(event) => update('adaptation', event.target.value)} placeholder="Conte sobre o espaço, a rotina inicial e a adaptação com outros moradores..." />
            </Field>
            <label className="check-field"><input type="checkbox" checked={form.costs} onChange={(event) => update('costs', event.target.checked)} /><span><strong>Estou ciente dos custos recorrentes</strong><small>Alimentação, vacinas, consultas, medicamentos e outros cuidados.</small></span></label>
            <label className="check-field"><input type="checkbox" checked={form.commitment} onChange={(event) => update('commitment', event.target.checked)} /><span><strong>Assumo o compromisso com o bem-estar do pet</strong><small>Inclusive em mudanças de rotina, moradia ou composição familiar.</small></span></label>
            {attempted && !valid && <div className="form-error"><Info size={17} /> Preencha as respostas com mais detalhes e confirme os dois compromissos.</div>}
            <div className="questionnaire-actions"><span>Suas respostas ficam salvas apenas nesta simulação.</span><button className="button primary" type="submit">Revisar e enviar solicitação <ArrowRight size={18} /></button></div>
          </form>
          <aside className="pet-side-summary"><img src={pet.image} alt={pet.name} /><div><span className="eyebrow">Sua solicitação</span><h2>{pet.name}</h2><p>{pet.breed} · {pet.ageLabel}</p></div><ul><li><CheckCircle2 size={16} /> Perfil preenchido</li><li><CheckCircle2 size={16} /> Compatibilidade calculada</li><li className="current"><span>3</span> Questionário em andamento</li></ul><div className="info-note"><Info size={17} /><p>Depois do envio, a organização poderá entrar em contato para conversar e agendar uma visita.</p></div></aside>
        </div>
      </section>
    </div>
  )
}

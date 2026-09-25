import { AlertTriangle, ArrowLeft, ArrowRight, Check, Home, Info, Sparkles } from 'lucide-react'
import type { CSSProperties } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { FlowSteps } from '../components/FlowSteps'
import type { Pet, Profile } from '../types'

interface CompatibilityPageProps {
  pets: Pet[]
  profile: Profile
}

interface CompatibilityCheck {
  ok: boolean
  good: string
  attention: string
}

interface CompatibilityResult {
  score: number
  level: 'Alta' | 'Média' | 'Baixa'
  good: CompatibilityCheck[]
  attention: CompatibilityCheck[]
}

function calculateCompatibility(pet: Pet, profile: Profile): CompatibilityResult {
  const checks: CompatibilityCheck[] = [
    { ok: pet.energy !== 'Alta' || profile.activityLevel === 'Ativo', good: `Sua rotina ${profile.activityLevel.toLowerCase()} combina com o nível de energia de ${pet.name}.`, attention: `${pet.name} tem energia alta e pode precisar de mais atividade do que a sua rotina atual.` },
    { ok: !pet.space.toLowerCase().includes('quintal') || profile.hasOutdoorArea, good: `Sua moradia atende à necessidade de espaço de ${pet.name}.`, attention: `${pet.name} se beneficia de área externa; planeje passeios e atividades extras.` },
    { ok: pet.children || !profile.hasChildren, good: 'A composição da sua casa é adequada para este pet.', attention: `${pet.name} prefere uma casa sem crianças.` },
    { ok: pet.otherPets || !profile.hasOtherPets, good: 'A convivência com os animais da casa tende a ser positiva.', attention: `${pet.name} prefere ser o único pet; será necessária uma adaptação cuidadosa.` },
    { ok: !pet.specialCare || profile.acceptsSpecialCare, good: pet.specialCare ? 'Você informou disponibilidade para os cuidados especiais necessários.' : `${pet.name} não possui cuidados especiais contínuos.`, attention: `${pet.name} precisa de cuidados especiais que ainda não constam como disponíveis no seu perfil.` },
    { ok: profile.experience !== 'Primeiro pet', good: 'Sua experiência anterior ajuda na adaptação e nos cuidados.', attention: 'Como será seu primeiro pet, uma rede de apoio será importante no início.' },
  ]
  const matched = checks.filter((item) => item.ok).length
  const score = Math.round((matched / checks.length) * 100)
  return { score, level: score >= 80 ? 'Alta' : score >= 55 ? 'Média' : 'Baixa', good: checks.filter((item) => item.ok), attention: checks.filter((item) => !item.ok) }
}

export function CompatibilityPage({ pets, profile }: CompatibilityPageProps) {
  const { petId } = useParams()
  const pet = pets.find((item) => item.id === petId)
  if (!pet) return <Navigate to="/pets" replace />
  const result = calculateCompatibility(pet, profile)

  return (
    <div className="page-surface">
      <section className="container flow-page">
        <Link className="back-link" to={`/pets/${pet.id}`}><ArrowLeft size={17} /> Voltar para os detalhes</Link>
        <FlowSteps current={1} />
        <div className="flow-title"><span className="eyebrow"><Sparkles size={15} /> Avaliação orientativa</span><h1>Você e {pet.name} têm uma compatibilidade <em>{result.level.toLowerCase()}</em>.</h1><p>Comparamos as informações do seu perfil com as necessidades deste pet.</p></div>
        <div className="compatibility-layout">
          <aside className="score-card">
            <div className="score-ring" style={{ '--score': `${result.score * 3.6}deg` } as CSSProperties}><div><strong>{result.score}%</strong><span>compatível</span></div></div>
            <span className={`level-badge level-${result.level.toLowerCase()}`}>Compatibilidade {result.level.toLowerCase()}</span>
            <div className="mini-pet"><img src={pet.image} alt={pet.name} /><span><strong>{pet.name}</strong><small>{pet.breed} · {pet.ageLabel}</small></span></div>
            <div className="profile-summary"><Home size={17} /><span><strong>Seu perfil</strong><small>{profile.housing} · rotina {profile.activityLevel.toLowerCase()}</small></span><Link to="/perfil">Editar</Link></div>
          </aside>
          <div className="criteria-column">
            <section className="criteria-card success-card"><div className="criteria-heading"><span><Check /></span><div><h2>Pontos que combinam</h2><p>{result.good.length} critérios atendidos</p></div></div><ul>{result.good.map((item) => <li key={item.good}><Check size={17} /> {item.good}</li>)}</ul></section>
            <section className="criteria-card attention-card"><div className="criteria-heading"><span><AlertTriangle /></span><div><h2>Pontos para conversar</h2><p>{result.attention.length || 'Nenhum'} {result.attention.length === 1 ? 'ponto de atenção' : 'pontos de atenção'}</p></div></div>{result.attention.length ? <ul>{result.attention.map((item) => <li key={item.attention}><AlertTriangle size={17} /> {item.attention}</li>)}</ul> : <p className="all-good">Seu perfil atende a todos os critérios avaliados para este pet.</p>}</section>
            <div className="info-note"><Info size={18} /><p><strong>Este resultado não é uma decisão automática.</strong> A organização responsável analisará seu perfil e as respostas do questionário antes de aprovar a adoção.</p></div>
            <div className="flow-actions"><Link className="button ghost" to={`/pets/${pet.id}`}>Rever detalhes</Link><Link className="button primary" to={`/pets/${pet.id}/questionario`}>Continuar para o questionário <ArrowRight size={18} /></Link></div>
          </div>
        </div>
      </section>
    </div>
  )
}

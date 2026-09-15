import { Check, Info, Save, UserRound } from 'lucide-react'
import { useState } from 'react'
import { Field, PageIntro } from '../components/UI'

export function ProfilePage({ profile, onSave }) {
  const [draft, setDraft] = useState(profile)
  const [saved, setSaved] = useState(false)
  const update = (key, value) => { setDraft((current) => ({ ...current, [key]: value })); setSaved(false) }
  const submit = (event) => { event.preventDefault(); onSave(draft); setSaved(true); window.scrollTo({ top: 0, behavior: 'smooth' }) }

  return (
    <div className="page-surface">
      <section className="container page-section profile-page">
        <PageIntro eyebrow="Seu espaço no AdotaPet" title="Perfil do adotante" description="Essas informações são usadas para calcular sua compatibilidade e apoiar uma adoção responsável." />
        {saved && <div className="save-message"><Check size={18} /> Perfil atualizado. As próximas compatibilidades usarão estes dados.</div>}
        <form className="profile-form" onSubmit={submit}>
          <aside className="profile-aside"><span className="profile-avatar"><UserRound size={34} /></span><h2>{draft.name}</h2><p>Perfil completo</p><div className="profile-progress"><span style={{ width: '100%' }} /></div><div className="info-note"><Info size={17} /><p>Seus dados são compartilhados apenas com a organização quando você envia uma solicitação.</p></div></aside>
          <div className="profile-fields">
            <section><div className="form-section-heading"><span>1</span><div><h2>Moradia e composição da casa</h2><p>Conte como é o ambiente onde o pet viverá.</p></div></div><div className="form-grid"><Field label="Tipo de moradia"><select value={draft.housing} onChange={(event) => update('housing', event.target.value)}><option>Apartamento</option><option>Casa</option><option>Chácara ou sítio</option></select></Field><Field label="Área externa segura?"><select value={draft.hasOutdoorArea ? 'Sim' : 'Não'} onChange={(event) => update('hasOutdoorArea', event.target.value === 'Sim')}><option>Não</option><option>Sim</option></select></Field><Field label="Há crianças na residência?"><select value={draft.hasChildren ? 'Sim' : 'Não'} onChange={(event) => update('hasChildren', event.target.value === 'Sim')}><option>Não</option><option>Sim</option></select></Field><Field label="Já há outros pets?"><select value={draft.hasOtherPets ? 'Sim' : 'Não'} onChange={(event) => update('hasOtherPets', event.target.value === 'Sim')}><option>Não</option><option>Sim</option></select></Field></div></section>
            <section><div className="form-section-heading"><span>2</span><div><h2>Rotina e experiência</h2><p>Isso nos ajuda a considerar energia, companhia e cuidados.</p></div></div><div className="form-grid"><Field label="Tempo disponível por dia"><select value={draft.dailyTime} onChange={(event) => update('dailyTime', event.target.value)}><option>Até 1 hora</option><option>2 a 3 horas</option><option>Mais de 3 horas</option></select></Field><Field label="Nível de atividade"><select value={draft.activityLevel} onChange={(event) => update('activityLevel', event.target.value)}><option>Tranquilo</option><option>Moderado</option><option>Ativo</option></select></Field><Field label="Experiência com animais"><select value={draft.experience} onChange={(event) => update('experience', event.target.value)}><option>Primeiro pet</option><option>Já tive pets</option><option>Tenho bastante experiência</option></select></Field><Field label="Disponibilidade para cuidados especiais?"><select value={draft.acceptsSpecialCare ? 'Sim' : 'Não'} onChange={(event) => update('acceptsSpecialCare', event.target.value === 'Sim')}><option>Não</option><option>Sim</option></select></Field></div></section>
            <section><div className="form-section-heading"><span>3</span><div><h2>Preferências</h2><p>Preferências ajudam na busca, mas não limitam suas possibilidades.</p></div></div><div className="form-grid"><Field label="Espécie"><select value={draft.preferredSpecies} onChange={(event) => update('preferredSpecies', event.target.value)}><option>Sem preferência</option><option>Cachorro</option><option>Gato</option></select></Field><Field label="Porte"><select value={draft.preferredSize} onChange={(event) => update('preferredSize', event.target.value)}><option>Sem preferência</option><option>Pequeno</option><option>Pequeno ou médio</option><option>Médio ou grande</option></select></Field></div></section>
            <div className="profile-submit"><p>Alterações relevantes podem mudar os resultados de compatibilidade.</p><button className="button primary" type="submit"><Save size={18} /> Salvar perfil</button></div>
          </div>
        </form>
      </section>
    </div>
  )
}

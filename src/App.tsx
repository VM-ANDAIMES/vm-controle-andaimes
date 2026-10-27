import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import {
  Activity, AlertTriangle, ArrowDownToLine, CalendarDays, Check, ChevronDown,
  ClipboardList, Clock3, Construction, Database, FilePlus2, LogOut, Menu,
  Plus, RefreshCw, Search, ShieldCheck, Trash2, X
} from 'lucide-react'
import { conditionLabel, daysMounted, Inspection, isSupabaseConfigured, Scaffold, ScaffoldStatus, statusLabel, supabase, today } from './lib'

type Tab = 'painel' | 'montagens' | 'inspecoes'
const emptyForm = {
  client: '', work_site: '', requester: '', description: '', mounted_at: today(),
  responsible: '', notes: '', status: 'montado' as ScaffoldStatus
}

export default function App() {
  const [session, setSession] = useState<any>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [recoveringPassword, setRecoveringPassword] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [tab, setTab] = useState<Tab>('painel')
  const [scaffolds, setScaffolds] = useState<Scaffold[]>([])
  const [inspections, setInspections] = useState<Inspection[]>([])
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState('')
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('todos')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Scaffold | null>(null)
  const [selected, setSelected] = useState<Scaffold | null>(null)
  const [form, setForm] = useState({ ...emptyForm })
  const [showInspection, setShowInspection] = useState(false)
  const [inspectionForm, setInspectionForm] = useState({ scaffold_id: '', inspected_at: today(), inspector: '', condition: 'adequado' as Inspection['condition'], notes: '' })
  const [showRemoval, setShowRemoval] = useState<Scaffold | null>(null)
  const [removalForm, setRemovalForm] = useState({ removed_at: today(), removal_responsible: '', removal_notes: '' })

  const notify = (msg: string) => { setNotice(msg); window.setTimeout(() => setNotice(''), 4500) }

  const loadData = useCallback(async () => {
    if (!supabase || !session) return
    setLoading(true)
    const [s, i] = await Promise.all([
      supabase.from('scaffolds').select('*').order('created_at', { ascending: false }),
      supabase.from('scaffold_inspections').select('*').order('inspected_at', { ascending: false })
    ])
    if (s.error) notify(`Erro ao carregar montagens: ${s.error.message}`)
    else setScaffolds((s.data || []) as Scaffold[])
    if (i.error) notify(`Erro ao carregar inspeções: ${i.error.message}`)
    else setInspections((i.data || []) as Inspection[])
    setLoading(false)
  }, [session])

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: listener } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next)
      if (event === 'PASSWORD_RECOVERY') {
        setRecoveringPassword(true)
        setLoginError('')
      }
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => { void loadData() }, [loadData])

  const active = useMemo(() => scaffolds.filter(s => s.status !== 'retirado'), [scaffolds])
  const old = useMemo(() => active.filter(s => daysMounted(s.mounted_at) >= 30), [active])
  const pending = useMemo(() => inspections.filter(i => i.condition !== 'adequado').length, [inspections])
  const filtered = useMemo(() => scaffolds.filter(s => {
    const haystack = [s.code, s.client, s.work_site, s.requester, s.description, s.responsible].join(' ').toLowerCase()
    return haystack.includes(query.toLowerCase()) && (statusFilter === 'todos' || s.status === statusFilter)
  }), [scaffolds, query, statusFilter])

  async function login(e: FormEvent) {
    e.preventDefault()
    if (!supabase) return
    setLoginError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setLoginError('Não foi possível entrar. Confira o e-mail, a senha e se o usuário foi criado no Supabase.')
  }
  async function recoverPassword(e: FormEvent) {
    e.preventDefault()
    if (!supabase) return
    setLoginError('')
    if (!email.trim()) {
      setLoginError('Digite seu e-mail para receber o link de recuperacao.')
      return
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin
    })
    if (error) {
      setLoginError('Nao foi possivel enviar o link: ' + error.message)
    } else {
      setLoginError('Se o e-mail estiver cadastrado, voce recebera as instrucoes de recuperacao.')
    }
  }

  async function saveNewPassword(e: FormEvent) {
    e.preventDefault()
    if (!supabase) return

    if (newPassword.length < 8) {
      setLoginError('A nova senha precisa ter pelo menos 8 caracteres.')
      return
    }

    if (newPassword !== confirmNewPassword) {
      setLoginError('As senhas nao conferem.')
      return
    }

    setLoginError('')
    const { error } = await supabase.auth.updateUser({ password: newPassword })

    if (error) {
      setLoginError('Nao foi possivel alterar a senha: ' + error.message)
      return
    }

    await supabase.auth.signOut()
    setSession(null)
    setRecoveringPassword(false)
    setNewPassword('')
    setConfirmNewPassword('')
    setLoginError('Senha alterada com sucesso. Entre com sua nova senha.')
  }
  async function logout() { await supabase?.auth.signOut(); setScaffolds([]); setInspections([]) }

  function openNew() {
    setEditing(null); setForm({ ...emptyForm }); setShowForm(true)
  }
  function openEdit(item: Scaffold) {
    setEditing(item)
    setForm({
      client: item.client, work_site: item.work_site, requester: item.requester,
      description: item.description, mounted_at: item.mounted_at, responsible: item.responsible,
      notes: item.notes || '', status: item.status
    })
    setShowForm(true)
  }
  async function saveScaffold(e: FormEvent) {
    e.preventDefault()
    if (!supabase) return
    const payload = { ...form, notes: form.notes || null }
    const result = editing
      ? await supabase.from('scaffolds').update(payload).eq('id', editing.id).select().single()
      : await supabase.from('scaffolds').insert(payload).select().single()
    if (result.error) { notify(`Não foi possível salvar: ${result.error.message}`); return }
    setShowForm(false); notify(editing ? 'Montagem atualizada.' : 'Montagem cadastrada.')
    await loadData()
  }
  async function saveInspection(e: FormEvent) {
    e.preventDefault()
    if (!supabase) return
    const { error } = await supabase.from('scaffold_inspections').insert(inspectionForm)
    if (error) { notify(`Não foi possível salvar inspeção: ${error.message}`); return }
    setShowInspection(false); setInspectionForm({ scaffold_id: '', inspected_at: today(), inspector: '', condition: 'adequado', notes: '' })
    notify('Inspeção registrada.'); await loadData()
  }
  async function removeScaffold(e: FormEvent) {
    e.preventDefault()
    if (!supabase || !showRemoval) return
    const { error } = await supabase.from('scaffolds').update({
      status: 'retirado', removed_at: removalForm.removed_at,
      removal_responsible: removalForm.removal_responsible,
      removal_notes: removalForm.removal_notes || null
    }).eq('id', showRemoval.id)
    if (error) { notify(`Não foi possível registrar retirada: ${error.message}`); return }
    setShowRemoval(null); notify('Retirada registrada e histórico preservado.'); await loadData()
  }
  async function deleteScaffold(item: Scaffold) {
    if (!supabase || !window.confirm(`Excluir permanentemente ${item.code}? Esta ação não pode ser desfeita.`)) return
    const { error } = await supabase.from('scaffolds').delete().eq('id', item.id)
    if (error) notify(`Não foi possível excluir: ${error.message}`)
    else { notify('Registro excluído.'); await loadData() }
  }
  function exportCsv() {
    const headers = ['Código','Cliente','Obra','Solicitante','Descrição','Data montagem','Dias montado','Responsável','Status','Observações','Data retirada','Responsável retirada']
    const rows = filtered.map(s => [s.code,s.client,s.work_site,s.requester,s.description,s.mounted_at,daysMounted(s.mounted_at,s.removed_at),s.responsible,statusLabel[s.status],s.notes || '',s.removed_at || '',s.removal_responsible || ''])
    const csv = [headers, ...rows].map(row => row.map(v => `"${String(v ?? '').replace(/"/g,'""')}"`).join(';')).join('\r\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob); const a = document.createElement('a')
    a.href = url; a.download = 'controle-andaimes-vm.csv'; a.click(); URL.revokeObjectURL(url)
  }

  if (!isSupabaseConfigured) return <SetupScreen />
if (recoveringPassword) return <div className="login-page"><div className="login-card"><div className="brand-mark brand-logo"><img src="/logo-vm.png" alt="Logo VM Andaimes" /></div><p className="eyebrow">VM ANDAIMES</p><h1>Nova <span>senha</span></h1><p className="muted">Cadastre sua nova senha para acessar o sistema.</p><form onSubmit={saveNewPassword} className="stack"><label>Nova senha<input type="password" required minLength={8} autoComplete="new-password" value={newPassword} onChange={e=>setNewPassword(e.target.value)} placeholder="Minimo de 8 caracteres"/></label><label>Confirmar nova senha<input type="password" required minLength={8} autoComplete="new-password" value={confirmNewPassword} onChange={e=>setConfirmNewPassword(e.target.value)} placeholder="Digite a senha novamente"/></label>{loginError && <p className="error">{loginError}</p>}<button className="btn primary full" type="submit">Salvar nova senha</button></form></div></div>
  if (!session) return <div className="login-page"><div className="login-card"><div className="brand-mark brand-logo"><img src="/logo-vm.png" alt="Logo VM Andaimes" /></div><p className="eyebrow">VM ANDAIMES</p><h1>Controle de <span>Andaimes</span></h1><p className="muted">Entre para acompanhar montagens, inspeções e retiradas.</p><form onSubmit={login} className="stack"><label>E-mail<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="seu@email.com"/></label><label>Senha<input type="password" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="Sua senha"/></label><button type="button" onClick={recoverPassword} style={{ background: 'none', border: 0, color: '#f57c00', cursor: 'pointer', padding: 0, textAlign: 'left' }}>Esqueci minha senha</button>{loginError && <p className="error">{loginError}</p>}<button className="btn primary full" type="submit">Entrar no sistema</button></form><p className="login-foot"><ShieldCheck size={15}/> Acesso restrito a usuários autorizados</p></div></div>

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark brand-logo"><img src="/logo-vm.png" alt="Logo VM Andaimes" /></div><div><strong>VM <span>ANDAIMES</span></strong><small>CONTROLE OPERACIONAL</small></div></div>
      <div className="side-label">MENU PRINCIPAL</div>
      <button className={`nav-item ${tab==='painel'?'active':''}`} onClick={()=>setTab('painel')}><Activity size={18}/> Painel geral</button>
      <button className={`nav-item ${tab==='montagens'?'active':''}`} onClick={()=>setTab('montagens')}><Construction size={18}/> Montagens</button>
      <button className={`nav-item ${tab==='inspecoes'?'active':''}`} onClick={()=>setTab('inspecoes')}><ClipboardList size={18}/> Inspeções</button>
      <div className="sidebar-bottom"><div className="safe-box"><ShieldCheck size={20}/><div><strong>Segurança em primeiro lugar</strong><small>Registre inspeções e ocorrências.</small></div></div><button className="nav-item" onClick={logout}><LogOut size={18}/> Sair do sistema</button></div>
    </aside>
    <main className="main-area">
      <header className="topbar"><div><p className="eyebrow">GESTÃO DE CAMPO</p><h1>{tab==='painel'?'Painel geral':tab==='montagens'?'Controle de montagens':'Inspeções registradas'}</h1></div><div className="top-actions"><span className="online-dot">Sistema online</span><button className="icon-btn" onClick={()=>void loadData()} title="Atualizar"><RefreshCw size={18}/></button><button className="btn primary" onClick={openNew}><Plus size={18}/> Nova montagem</button></div></header>
      {notice && <div className="toast"><Check size={17}/>{notice}<button onClick={()=>setNotice('')}><X size={16}/></button></div>}
      {tab==='painel' && <>
        <section className="welcome"><div><p className="eyebrow">VISÃO GERAL</p><h2>Olá! Vamos manter tudo sob controle.</h2><p>Acompanhe o tempo de montagem e as atividades da equipe em um só lugar.</p></div><div className="welcome-icon brand-logo"><img src="/logo-vm.png" alt="Logo VM Andaimes" /></div></section>
        <section className="stats-grid">
          <Stat icon={<Construction/>} label="Andaimes ativos" value={active.length} detail="Montados ou aguardando retirada" />
          <Stat icon={<Clock3/>} label="Há 30 dias ou mais" value={old.length} detail="Requerem acompanhamento" accent />
          <Stat icon={<AlertTriangle/>} label="Inspeções com pendência" value={pending} detail="Registros que precisam de atenção" warning={pending>0}/>
          <Stat icon={<ArrowDownToLine/>} label="Retirados" value={scaffolds.filter(s=>s.status==='retirado').length} detail="Histórico de desmontagens" />
        </section>
        <section className="panel"><div className="panel-heading"><div><h2>Montagens recentes</h2><p>Confira os últimos registros operacionais.</p></div><button className="btn secondary" onClick={()=>setTab('montagens')}>Ver todas</button></div><ScaffoldTable items={scaffolds.slice(0,5)} onSelect={setSelected} onEdit={openEdit} onRemove={setShowRemoval}/></section>
        <section className="safety-note"><ShieldCheck size={22}/><div><strong>Atenção à segurança</strong><p>O tempo de montagem é apenas um indicador administrativo. Ele não substitui inspeções, avaliações técnicas ou a autorização para uso do andaime.</p></div></section>
      </>}
      {tab==='montagens' && <section className="panel"><div className="panel-heading"><div><h2>Todos os andaimes</h2><p>Pesquise, atualize e acompanhe cada montagem.</p></div><button className="btn secondary" onClick={exportCsv}><ArrowDownToLine size={17}/> Exportar CSV</button></div><div className="filters"><div className="searchbox"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar código, obra, cliente ou solicitante..."/></div><select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value="todos">Todos os status</option><option value="montado">Montado</option><option value="aguardando_retirada">Aguardando retirada</option><option value="retirado">Retirado</option></select></div><ScaffoldTable items={filtered} onSelect={setSelected} onEdit={openEdit} onRemove={setShowRemoval} onDelete={deleteScaffold}/></section>}
      {tab==='inspecoes' && <section className="panel"><div className="panel-heading"><div><h2>Histórico de inspeções</h2><p>Registre as condições observadas e acompanhe as pendências.</p></div><button className="btn primary" onClick={()=>setShowInspection(true)}><Plus size={17}/> Registrar inspeção</button></div><div className="inspection-list">{inspections.map(i=>{const s=scaffolds.find(x=>x.id===i.scaffold_id);return <div className="inspection-row" key={i.id}><div className={`condition-icon ${i.condition}`}><ClipboardList size={20}/></div><div className="inspection-main"><div className="inspection-title">{s?.code || 'Andaime'} · {s?.work_site || 'Obra não informada'}<span className={`pill ${i.condition}`}>{conditionLabel[i.condition]}</span></div><p>{i.notes || 'Sem observações registradas.'}</p><small>{i.inspector} · {new Date(`${i.inspected_at}T00:00:00`).toLocaleDateString('pt-BR')}</small></div></div>})}{!inspections.length && <Empty text="Nenhuma inspeção registrada ainda."/>}</div></section>}
      {loading && <div className="loading-line">Atualizando dados…</div>}
    </main>
    {showForm && <Modal title={editing?'Editar montagem':'Cadastrar nova montagem'} onClose={()=>setShowForm(false)}><form className="form-grid" onSubmit={saveScaffold}>
      <label>Cliente<input required value={form.client} onChange={e=>setForm({...form,client:e.target.value})} placeholder="Nome do cliente"/></label>
      <label>Obra / local<input required value={form.work_site} onChange={e=>setForm({...form,work_site:e.target.value})} placeholder="Ex.: Unidade industrial"/></label>
      <label>Solicitante<input required value={form.requester} onChange={e=>setForm({...form,requester:e.target.value})} placeholder="Quem solicitou"/></label>
      <label>Responsável pela montagem<input required value={form.responsible} onChange={e=>setForm({...form,responsible:e.target.value})} placeholder="Nome do responsável"/></label>
      <label>Data da montagem<input type="date" required value={form.mounted_at} onChange={e=>setForm({...form,mounted_at:e.target.value})}/></label>
      <label>Status<select value={form.status} onChange={e=>setForm({...form,status:e.target.value as ScaffoldStatus})}><option value="montado">Montado</option><option value="aguardando_retirada">Aguardando retirada</option></select></label>
      <label className="wide">Descrição do andaime<input required value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="Finalidade, local exato e características"/></label>
      <label className="wide">Observações<textarea rows={3} value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="Informações adicionais, restrições ou pendências"/></label>
      <div className="modal-actions wide"><button type="button" className="btn secondary" onClick={()=>setShowForm(false)}>Cancelar</button><button className="btn primary" type="submit"><Check size={17}/> Salvar montagem</button></div>
    </form></Modal>}
    {showInspection && <Modal title="Registrar inspeção" onClose={()=>setShowInspection(false)}><form className="form-grid" onSubmit={saveInspection}>
      <label className="wide">Andaime<select required value={inspectionForm.scaffold_id} onChange={e=>setInspectionForm({...inspectionForm,scaffold_id:e.target.value})}><option value="">Selecione uma montagem</option>{active.map(s=><option key={s.id} value={s.id}>{s.code} — {s.work_site}</option>)}</select></label>
      <label>Data da inspeção<input type="date" required value={inspectionForm.inspected_at} onChange={e=>setInspectionForm({...inspectionForm,inspected_at:e.target.value})}/></label>
      <label>Responsável<input required value={inspectionForm.inspector} onChange={e=>setInspectionForm({...inspectionForm,inspector:e.target.value})} placeholder="Nome do inspetor"/></label>
      <label className="wide">Condição observada<select value={inspectionForm.condition} onChange={e=>setInspectionForm({...inspectionForm,condition:e.target.value as Inspection['condition']})}><option value="adequado">Adequado</option><option value="pendencia">Com pendência</option><option value="interditado">Interditado</option></select></label>
      <label className="wide">Observações da inspeção<textarea required rows={3} value={inspectionForm.notes} onChange={e=>setInspectionForm({...inspectionForm,notes:e.target.value})} placeholder="Descreva o que foi verificado"/></label>
      <div className="modal-actions wide"><button type="button" className="btn secondary" onClick={()=>setShowInspection(false)}>Cancelar</button><button className="btn primary" type="submit">Salvar inspeção</button></div>
    </form></Modal>}
    {showRemoval && <Modal title={`Registrar retirada — ${showRemoval.code}`} onClose={()=>setShowRemoval(null)}><form className="form-grid" onSubmit={removeScaffold}>
      <label>Data da retirada<input type="date" required value={removalForm.removed_at} onChange={e=>setRemovalForm({...removalForm,removed_at:e.target.value})}/></label>
      <label>Responsável pela retirada<input required value={removalForm.removal_responsible} onChange={e=>setRemovalForm({...removalForm,removal_responsible:e.target.value})} placeholder="Nome do responsável"/></label>
      <label className="wide">Observações<textarea rows={3} value={removalForm.removal_notes} onChange={e=>setRemovalForm({...removalForm,removal_notes:e.target.value})} placeholder="Condições ou observações da retirada"/></label>
      <div className="modal-actions wide"><button type="button" className="btn secondary" onClick={()=>setShowRemoval(null)}>Cancelar</button><button className="btn primary" type="submit">Confirmar retirada</button></div>
    </form></Modal>}
    {selected && <Modal title={`Detalhes — ${selected.code}`} onClose={()=>setSelected(null)}><div className="detail-grid">{[['Cliente',selected.client],['Obra',selected.work_site],['Solicitante',selected.requester],['Responsável',selected.responsible],['Descrição',selected.description],['Data da montagem',new Date(`${selected.mounted_at}T00:00:00`).toLocaleDateString('pt-BR')],['Tempo montado',`${daysMounted(selected.mounted_at,selected.removed_at)} dias`],['Status',statusLabel[selected.status]],['Observações',selected.notes || '—'],['Data da retirada',selected.removed_at ? new Date(`${selected.removed_at}T00:00:00`).toLocaleDateString('pt-BR') : '—'],['Responsável pela retirada',selected.removal_responsible || '—'],['Observações da retirada',selected.removal_notes || '—']].map(([k,v])=><div className="detail-item" key={k}><small>{k}</small><p>{v}</p></div>)}</div><div className="modal-actions"><button className="btn secondary" onClick={()=>setSelected(null)}>Fechar</button><button className="btn primary" onClick={()=>{setSelected(null);openEdit(selected)}}>Editar registro</button></div></Modal>}
  </div>
}

function Stat({icon,label,value,detail,accent,warning}:{icon:React.ReactNode,label:string,value:number,detail:string,accent?:boolean,warning?:boolean}) {
  return <div className={`stat-card ${accent?'accent':''} ${warning?'warning':''}`}><div className="stat-top"><span>{label}</span><span className="stat-icon">{icon}</span></div><strong>{value}</strong><p>{detail}</p></div>
}
function ScaffoldTable({items,onSelect,onEdit,onRemove,onDelete}:{items:Scaffold[],onSelect:(s:Scaffold)=>void,onEdit:(s:Scaffold)=>void,onRemove:(s:Scaffold)=>void,onDelete?:(s:Scaffold)=>void}) {
  if (!items.length) return <Empty text="Nenhum andaime encontrado. Cadastre a primeira montagem."/>
  return <div className="table-wrap"><table><thead><tr><th>Identificação</th><th>Obra / cliente</th><th>Solicitante</th><th>Montado há</th><th>Status</th><th>Ações</th></tr></thead><tbody>{items.map(s=><tr key={s.id}><td><button className="code-link" onClick={()=>onSelect(s)}>{s.code}</button><small>{s.description}</small></td><td><strong>{s.work_site}</strong><small>{s.client}</small></td><td>{s.requester}</td><td><strong>{daysMounted(s.mounted_at,s.removed_at)} dias</strong><small>{new Date(`${s.mounted_at}T00:00:00`).toLocaleDateString('pt-BR')}</small></td><td><span className={`pill ${s.status}`}>{statusLabel[s.status]}</span></td><td><div className="actions"><button className="mini-btn" title="Detalhes" onClick={()=>onSelect(s)}><ClipboardList size={16}/></button><button className="mini-btn" title="Editar" onClick={()=>onEdit(s)}><FilePlus2 size={16}/></button>{s.status!=='retirado' && <button className="mini-btn" title="Registrar retirada" onClick={()=>onRemove(s)}><ArrowDownToLine size={16}/></button>}{onDelete && s.status==='retirado' && <button className="mini-btn danger" title="Excluir definitivamente" onClick={()=>onDelete(s)}><Trash2 size={16}/></button>}</div></td></tr>)}</tbody></table></div>
}
function Empty({text}:{text:string}) { return <div className="empty"><Database size={28}/><p>{text}</p></div> }
function Modal({title,onClose,children}:{title:string,onClose:()=>void,children:React.ReactNode}) { return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><div className="modal"><div className="modal-head"><h2>{title}</h2><button className="icon-btn" onClick={onClose}><X size={19}/></button></div>{children}</div></div> }
function SetupScreen() {
  return <div className="login-page"><div className="login-card setup-card"><div className="brand-mark brand-logo"><img src="/logo-vm.png" alt="Logo VM Andaimes" /></div><p className="eyebrow">VM ANDAIMES</p><h1>Quase pronto!</h1><p className="muted">O site está instalado, mas falta conectar o banco de dados Supabase.</p><ol><li>Crie um projeto Supabase.</li><li>Execute o arquivo <code>supabase/schema.sql</code> no SQL Editor.</li><li>Copie <code>.env.example</code> para <code>.env</code>.</li><li>Preencha a URL do projeto e a chave pública anon.</li><li>Reinicie o servidor com <code>npm run dev</code>.</li></ol><p className="warning-text"><ShieldCheck size={16}/> Nunca coloque a chave <code>service_role</code> neste site.</p></div></div>
}






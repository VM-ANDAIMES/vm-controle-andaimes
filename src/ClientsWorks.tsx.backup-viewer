
import { FormEvent, useEffect, useState } from 'react'
import { Building2, Check, Pencil, Plus, RefreshCw, Trash2, Users } from 'lucide-react'
import { supabase } from './lib'

type Client = {
  id: string
  company_name: string
  contact_name: string | null
  phone: string | null
  email: string | null
  document_number: string | null
  address: string | null
  notes: string | null
  active: boolean
}

type Work = {
  id: string
  name: string
  client_id: string | null
  address: string | null
  responsible: string | null
  start_date: string | null
  end_date: string | null
  status: 'planejada' | 'ativa' | 'pausada' | 'concluida'
  notes: string | null
}

type Section = 'clientes' | 'obras'

const emptyClient = {
  company_name: '',
  contact_name: '',
  phone: '',
  email: '',
  document_number: '',
  address: '',
  notes: '',
  active: true,
}

const emptyWork = {
  name: '',
  client_id: '',
  address: '',
  responsible: '',
  start_date: '',
  end_date: '',
  status: 'ativa' as Work['status'],
  notes: '',
}

export default function ClientsWorks() {
  const [section, setSection] = useState<Section>('clientes')
  const [clients, setClients] = useState<Client[]>([])
  const [works, setWorks] = useState<Work[]>([])
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState('')
  const [search, setSearch] = useState('')
  const [editingClient, setEditingClient] = useState<string | null>(null)
  const [editingWork, setEditingWork] = useState<string | null>(null)
  const [clientForm, setClientForm] = useState({ ...emptyClient })
  const [workForm, setWorkForm] = useState({ ...emptyWork })
  const [showForm, setShowForm] = useState(false)

  async function loadData() {
    if (!supabase) return
    setLoading(true)

    const [clientResult, workResult] = await Promise.all([
      supabase.from('clients').select('*').order('company_name'),
      supabase.from('works').select('*').order('name'),
    ])

    if (clientResult.error) {
      setNotice('Erro ao carregar clientes: ' + clientResult.error.message)
    } else {
      setClients((clientResult.data || []) as Client[])
    }

    if (workResult.error) {
      setNotice('Erro ao carregar obras: ' + workResult.error.message)
    } else {
      setWorks((workResult.data || []) as Work[])
    }

    setLoading(false)
  }

  useEffect(() => {
    void loadData()
  }, [])

  function newClient() {
    setEditingClient(null)
    setClientForm({ ...emptyClient })
    setShowForm(true)
  }

  function editClient(client: Client) {
    setEditingClient(client.id)
    setClientForm({
      company_name: client.company_name,
      contact_name: client.contact_name || '',
      phone: client.phone || '',
      email: client.email || '',
      document_number: client.document_number || '',
      address: client.address || '',
      notes: client.notes || '',
      active: client.active,
    })
    setShowForm(true)
  }

  function newWork() {
    setEditingWork(null)
    setWorkForm({ ...emptyWork })
    setShowForm(true)
  }

  function editWork(work: Work) {
    setEditingWork(work.id)
    setWorkForm({
      name: work.name,
      client_id: work.client_id || '',
      address: work.address || '',
      responsible: work.responsible || '',
      start_date: work.start_date || '',
      end_date: work.end_date || '',
      status: work.status,
      notes: work.notes || '',
    })
    setShowForm(true)
  }

  async function saveClient(event: FormEvent) {
    event.preventDefault()
    if (!supabase) return

    const payload = {
      ...clientForm,
      company_name: clientForm.company_name.trim(),
      contact_name: clientForm.contact_name.trim() || null,
      phone: clientForm.phone.trim() || null,
      email: clientForm.email.trim() || null,
      document_number: clientForm.document_number.trim() || null,
      address: clientForm.address.trim() || null,
      notes: clientForm.notes.trim() || null,
      updated_at: new Date().toISOString(),
    }

    const result = editingClient
      ? await supabase.from('clients').update(payload).eq('id', editingClient)
      : await supabase.from('clients').insert(payload)

    if (result.error) {
      setNotice('Não foi possível salvar o cliente: ' + result.error.message)
      return
    }

    setShowForm(false)
    setNotice(editingClient ? 'Cliente atualizado.' : 'Cliente cadastrado.')
    await loadData()
  }

  async function saveWork(event: FormEvent) {
    event.preventDefault()
    if (!supabase) return

    const payload = {
      name: workForm.name.trim(),
      client_id: workForm.client_id || null,
      address: workForm.address.trim() || null,
      responsible: workForm.responsible.trim() || null,
      start_date: workForm.start_date || null,
      end_date: workForm.end_date || null,
      status: workForm.status,
      notes: workForm.notes.trim() || null,
      updated_at: new Date().toISOString(),
    }

    const result = editingWork
      ? await supabase.from('works').update(payload).eq('id', editingWork)
      : await supabase.from('works').insert(payload)

    if (result.error) {
      setNotice('Não foi possível salvar a obra: ' + result.error.message)
      return
    }

    setShowForm(false)
    setNotice(editingWork ? 'Obra atualizada.' : 'Obra cadastrada.')
    await loadData()
  }

  async function deleteClient(client: Client) {
    if (!supabase || !window.confirm(
      `Excluir o cliente "${client.company_name}"? Clientes vinculados a obras ou andaimes não podem ser excluídos.`
    )) return

    const { error } = await supabase.from('clients').delete().eq('id', client.id)

    if (error) {
      setNotice('Não foi possível excluir. Verifique se há obras ou andaimes vinculados. ' + error.message)
    } else {
      setNotice('Cliente excluído.')
      await loadData()
    }
  }

  async function deleteWork(work: Work) {
    if (!supabase || !window.confirm(
      `Excluir a obra "${work.name}"? Obras vinculadas a andaimes ou movimentações não podem ser excluídas.`
    )) return

    const { error } = await supabase.from('works').delete().eq('id', work.id)

    if (error) {
      setNotice('Não foi possível excluir. Verifique se há registros vinculados. ' + error.message)
    } else {
      setNotice('Obra excluída.')
      await loadData()
    }
  }

  const filteredClients = clients.filter(client =>
    [
      client.company_name,
      client.contact_name,
      client.phone,
      client.email,
      client.document_number,
    ].join(' ').toLowerCase().includes(search.toLowerCase())
  )

  const filteredWorks = works.filter(work =>
    [
      work.name,
      work.address,
      work.responsible,
      clients.find(client => client.id === work.client_id)?.company_name,
      work.status,
    ].join(' ').toLowerCase().includes(search.toLowerCase())
  )

  const selectedClient = clients.find(client => client.id === workForm.client_id)

  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2>Cadastro de clientes e obras</h2>
          <p>Gerencie os clientes e os locais de trabalho da VM Andaimes.</p>
        </div>
        <button className="btn secondary" type="button" onClick={() => void loadData()}>
          <RefreshCw size={17} /> Atualizar
        </button>
      </div>

      <div className="module-tabs">
        <button
          type="button"
          className={`btn ${section === 'clientes' ? 'primary' : 'secondary'}`}
          onClick={() => {
            setSection('clientes')
            setSearch('')
            setShowForm(false)
          }}
        >
          <Users size={17} /> Clientes ({clients.length})
        </button>
        <button
          type="button"
          className={`btn ${section === 'obras' ? 'primary' : 'secondary'}`}
          onClick={() => {
            setSection('obras')
            setSearch('')
            setShowForm(false)
          }}
        >
          <Building2 size={17} /> Obras ({works.length})
        </button>
      </div>

      {notice && (
        <div className="module-notice" role="status">
          {notice}
          <button type="button" onClick={() => setNotice('')}>Fechar</button>
        </div>
      )}

      {!showForm && (
        <>
          <div className="module-toolbar">
            <input
              aria-label="Pesquisar"
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder={section === 'clientes' ? 'Buscar cliente, contato ou telefone...' : 'Buscar obra, cliente ou responsável...'}
            />
            <button
              type="button"
              className="btn primary"
              onClick={section === 'clientes' ? newClient : newWork}
            >
              <Plus size={17} /> {section === 'clientes' ? 'Novo cliente' : 'Nova obra'}
            </button>
          </div>

          {loading && <p className="muted">Carregando dados...</p>}

          {section === 'clientes' && !loading && (
            <div className="module-list">
              {filteredClients.map(client => (
                <article className="module-record" key={client.id}>
                  <div className="module-record-main">
                    <h3>{client.company_name}</h3>
                    <p>{client.contact_name || 'Contato não informado'}</p>
                    <small>
                      {[client.phone, client.email, client.document_number]
                        .filter(Boolean).join(' · ') || 'Sem telefone, e-mail ou documento'}
                    </small>
                    {client.address && <p>{client.address}</p>}
                    <span className={`pill ${client.active ? 'adequado' : 'pendencia'}`}>
                      {client.active ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                  <div className="module-record-actions">
                    <button className="btn secondary" type="button" onClick={() => editClient(client)}>
                      <Pencil size={15} /> Editar
                    </button>
                    <button className="btn secondary" type="button" onClick={() => void deleteClient(client)}>
                      <Trash2 size={15} /> Excluir
                    </button>
                  </div>
                </article>
              ))}
              {!filteredClients.length && <p className="muted">Nenhum cliente encontrado.</p>}
            </div>
          )}

          {section === 'obras' && !loading && (
            <div className="module-list">
              {filteredWorks.map(work => (
                <article className="module-record" key={work.id}>
                  <div className="module-record-main">
                    <h3>{work.name}</h3>
                    <p>Cliente: {clients.find(client => client.id === work.client_id)?.company_name || 'Não vinculado'}</p>
                    <small>
                      {[work.address, work.responsible].filter(Boolean).join(' · ') || 'Endereço e responsável não informados'}
                    </small>
                    <p>
                      Status: {{
                        planejada: 'Planejada',
                        ativa: 'Ativa',
                        pausada: 'Pausada',
                        concluida: 'Concluída',
                      }[work.status]}
                    </p>
                    {work.start_date && <small>Início: {new Date(`${work.start_date}T00:00:00`).toLocaleDateString('pt-BR')}</small>}
                    {work.end_date && <small> · Fim: {new Date(`${work.end_date}T00:00:00`).toLocaleDateString('pt-BR')}</small>}
                  </div>
                  <div className="module-record-actions">
                    <button className="btn secondary" type="button" onClick={() => editWork(work)}>
                      <Pencil size={15} /> Editar
                    </button>
                    <button className="btn secondary" type="button" onClick={() => void deleteWork(work)}>
                      <Trash2 size={15} /> Excluir
                    </button>
                  </div>
                </article>
              ))}
              {!filteredWorks.length && <p className="muted">Nenhuma obra encontrada.</p>}
            </div>
          )}
        </>
      )}

      {showForm && section === 'clientes' && (
        <form className="form-grid" onSubmit={saveClient}>
          <label className="wide">Nome da empresa *
            <input required value={clientForm.company_name} onChange={event => setClientForm({ ...clientForm, company_name: event.target.value })} />
          </label>
          <label>Nome do contato
            <input value={clientForm.contact_name} onChange={event => setClientForm({ ...clientForm, contact_name: event.target.value })} />
          </label>
          <label>Telefone
            <input value={clientForm.phone} onChange={event => setClientForm({ ...clientForm, phone: event.target.value })} />
          </label>
          <label>E-mail
            <input type="email" value={clientForm.email} onChange={event => setClientForm({ ...clientForm, email: event.target.value })} />
          </label>
          <label>CNPJ / documento
            <input value={clientForm.document_number} onChange={event => setClientForm({ ...clientForm, document_number: event.target.value })} />
          </label>
          <label className="wide">Endereço
            <input value={clientForm.address} onChange={event => setClientForm({ ...clientForm, address: event.target.value })} />
          </label>
          <label className="wide">Observações
            <textarea rows={3} value={clientForm.notes} onChange={event => setClientForm({ ...clientForm, notes: event.target.value })} />
          </label>
          <label className="wide">
            <input type="checkbox" checked={clientForm.active} onChange={event => setClientForm({ ...clientForm, active: event.target.checked })} />
            Cliente ativo
          </label>
          <div className="modal-actions wide">
            <button type="button" className="btn secondary" onClick={() => setShowForm(false)}>Cancelar</button>
            <button className="btn primary" type="submit"><Check size={17} /> Salvar cliente</button>
          </div>
        </form>
      )}

      {showForm && section === 'obras' && (
        <form className="form-grid" onSubmit={saveWork}>
          <label className="wide">Nome da obra *
            <input required value={workForm.name} onChange={event => setWorkForm({ ...workForm, name: event.target.value })} />
          </label>
          <label className="wide">Cliente
            <select value={workForm.client_id} onChange={event => setWorkForm({ ...workForm, client_id: event.target.value })}>
              <option value="">Selecione um cliente (opcional)</option>
              {clients.filter(client => client.active).map(client => (
                <option key={client.id} value={client.id}>{client.company_name}</option>
              ))}
            </select>
          </label>
          <label className="wide">Endereço da obra
            <input value={workForm.address} onChange={event => setWorkForm({ ...workForm, address: event.target.value })} />
          </label>
          <label>Responsável
            <input value={workForm.responsible} onChange={event => setWorkForm({ ...workForm, responsible: event.target.value })} />
          </label>
          <label>Status
            <select value={workForm.status} onChange={event => setWorkForm({ ...workForm, status: event.target.value as Work['status'] })}>
              <option value="planejada">Planejada</option>
              <option value="ativa">Ativa</option>
              <option value="pausada">Pausada</option>
              <option value="concluida">Concluída</option>
            </select>
          </label>
          <label>Data de início
            <input type="date" value={workForm.start_date} onChange={event => setWorkForm({ ...workForm, start_date: event.target.value })} />
          </label>
          <label>Data de término
            <input type="date" value={workForm.end_date} onChange={event => setWorkForm({ ...workForm, end_date: event.target.value })} />
          </label>
          <label className="wide">Observações
            <textarea rows={3} value={workForm.notes} onChange={event => setWorkForm({ ...workForm, notes: event.target.value })} />
          </label>
          {selectedClient && <p className="muted wide">Cliente selecionado: {selectedClient.company_name}</p>}
          <div className="modal-actions wide">
            <button type="button" className="btn secondary" onClick={() => setShowForm(false)}>Cancelar</button>
            <button className="btn primary" type="submit"><Check size={17} /> Salvar obra</button>
          </div>
        </form>
      )}
    </section>
  )
}

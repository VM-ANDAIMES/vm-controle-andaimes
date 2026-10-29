
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { jsPDF } from 'jspdf'
import {
  Activity, AlertTriangle, ArrowDownToLine, Check, ClipboardList,
  Clock3, Construction, Database, FilePlus2, LogOut, Plus,
  RefreshCw, Search, ShieldCheck, Trash2, X, FileText
} from 'lucide-react'
import {
  conditionLabel, daysMounted, Inspection, isSupabaseConfigured,
  Scaffold, ScaffoldStatus, statusLabel, supabase, today
} from './lib'
import ClientsWorks from './ClientsWorks'

type Tab = 'painel' | 'montagens' | 'inspecoes' | 'clientes-obras'
type Role = 'admin' | 'viewer' | null
type ScaffoldMaterial = {
  id: string
  scaffold_id: string
  material_name: string
  quantity: number
  unit: string
  material_type?: string
  length_per_item?: number | null
  width_per_item?: number | null
  created_at: string
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

  const emptyForm = {
  code: '',
  work_id: '',
  client: '',
  work_site: '',
  requester: '',
  description: '',
  mounted_at: today(),
  responsible: '',
  notes: '',
  status: 'montado' as ScaffoldStatus
}

export default function App() {
  const [session, setSession] = useState<any>(null)
  const [role, setRole] = useState<Role>(null)
  const isAdmin = role === 'admin'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [recoveringPassword, setRecoveringPassword] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')

  const [tab, setTab] = useState<Tab>('painel')
  const [scaffolds, setScaffolds] = useState<Scaffold[]>([])
  const [inspections, setInspections] = useState<Inspection[]>([])
  const [works, setWorks] = useState<Work[]>([])
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState('')
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('todos')
  const [workFilter, setWorkFilter] = useState('todas')
  const [pdfType, setPdfType] = useState<'montados' | 'desmontados' | 'todos'>('todos')

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Scaffold | null>(null)
  const [selected, setSelected] = useState<Scaffold | null>(null)
  useEffect(() => {
    if (!selected) {
      setMaterials([])
      setMaterialName('')
      setMaterialQuantity('')
      setMaterialUnit('un')
      return
    }

    void loadMaterials(selected.id)
  }, [selected?.id])
  const [materials, setMaterials] = useState<ScaffoldMaterial[]>([])
  const [materialName, setMaterialName] = useState('')
  const [materialQuantity, setMaterialQuantity] = useState('')
  const [materialUnit, setMaterialUnit] = useState('un')
  const [materialType, setMaterialType] = useState('diverso')
  const [materialLength, setMaterialLength] = useState('')
  const [materialWidth, setMaterialWidth] = useState('')
  const [loadingMaterials, setLoadingMaterials] = useState(false)
  const [savingMaterial, setSavingMaterial] = useState(false)
  const [form, setForm] = useState({ ...emptyForm })

  const [showInspection, setShowInspection] = useState(false)
  const [inspectionForm, setInspectionForm] = useState({
    scaffold_id: '',
    inspected_at: today(),
    inspector: '',
    condition: 'adequado' as Inspection['condition'],
    notes: ''
  })

  const [showRemoval, setShowRemoval] = useState<Scaffold | null>(null)
  const [removalForm, setRemovalForm] = useState({
    removed_at: today(),
    removal_responsible: '',
    removal_notes: ''
  })

  const notify = (msg: string) => {
    setNotice(msg)
    window.setTimeout(() => setNotice(''), 4500)
  }

  // Autenticação: mantém a sessão do usuário.
  useEffect(() => {
    if (!supabase) return

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
    })

    const { data: listener } = supabase.auth.onAuthStateChange(
      (event, next) => {
        setSession(next)

        if (event === 'PASSWORD_RECOVERY') {
          setRecoveringPassword(true)
          setLoginError('')
        }
      }
    )

    return () => listener.subscription.unsubscribe()
  }, [])

  // Consulta o perfil registrado no Supabase.
  useEffect(() => {
    let cancelled = false

    async function loadRole() {
      setRole(null)

      if (!supabase || !session?.user?.id) return

      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', session.user.id)
        .maybeSingle()

      if (cancelled) return

      if (error) {
        console.error('Erro ao consultar perfil:', error.message)
        setRole('viewer')
        return
      }

      setRole(data?.role === 'admin' ? 'admin' : 'viewer')
    }

    void loadRole()

    return () => {
      cancelled = true
    }
  }, [session])

  const loadData = useCallback(async () => {
    if (!supabase || !session) return

    setLoading(true)

    try {
      const [s, i, w] = await Promise.all([
        supabase
          .from('scaffolds')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase
          .from('scaffold_inspections')
          .select('*')
          .order('inspected_at', { ascending: false }),
        supabase
          .from('works')
          .select('*')
          .order('name', { ascending: true })
      ])

      if (s.error) {
        notify(`Erro ao carregar montagens: ${s.error.message}`)
      } else {
        setScaffolds((s.data || []) as Scaffold[])
      }

      if (i.error) {
        notify(`Erro ao carregar inspeções: ${i.error.message}`)
      } else {
        setInspections((i.data || []) as Inspection[])
      }

      if (w.error) {
        notify(`Erro ao carregar obras: ${w.error.message}`)
      } else {
        setWorks((w.data || []) as Work[])
      }
    } finally {
      setLoading(false)
    }
  }, [session])

  useEffect(() => {
    void loadData()
  }, [loadData])

  // Fecha formulários abertos quando a sessão ou o perfil não está autorizado.
  useEffect(() => {
    if (role !== 'admin') {
      setShowForm(false)
      setShowInspection(false)
      setShowRemoval(null)
      setEditing(null)
    }
  }, [role])

  const active = useMemo(
    () => scaffolds.filter(s => s.status !== 'retirado'),
    [scaffolds]
  )

  const old = useMemo(
    () => active.filter(s => daysMounted(s.mounted_at) >= 30),
    [active]
  )

  const pending = useMemo(
    () => inspections.filter(i => i.condition !== 'adequado').length,
    [inspections]
  )

  const filtered = useMemo(() => scaffolds.filter(s => {
    const haystack = [
      s.code,
      s.client,
      s.work_site,
      s.requester,
      s.description,
      s.responsible
    ].join(' ').toLowerCase()

    return haystack.includes(query.toLowerCase()) &&
      (statusFilter === 'todos' || s.status === statusFilter) &&
      (workFilter === 'todas' || s.work_id === workFilter)
  }), [scaffolds, query, statusFilter, workFilter])
  async function loadMaterials(scaffoldId: string) {
    if (!supabase) return

    setLoadingMaterials(true)

    try {
      const { data, error } = await supabase
        .from('scaffold_materials')
        .select('*')
        .eq('scaffold_id', scaffoldId)
        .order('created_at', { ascending: true })

      if (error) {
        notify(`Erro ao carregar materiais: ${error.message}`)
        setMaterials([])
        return
      }

      setMaterials((data || []) as ScaffoldMaterial[])
    } finally {
      setLoadingMaterials(false)
    }
  }



async function saveMaterial(e: FormEvent) {
  e.preventDefault()

  if (!supabase) {
    notify('Erro: conexão com o banco de dados não configurada.')
    return
  }

  if (!selected) {
    notify('Selecione uma montagem antes de adicionar material.')
    return
  }

  if (!isAdmin) {
    notify('Você não tem permissão para cadastrar materiais.')
    return
  }

  const name = materialName.trim()
  const quantity = Number(materialQuantity)
  const length = Number(materialLength)
  const width = Number(materialWidth)

  if (!name) {
    notify('Informe o nome do material.')
    return
  }

  if (!materialQuantity.trim() || !Number.isFinite(quantity) || quantity <= 0) {
    notify('Informe uma quantidade maior que zero.')
    return
  }

  if (
    (materialType === 'tubo_roll' || materialType === 'prancha') &&
    (!materialLength.trim() || !Number.isFinite(length) || length <= 0)
  ) {
    notify('Informe o comprimento por peça.')
    return
  }

  if (
    materialType === 'prancha' &&
    (!materialWidth.trim() || !Number.isFinite(width) || width <= 0)
  ) {
    notify('Informe a largura da prancha.')
    return
  }

  setSavingMaterial(true)

  try {
    const { error } = await supabase
      .from('scaffold_materials')
      .insert({
        scaffold_id: selected.id,
        material_name: name,
        quantity,
        unit: materialType === 'diverso' ? materialUnit : 'pç',
        material_type: materialType,
        length_per_item:
          materialType === 'tubo_roll' || materialType === 'prancha'
            ? length
            : null,
        width_per_item:
          materialType === 'prancha' ? width : null
      })

    if (error) {
      console.error('Erro Supabase ao salvar material:', error)
      notify(`Erro ao salvar material: ${error.message}`)
      return
    }

    await loadMaterials(selected.id)

    setMaterialName('')
    setMaterialQuantity('')
    setMaterialUnit('un')
    setMaterialType('diverso')
    setMaterialLength('')
    setMaterialWidth('')

    notify('Material cadastrado com sucesso.')
  } catch (error) {
    console.error('Falha inesperada ao salvar material:', error)
    notify(
      `Falha ao salvar material: ${
        error instanceof Error ? error.message : String(error)
      }`
    )
  } finally {
    setSavingMaterial(false)
  }
}


  
  const totalTubosMetros = materials.reduce((total, material) => {
    if (material.material_type !== 'tubo_roll') return total

    return total + material.quantity * Number(material.length_per_item || 0)
  }, 0)

  const totalPranchasMetros = materials.reduce((total, material) => {
    if (material.material_type !== 'prancha') return total

    return total + material.quantity * Number(material.length_per_item || 0)
  }, 0)

  const totalPranchasArea = materials.reduce((total, material) => {
    if (material.material_type !== 'prancha') return total

    return total
      + material.quantity
      * Number(material.length_per_item || 0)
      * Number(material.width_per_item || 0)
  }, 0)

  function formatMeasure(value: number) {
    return value.toLocaleString('pt-BR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 3
    })
  }
async function deleteMaterial(material: ScaffoldMaterial) {
    if (!supabase || !isAdmin) return

    const confirmed = window.confirm(
      `Deseja excluir o material "${material.material_name}"?`
    )

    if (!confirmed) return

    const { error } = await supabase
      .from('scaffold_materials')
      .delete()
      .eq('id', material.id)

    if (error) {
      notify(`Erro ao excluir material: ${error.message}`)
      return
    }

    if (selected) {
      await loadMaterials(selected.id)
    }

    notify('Material excluído com sucesso.')
  }
  async function login(e: FormEvent) {
    e.preventDefault()
    if (!supabase) return

    setLoginError('')

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (error) {
      setLoginError(
        'Não foi possível entrar. Confira o e-mail, a senha e se o usuário foi criado no Supabase.'
      )
    }
  }

  async function recoverPassword(e: FormEvent) {
    e.preventDefault()
    if (!supabase) return

    setLoginError('')

    if (!email.trim()) {
      setLoginError('Digite seu e-mail para receber o link de recuperação.')
      return
    }

    const { error } = await supabase.auth.resetPasswordForEmail(
      email.trim(),
      { redirectTo: window.location.origin }
    )

    if (error) {
      setLoginError('Não foi possível enviar o link: ' + error.message)
    } else {
      setLoginError(
        'Se o e-mail estiver cadastrado, você receberá as instruções de recuperação.'
      )
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
      setLoginError('As senhas não conferem.')
      return
    }

    setLoginError('')

    const { error } = await supabase.auth.updateUser({
      password: newPassword
    })

    if (error) {
      setLoginError('Não foi possível alterar a senha: ' + error.message)
      return
    }

    await supabase.auth.signOut()
    setSession(null)
    setRole(null)
    setRecoveringPassword(false)
    setNewPassword('')
    setConfirmNewPassword('')
    setLoginError('Senha alterada com sucesso. Entre com sua nova senha.')
  }

  async function logout() {
    await supabase?.auth.signOut()
    setSession(null)
    setRole(null)
    setScaffolds([])
    setInspections([])
    setTab('painel')
  }

  
  function openNew() {
    if (!isAdmin) {
      notify('Seu perfil permite apenas consulta.')
      return
    }

    setEditing(null)
    setForm({ ...emptyForm })
    setShowForm(true)
  }   
  function openEdit(item: Scaffold) {
    if (!isAdmin) {
      notify('Seu perfil permite apenas consulta.')
      return
    }

    setEditing(item)
    setForm({
      code: item.code,
      work_id: item.work_id || '',
      client: item.client,
      work_site: item.work_site,
      requester: item.requester,
      description: item.description,
      mounted_at: item.mounted_at,
      responsible: item.responsible,
      notes: item.notes || '',
      status: item.status
    })

    setShowForm(true)
  }

  async function saveScaffold(e: FormEvent) {
    e.preventDefault()

    if (!isAdmin) {
      notify('Seu perfil permite apenas consulta.')
      return
    }

    if (!supabase) return

    const payload = {
      ...form,
      work_id: form.work_id || null,
      notes: form.notes || null
    }

    const result = editing
      ? await supabase
          .from('scaffolds')
          .update(payload)
          .eq('id', editing.id)
          .select()
          .single()
      : await supabase
          .from('scaffolds')
          .insert(payload)
          .select()
          .single()

    if (result.error) {
      notify(`Não foi possível salvar: ${result.error.message}`)
      return
    }

    setShowForm(false)
    notify(editing ? 'Montagem atualizada.' : 'Montagem cadastrada.')
    await loadData()
  }

  async function saveInspection(e: FormEvent) {
    e.preventDefault()

    if (!isAdmin) {
      notify('Seu perfil permite apenas consulta.')
      return
    }

    if (!supabase) return

    const { error } = await supabase
      .from('scaffold_inspections')
      .insert(inspectionForm)

    if (error) {
      notify(`Não foi possível salvar inspeção: ${error.message}`)
      return
    }

    setShowInspection(false)
    setInspectionForm({
      scaffold_id: '',
      inspected_at: today(),
      inspector: '',
      condition: 'adequado',
      notes: ''
    })

    notify('Inspeção registrada.')
    await loadData()
  }

  async function removeScaffold(e: FormEvent) {
    e.preventDefault()

    if (!isAdmin) {
      notify('Seu perfil permite apenas consulta.')
      return
    }

    if (!supabase || !showRemoval) return

    const { error } = await supabase
      .from('scaffolds')
      .update({
        status: 'retirado',
        removed_at: removalForm.removed_at,
        removal_responsible: removalForm.removal_responsible,
        removal_notes: removalForm.removal_notes || null
      })
      .eq('id', showRemoval.id)

    if (error) {
      notify(`Não foi possível registrar retirada: ${error.message}`)
      return
    }

    setShowRemoval(null)
    notify('Retirada registrada e histórico preservado.')
    await loadData()
  }

  async function deleteScaffold(item: Scaffold) {
    if (!isAdmin) {
      notify('Seu perfil permite apenas consulta.')
      return
    }

    if (
      !supabase ||
      !window.confirm(
        `Excluir permanentemente ${item.code}? Esta ação não pode ser desfeita.`
      )
    ) return

    const { error } = await supabase
      .from('scaffolds')
      .delete()
      .eq('id', item.id)

    if (error) {
      notify(`Não foi possível excluir: ${error.message}`)
    } else {
      notify('Registro excluído.')
      await loadData()
    }
  }
async function exportPdf() {
  const selected = scaffolds.filter((item) => {
    if (pdfType === 'montados') return item.status !== 'retirado'
    if (pdfType === 'desmontados') return item.status === 'retirado'
    return true
  })

  if (selected.length === 0) {
    alert('Não há andaimes para incluir neste relatório.')
    return
  }

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 14
  let y = 16

  const addPageIfNeeded = (needed = 12) => {
    if (y + needed > pageHeight - 18) {
      pdf.addPage()
      y = 18
    }
  }

  const write = (label: string, value: unknown) => {
    const text = `${label}: ${value || 'Não informado'}`
    const lines = pdf.splitTextToSize(text, pageWidth - margin * 2)
    addPageIfNeeded(lines.length * 5 + 3)
    pdf.text(lines, margin, y)
    y += lines.length * 5 + 2
  }

  try {
    const response = await fetch('/logo-vm.png')
    if (response.ok) {
      const blob = await response.blob()
      const logo = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result))
        reader.onerror = reject
        reader.readAsDataURL(blob)
      })
      pdf.addImage(logo, 'PNG', margin, y, 25, 18)
      y += 23
    }
  } catch {
    // O relatório continua sendo gerado mesmo se a logo não carregar.
  }

  pdf.setFontSize(18)
  pdf.setFont('helvetica', 'bold')
  pdf.text('VM ANDAIMES', margin, y)
  y += 8

  pdf.setFontSize(13)
  pdf.text(
    pdfType === 'montados'
      ? 'Relatório de Andaimes Montados'
      : pdfType === 'desmontados'
        ? 'Relatório de Andaimes Desmontados'
        : 'Relatório Geral de Andaimes',
    margin,
    y,
  )
  y += 7

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)
  pdf.text(`Emitido em: ${new Date().toLocaleString('pt-BR')}`, margin, y)
  y += 8

  const groups =
    pdfType === 'todos'
      ? [
          { title: 'ANDAIMES MONTADOS / AGUARDANDO RETIRADA', items: selected.filter((item) => item.status !== 'retirado') },
          { title: 'ANDAIMES DESMONTADOS / RETIRADOS', items: selected.filter((item) => item.status === 'retirado') },
        ]
      : [
          {
            title: pdfType === 'montados' ? 'ANDAIMES MONTADOS / AGUARDANDO RETIRADA' : 'ANDAIMES DESMONTADOS / RETIRADOS',
            items: selected,
          },
        ]

  for (const group of groups) {
    if (group.items.length === 0) continue

    addPageIfNeeded(14)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(11)
    pdf.text(group.title, margin, y)
    y += 8

    for (const item of group.items) {
      addPageIfNeeded(25)
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(10)
      pdf.text(`Andaime ${item.code}`, margin, y)
      y += 6

      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(9)
      write('Cliente', item.client)
      write('Obra', item.work_site)
      write('Solicitante', item.requester)
      write('Descrição', item.description)
      write('Data da montagem', item.mounted_at)
      write('Dias montado', daysMounted(item.mounted_at, item.removed_at))
      write('Responsável pela montagem', item.responsible)
      write('Status', statusLabel[item.status])
      write('Observações', item.notes)
      write('Data da retirada', item.removed_at)
      write('Responsável pela retirada', item.removal_responsible)
      write('Observações da retirada', item.removal_notes)

      const itemInspections = inspections.filter((inspection) => inspection.scaffold_id === item.id)

      addPageIfNeeded(8)
      pdf.setFont('helvetica', 'bold')
      pdf.text('Inspeções', margin, y)
      y += 5
      pdf.setFont('helvetica', 'normal')

      if (itemInspections.length === 0) {
        write('Histórico', 'Nenhuma inspeção registrada')
      } else {
        for (const inspection of itemInspections) {
          write('Data da inspeção', inspection.inspected_at)
          write('Inspetor', inspection.inspector)
          write('Condição', conditionLabel[inspection.condition])
          write('Observações da inspeção', inspection.notes)
        }
      }

      y += 4
      addPageIfNeeded(5)
      pdf.setDrawColor(210, 210, 210)
      pdf.line(margin, y, pageWidth - margin, y)
      y += 6
    }
  }

  const totalPages = pdf.getNumberOfPages()
  for (let page = 1; page <= totalPages; page++) {
    pdf.setPage(page)
    pdf.setFontSize(8)
    pdf.setFont('helvetica', 'normal')
    pdf.text(`Página ${page} de ${totalPages}`, pageWidth - margin, pageHeight - 8, { align: 'right' })
  }

  pdf.save(`VM-Andaimes-Relatorio-${pdfType}-${today()}.pdf`)
}
  function exportCsv() {
    const headers = [
      'Código', 'Cliente', 'Obra', 'Solicitante', 'Descrição',
      'Data montagem', 'Dias montado', 'Responsável', 'Status',
      'Observações', 'Data retirada', 'Responsável retirada'
    ]

    const rows = filtered.map(s => [
      s.code,
      s.client,
      s.work_site,
      s.requester,
      s.description,
      s.mounted_at,
      daysMounted(s.mounted_at, s.removed_at),
      s.responsible,
      statusLabel[s.status],
      s.notes || '',
      s.removed_at || '',
      s.removal_responsible || ''
    ])

    const csv = [headers, ...rows]
      .map(row =>
        row.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(';')
      )
      .join('\r\n')

    const blob = new Blob(['\ufeff' + csv], {
      type: 'text/csv;charset=utf-8;'
    })

    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'controle-andaimes-vm.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!isSupabaseConfigured) return <SetupScreen />

  if (recoveringPassword) {
    return (
      <div className="login-page">
        <div className="login-card">
          <div className="brand-mark brand-logo">
            <img src="/logo-vm.png" alt="Logo VM Andaimes" />
          </div>
          <p className="eyebrow">VM ANDAIMES</p>
          <h1>Nova <span>senha</span></h1>
          <p className="muted">Cadastre sua nova senha para acessar o sistema.</p>
          <form onSubmit={saveNewPassword} className="stack">
            <label>Nova senha
              <input
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Mínimo de 8 caracteres"
              />
            </label>
            <label>Confirmar nova senha
              <input
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={confirmNewPassword}
                onChange={e => setConfirmNewPassword(e.target.value)}
                placeholder="Digite a senha novamente"
              />
            </label>
            {loginError && <p className="error">{loginError}</p>}
            <button className="btn primary full" type="submit">
              Salvar nova senha
            </button>
          </form>
        </div>
      </div>
    )
  }
  if (!session) {
    return (
      <main className="login-page login-page-modern">
        <div className="login-decoration login-decoration-one" aria-hidden="true" />
        <div className="login-decoration login-decoration-two" aria-hidden="true" />

        <section className="login-card login-card-modern">
          <div className="login-brand">
  <div className="brand-mark brand-logo login-logo">
    <img src="/vm-logo.png" alt="Logo VM Andaimes" />
  </div>
  <p className="eyebrow">VM ANDAIMES · DESDE 2008</p>
</div>
          <header className="login-heading">
            <h1>Controle de <span>Andaimes</span></h1>
            <p className="muted">
              Acesse o sistema para acompanhar montagens, inspeções e retiradas.
            </p>
          </header>

          <form onSubmit={login} className="stack login-form">
            <label>
              E-mail
              <input
                type="email"
                required
                autoComplete="username"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="seu@email.com"
              />
            </label>

            <label>
              Senha
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Digite sua senha"
              />
            </label>

            <button
              className="login-forgot"
              type="button"
              onClick={(e) => void recoverPassword(e as unknown as FormEvent)}
            >
              Esqueci minha senha
            </button>

            {loginError && (
              <p className="error login-error" role="alert">
                {loginError}
              </p>
            )}

            <button className="btn primary full login-submit" type="submit">
              Entrar no sistema
            </button>
          </form>

          <footer className="login-foot login-foot-modern">
            <ShieldCheck size={16} />
            <span>Acesso restrito a usuários autorizados</span>
          </footer>
        </section>
      </main>
    )
  }
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark brand-logo">
            <img src="/logo-vm.png" alt="Logo VM Andaimes" />
          </div>
          <div>
            <strong>VM <span>ANDAIMES</span></strong>
            <small>CONTROLE OPERACIONAL</small>
          </div>
        </div>

        <div className="side-label">MENU PRINCIPAL</div>

        <button
          className={`nav-item ${tab === 'painel' ? 'active' : ''}`}
          onClick={() => setTab('painel')}
        >
          <Activity size={18}/> Painel geral
        </button>

        <button
          className={`nav-item ${tab === 'montagens' ? 'active' : ''}`}
          onClick={() => setTab('montagens')}
        >
          <Construction size={18}/> Montagens
        </button>

        <button
          className={`nav-item ${tab === 'inspecoes' ? 'active' : ''}`}
          onClick={() => setTab('inspecoes')}
        >
          <ClipboardList size={18}/> Inspeções
        </button>

        <button
          className={`nav-item ${tab === 'clientes-obras' ? 'active' : ''}`}
          onClick={() => setTab('clientes-obras')}
        >
          <Construction size={18}/> Clientes e Obras
        </button>

        <div className="sidebar-bottom">
          <div className="safe-box">
            <ShieldCheck size={20}/>
            <div>
              <strong>
                {isAdmin ? 'Acesso administrador' : 'Somente visualização'}
              </strong>
              <small>
                {isAdmin
                  ? 'Você pode gerenciar os registros.'
                  : 'Você pode consultar os registros.'}
              </small>
            </div>
          </div>
          <button className="nav-item" onClick={logout}>
            <LogOut size={18}/> Sair do sistema
          </button>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div>
            <p className="eyebrow">GESTÃO DE CAMPO</p>
            <h1>
              {tab === 'painel'
                ? 'Painel geral'
                : tab === 'montagens'
                  ? 'Controle de montagens'
                  : tab === 'inspecoes'
                    ? 'Inspeções registradas'
                    : 'Clientes e Obras'}
            </h1>
          </div>
          <div className="top-actions">
            <span className="online-dot">Sistema online</span>
            <button
              className="icon-btn"
              onClick={() => void loadData()}
              title="Atualizar"
            >
              <RefreshCw size={18}/>
            </button>
            {isAdmin && (
              <button className="btn primary" onClick={openNew}>
                <Plus size={18}/> Nova montagem
              </button>
            )}
          </div>
        </header>

        {notice && (
          <div className="toast">
            <Check size={17}/>{notice}
            <button onClick={() => setNotice('')}>
              <X size={16}/>
            </button>
          </div>
        )}

        {tab === 'painel' && (
          <>
            <section className="welcome">
              <div>
                <p className="eyebrow">VISÃO GERAL</p>
                <h2>Olá! Vamos manter tudo sob controle.</h2>
                <p>
                  Acompanhe o tempo de montagem e as atividades da equipe em um só lugar.
                </p>
              </div>
              <div className="welcome-icon brand-logo">
                <img src="/logo-vm.png" alt="Logo VM Andaimes" />
              </div>
            </section>

            <section className="stats-grid">
              <Stat
                icon={<Construction/>}
                label="Andaimes ativos"
                value={active.length}
                detail="Montados ou aguardando retirada"
              />
              <Stat
                icon={<Clock3/>}
                label="Há 30 dias ou mais"
                value={old.length}
                detail="Requerem acompanhamento"
                accent
              />
              <Stat
                icon={<AlertTriangle/>}
                label="Inspeções com pendência"
                value={pending}
                detail="Registros que precisam de atenção"
                warning={pending > 0}
              />
              <Stat
                icon={<ArrowDownToLine/>}
                label="Retirados"
                value={scaffolds.filter(s => s.status === 'retirado').length}
                detail="Histórico de desmontagens"
              />
            </section>

            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h2>Montagens recentes</h2>
                  <p>Confira os últimos registros operacionais.</p>
                </div>
                <button className="btn secondary" onClick={() => setTab('montagens')}>
                  Ver todas
                </button>
              </div>
              <ScaffoldTable
                items={scaffolds.slice(0, 5)}
                onSelect={setSelected}
                onEdit={openEdit}
                onRemove={setShowRemoval}
                readOnly={!isAdmin}
              />
            </section>

            <section className="safety-note">
              <ShieldCheck size={22}/>
              <div>
                <strong>Atenção à segurança</strong>
                <p>
                  O tempo de montagem é apenas um indicador administrativo.
                  Ele não substitui inspeções, avaliações técnicas ou a autorização
                  para uso do andaime.
                </p>
              </div>
            </section>
          </>
        )}

        {tab === 'montagens' && (
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>Todos os andaimes</h2>
                <p>Pesquise, atualize e acompanhe cada montagem.</p>
              </div>
              
<div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
  <select
    aria-label="Tipo de relatório PDF"
    value={pdfType}
    onChange={e => setPdfType(e.target.value as 'montados' | 'desmontados' | 'todos')}
  >
    <option value="todos">PDF: todos os andaimes</option>
    <option value="montados">PDF: montados</option>
    <option value="desmontados">PDF: desmontados</option>
  </select>

  <button className="btn primary" onClick={() => void exportPdf()}>
    <FileText size={17}/> Baixar PDF
  </button>

  <button className="btn secondary" onClick={exportCsv}>
    <ArrowDownToLine size={17}/> Exportar CSV
  </button>
</div>
            </div>

            <div className="filters">
              <div className="searchbox">
                <Search size={17}/>
                <input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Buscar código, obra, cliente ou solicitante..."
                />
              </div>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
              >
                <option value="todos">Todos os status</option>
                <option value="montado">Montado</option>
                <option value="aguardando_retirada">Aguardando retirada</option>
                <option value="retirado">Retirado</option>
              </select>
              <select
                aria-label="Filtrar montagens por obra"
                value={workFilter}
                onChange={e => setWorkFilter(e.target.value)}
              >
                <option value="todas">Todas as obras</option>
                {works.map(work => (
                  <option key={work.id} value={work.id}>{work.name}</option>
                ))}
              </select>
            </div>

            <ScaffoldTable
              items={filtered}
              onSelect={setSelected}
              onEdit={openEdit}
              onRemove={setShowRemoval}
              onDelete={deleteScaffold}
              readOnly={!isAdmin}
            />
          </section>
        )}

        {tab === 'inspecoes' && (
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>Histórico de inspeções</h2>
                <p>Consulte as condições observadas e as pendências.</p>
              </div>
              {isAdmin && (
                <button
                  className="btn primary"
                  onClick={() => setShowInspection(true)}
                >
                  <Plus size={17}/> Registrar inspeção
                </button>
              )}
            </div>

            <div className="inspection-list">
              {inspections.map(i => {
                const s = scaffolds.find(x => x.id === i.scaffold_id)
                return (
                  <div className="inspection-row" key={i.id}>
                    <div className={`condition-icon ${i.condition}`}>
                      <ClipboardList size={20}/>
                    </div>
                    <div className="inspection-main">
                      <div className="inspection-title">
                        {s?.code || 'Andaime'} · {s?.work_site || 'Obra não informada'}
                        <span className={`pill ${i.condition}`}>
                          {conditionLabel[i.condition]}
                        </span>
                      </div>
                      <p>{i.notes || 'Sem observações registradas.'}</p>
                      <small>
                        {i.inspector} · {new Date(`${i.inspected_at}T00:00:00`).toLocaleDateString('pt-BR')}
                      </small>
                    </div>
                  </div>
                )
              })}
              {!inspections.length && (
                <Empty text="Nenhuma inspeção registrada ainda."/>
              )}
            </div>
          </section>
        )}

        {tab === 'clientes-obras' && <ClientsWorks readOnly={!isAdmin} />}

        {loading && <div className="loading-line">Atualizando dados…</div>}
      </main>

      {isAdmin && showForm && (
        <Modal
          title={editing ? 'Editar montagem' : 'Cadastrar nova montagem'}
          onClose={() => setShowForm(false)}
        >
          <form className="form-grid" onSubmit={saveScaffold}>
  <label>Identificação / TAG
    <input
      required
      value={form.code}
      onChange={e => setForm({ ...form, code: e.target.value })}
      placeholder="Ex.: TAG-001"
      maxLength={50}
    />
  </label>

    <label>Cliente <input
      required
      value={form.client}
      onChange={e => setForm({ ...form, client: e.target.value })}
      placeholder="Nome do cliente"
    />
 </label>         
             <label>Obra cadastrada
             <select
             required
             value={form.work_id}
             onChange={e => {
              const work = works.find(item => item.id === e.target.value)
            setForm({
              ...form,
             work_id: e.target.value,
             work_site: work ? work.name : ''
      })
    }}
  >
    <option value="">Selecione uma obra</option>
    {works.map(work => (
      <option key={work.id} value={work.id}>
        {work.name}
      </option>
    ))}
  </select>
  {!works.length && (
    <small>Cadastre uma obra na aba Clientes e obras antes de criar a montagem.</small>
  )}
</label>

<label>Local da montagem
  <input
    required
    value={form.work_site}
    onChange={e => setForm({ ...form, work_site: e.target.value })}
    placeholder="Local exato dentro da obra"
  />
</label>
            <label>Solicitante
              <input
                required
                value={form.requester}
                onChange={e => setForm({ ...form, requester: e.target.value })}
                placeholder="Quem solicitou"
              />
            </label>
            <label>Responsável pela montagem
              <input
                required
                value={form.responsible}
                onChange={e => setForm({ ...form, responsible: e.target.value })}
                placeholder="Nome do responsável"
              />
            </label>
            <label>Data da montagem
              <input
                type="date"
                required
                value={form.mounted_at}
                onChange={e => setForm({ ...form, mounted_at: e.target.value })}
              />
            </label>
            <label>Status
              <select
                value={form.status}
                onChange={e => setForm({ ...form, status: e.target.value as ScaffoldStatus })}
              >
                <option value="montado">Montado</option>
                <option value="aguardando_retirada">Aguardando retirada</option>
              </select>
            </label>
            <label className="wide">Descrição do andaime
              <input
                required
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                placeholder="Finalidade, local exato e características"
              />
            </label>
            <label className="wide">Observações
              <textarea
                rows={3}
                value={form.notes}
                onChange={e => setForm({ ...form, notes: e.target.value })}
                placeholder="Informações adicionais, restrições ou pendências"
              />
            </label>
            <div className="modal-actions wide">
              <button type="button" className="btn secondary" onClick={() => setShowForm(false)}>
                Cancelar
              </button>
              <button className="btn primary" type="submit">
                <Check size={17}/> Salvar montagem
              </button>
            </div>
          </form>
        </Modal>
      )}

      {isAdmin && showInspection && (
        <Modal title="Registrar inspeção" onClose={() => setShowInspection(false)}>
          <form className="form-grid" onSubmit={saveInspection}>
            <label className="wide">Andaime
              <select
                required
                value={inspectionForm.scaffold_id}
                onChange={e => setInspectionForm({ ...inspectionForm, scaffold_id: e.target.value })}
              >
                <option value="">Selecione uma montagem</option>
                {active.map(s => (
                  <option key={s.id} value={s.id}>{s.code} — {s.work_site}</option>
                ))}
              </select>
            </label>
            <label>Data da inspeção
              <input
                type="date"
                required
                value={inspectionForm.inspected_at}
                onChange={e => setInspectionForm({ ...inspectionForm, inspected_at: e.target.value })}
              />
            </label>
            <label>Responsável
              <input
                required
                value={inspectionForm.inspector}
                onChange={e => setInspectionForm({ ...inspectionForm, inspector: e.target.value })}
                placeholder="Nome do inspetor"
              />
            </label>
            <label className="wide">Condição observada
              <select
                value={inspectionForm.condition}
                onChange={e => setInspectionForm({ ...inspectionForm, condition: e.target.value as Inspection['condition'] })}
              >
                <option value="adequado">Adequado</option>
                <option value="pendencia">Com pendência</option>
                <option value="interditado">Interditado</option>
              </select>
            </label>
            <label className="wide">Observações da inspeção
              <textarea
                required
                rows={3}
                value={inspectionForm.notes}
                onChange={e => setInspectionForm({ ...inspectionForm, notes: e.target.value })}
                placeholder="Descreva o que foi verificado"
              />
            </label>
            <div className="modal-actions wide">
              <button type="button" className="btn secondary" onClick={() => setShowInspection(false)}>
                Cancelar
              </button>
              <button className="btn primary" type="submit">Salvar inspeção</button>
            </div>
          </form>
        </Modal>
      )}

      {isAdmin && showRemoval && (
        <Modal
          title={`Registrar retirada — ${showRemoval.code}`}
          onClose={() => setShowRemoval(null)}
        >
          <form className="form-grid" onSubmit={removeScaffold}>
            <label>Data da retirada
              <input
                type="date"
                required
                value={removalForm.removed_at}
                onChange={e => setRemovalForm({ ...removalForm, removed_at: e.target.value })}
              />
            </label>
            <label>Responsável pela retirada
              <input
                required
                value={removalForm.removal_responsible}
                onChange={e => setRemovalForm({ ...removalForm, removal_responsible: e.target.value })}
                placeholder="Nome do responsável"
              />
            </label>
            <label className="wide">Observações
              <textarea
                rows={3}
                value={removalForm.removal_notes}
                onChange={e => setRemovalForm({ ...removalForm, removal_notes: e.target.value })}
                placeholder="Condições ou observações da retirada"
              />
            </label>
            <div className="modal-actions wide">
              <button type="button" className="btn secondary" onClick={() => setShowRemoval(null)}>
                Cancelar
              </button>
              <button className="btn primary" type="submit">Confirmar retirada</button>
            </div>
          </form>
        </Modal>
      )}

      {selected && (
        <Modal title={`Detalhes — ${selected.code}`} onClose={() => setSelected(null)}>
          <div className="detail-grid">
            {[
              ['Cliente', selected.client],
              ['Obra', selected.work_site],
              ['Solicitante', selected.requester],
              ['Responsável', selected.responsible],
              ['Descrição', selected.description],
              ['Data da montagem', new Date(`${selected.mounted_at}T00:00:00`).toLocaleDateString('pt-BR')],
              ['Tempo montado', `${daysMounted(selected.mounted_at, selected.removed_at)} dias`],
              ['Status', statusLabel[selected.status]],
              ['Observações', selected.notes || '—'],
              ['Data da retirada', selected.removed_at ? new Date(`${selected.removed_at}T00:00:00`).toLocaleDateString('pt-BR') : '—'],
              ['Responsável pela retirada', selected.removal_responsible || '—'],
              ['Observações da retirada', selected.removal_notes || '—']
            ].map(([k, v]) => (
              <div className="detail-item" key={k}>
                <small>{k}</small>
                <p>{v}</p>
              </div>
            ))}
          </div>
          
          <section className="materials-section">
            <h3>Materiais desta montagem</h3>

            {loadingMaterials ? (
              <p>Carregando materiais...</p>
            ) : materials.length === 0 ? (
              <p>Nenhum material cadastrado nesta montagem.</p>
            ) : (
              <div className="materials-list">
               
{materials.map(material => {
  const quantity = Number(material.quantity || 0)
  const length = Number(material.length_per_item || 0)
  const width = Number(material.width_per_item || 0)

  const isTube = material.material_type === 'tubo_roll'
  const isPlank = material.material_type === 'prancha'

  const linearMeters =
    (isTube || isPlank) ? quantity * length : 0

  const area =
    isPlank ? quantity * length * width : 0

  return (
    <div className="material-row" key={material.id}>
      <div>
        <strong>{material.material_name}</strong>

        {isTube && (
          <p>
            Tubo Roll: {formatMeasure(quantity)} peças ×{' '}
            {formatMeasure(length)} m ={' '}
            <strong>{formatMeasure(linearMeters)} m lineares</strong>
          </p>
        )}

        {isPlank && (
          <>
            <p>
              Pranchas: {formatMeasure(quantity)} peças ×{' '}
              {formatMeasure(length)} m ={' '}
              <strong>{formatMeasure(linearMeters)} m lineares</strong>
            </p>
            <p>
              Largura: {formatMeasure(width)} m · Área total:{' '}
              <strong>{formatMeasure(area)} m²</strong>
            </p>
          </>
        )}

        {material.material_type !== 'tubo_roll' &&
          material.material_type !== 'prancha' && (
            <p>
              {formatMeasure(quantity)} {material.unit}
            </p>
          )}
      </div>

      {isAdmin && (
        <button
          type="button"
          className="btn secondary"
          onClick={() => void deleteMaterial(material)}
        >
          <Trash2 size={16} />
          Excluir
        </button>
      )}
    </div>
  )
})}
              </div>
            )}

            {isAdmin && (
             
<form className="form-grid" onSubmit={saveMaterial}>
  <label className="wide">
    Tipo de material
    <select
      value={materialType}
      onChange={e => setMaterialType(e.target.value)}
    >
      <option value="tubo_roll">Tubo Roll</option>
      <option value="prancha">Prancha</option>
      <option value="diverso">Material diverso</option>
    </select>
  </label>

  <label>
    Nome do material
    <input
      required
      value={materialName}
      onChange={e => setMaterialName(e.target.value)}
      placeholder={
        materialType === 'tubo_roll'
          ? 'Ex.: Tubo Roll galvanizado'
          : materialType === 'prancha'
            ? 'Ex.: Prancha metálica'
            : 'Ex.: Abraçadeira'
      }
    />
  </label>

  <label>
    Quantidade de peças / itens
    <input
      required
      type="number"
      min="0.01"
      step="0.01"
      value={materialQuantity}
      onChange={e => setMaterialQuantity(e.target.value)}
      placeholder="Ex.: 20"
    />
  </label>

  {(materialType === 'tubo_roll' ||
    materialType === 'prancha') && (
    <label>
      Comprimento por peça (m)
      <input
        required
        type="number"
        min="0.001"
        step="0.001"
        value={materialLength}
        onChange={e => setMaterialLength(e.target.value)}
        placeholder="Ex.: 3"
      />
    </label>
  )}

  {materialType === 'prancha' && (
    <label>
      Largura por prancha (m)
      <input
        required
        type="number"
        min="0.001"
        step="0.001"
        value={materialWidth}
        onChange={e => setMaterialWidth(e.target.value)}
        placeholder="Ex.: 0,20"
      />
    </label>
  )}

  {materialType === 'diverso' && (
    <label>
      Unidade
      <select
        value={materialUnit}
        onChange={e => setMaterialUnit(e.target.value)}
      >
        <option value="un">Unidade (un)</option>
        <option value="m">Metro (m)</option>
        <option value="m²">Metro quadrado (m²)</option>
        <option value="kg">Quilo (kg)</option>
        <option value="pç">Peça (pç)</option>
        <option value="jogo">Jogo</option>
        <option value="outro">Outro</option>
      </select>
    </label>
  )}

  {(materialType === 'tubo_roll' ||
    materialType === 'prancha') &&
    materialQuantity &&
    materialLength && (
      <div className="wide">
        <p>
          Total estimado de comprimento:{' '}
          <strong>
            {formatMeasure(
              Number(materialQuantity) * Number(materialLength)
            )} m
          </strong>
        </p>

        {materialType === 'prancha' &&
          materialWidth && (
            <p>
              Área total estimada:{' '}
              <strong>
                {formatMeasure(
                  Number(materialQuantity) *
                  Number(materialLength) *
                  Number(materialWidth)
                )} m²
              </strong>
            </p>
          )}
      </div>
    )}

  <div className="modal-actions wide">
    <button
      className="btn primary"
      type="submit"
      disabled={savingMaterial}
    >
      {savingMaterial ? 'Salvando...' : 'Adicionar material'}
    </button>
  </div>
</form>
            )}
          </section>
<div className="modal-actions">
            <button className="btn secondary" onClick={() => setSelected(null)}>
              Fechar
            </button>
            {isAdmin && (
              <button
                className="btn primary"
                onClick={() => {
                  setSelected(null)
                  openEdit(selected)
                }}
              >
                Editar registro
              </button>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}

function Stat({
  icon, label, value, detail, accent, warning
}: {
  icon: React.ReactNode
  label: string
  value: number
  detail: string
  accent?: boolean
  warning?: boolean
}) {
  return (
    <div className={`stat-card ${accent ? 'accent' : ''} ${warning ? 'warning' : ''}`}>
      <div className="stat-top">
        <span>{label}</span>
        <span className="stat-icon">{icon}</span>
      </div>
      <strong>{value}</strong>
      <p>{detail}</p>
    </div>
  )
}

function ScaffoldTable({
  items, onSelect, onEdit, onRemove, onDelete, readOnly = false
}: {
  items: Scaffold[]
  onSelect: (s: Scaffold) => void
  onEdit: (s: Scaffold) => void
  onRemove: (s: Scaffold) => void
  onDelete?: (s: Scaffold) => void
  readOnly?: boolean
}) {
  if (!items.length) {
    return <Empty text="Nenhum andaime encontrado."/>
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Identificação</th>
            <th>Obra / cliente</th>
            <th>Solicitante</th>
            <th>Montado há</th>
            <th>Status</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          {items.map(s => (
            <tr key={s.id}>
              <td>
                <button className="code-link" onClick={() => onSelect(s)}>
                  {s.code}
                </button>
                <small>{s.description}</small>
              </td>
              <td>
                <strong>{s.work_site}</strong>
                <small>{s.client}</small>
              </td>
              <td>{s.requester}</td>
              <td>
                <strong>{daysMounted(s.mounted_at, s.removed_at)} dias</strong>
                <small>{new Date(`${s.mounted_at}T00:00:00`).toLocaleDateString('pt-BR')}</small>
              </td>
              <td>
                <span className={`pill ${s.status}`}>{statusLabel[s.status]}</span>
              </td>
              <td>
                <div className="actions">
                  <button
                    className="mini-btn"
                    title="Detalhes"
                    onClick={() => onSelect(s)}
                  >
                    <ClipboardList size={16}/>
                  </button>
                  {!readOnly && (
                    <>
                      <button
                        className="mini-btn"
                        title="Editar"
                        onClick={() => onEdit(s)}
                      >
                        <FilePlus2 size={16}/>
                      </button>
                      {s.status !== 'retirado' && (
                        <button
                          className="mini-btn"
                          title="Registrar retirada"
                          onClick={() => onRemove(s)}
                        >
                          <ArrowDownToLine size={16}/>
                        </button>
                      )}
                      {onDelete && (
                        <button
                          className="mini-btn danger"
                          title="Excluir definitivamente"
                          onClick={() => onDelete(s)}
                        >
                          <Trash2 size={16}/>
                        </button>
                      )}
                    </>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return (
    <div className="empty">
      <Database size={28}/>
      <p>{text}</p>
    </div>
  )
}

function Modal({
  title, onClose, children
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div
      className="modal-backdrop"
      onMouseDown={e => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="modal">
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose}>
            <X size={19}/>
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function SetupScreen() {
  return (
    <div className="login-page">
      <div className="login-card setup-card">
        <div className="brand-mark brand-logo">
          <img src="/logo-vm.png" alt="Logo VM Andaimes" />
        </div>
        <p className="eyebrow">VM ANDAIMES</p>
        <h1>Quase pronto!</h1>
        <p className="muted">
          O site está instalado, mas falta conectar o banco de dados Supabase.
        </p>
        <ol>
          <li>Crie um projeto Supabase.</li>
          <li>Execute o arquivo <code>supabase/schema.sql</code> no SQL Editor.</li>
          <li>Copie <code>.env.example</code> para <code>.env</code>.</li>
          <li>Preencha a URL do projeto e a chave pública anon.</li>
          <li>Reinicie o servidor com <code>npm run dev</code>.</li>
        </ol>
        <p className="warning-text">
          <ShieldCheck size={16}/> Nunca coloque a chave <code>service_role</code> neste site.
        </p>
      </div>
    </div>
  )
}

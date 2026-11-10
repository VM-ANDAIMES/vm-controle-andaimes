import { useCallback, useEffect, useMemo, useState } from 'react'
import { jsPDF } from 'jspdf'
import ExcelJS from 'exceljs'
import {
  ArrowDownToLine, Calculator, FilePlus2, FileSpreadsheet, FileText,
  Plus, RefreshCw, Save, Trash2
} from 'lucide-react'
import { supabase } from './lib'

type Item = {
  item: string
  description: string
  tag: string
  area: string
  height: string
  length: string
  width: string
  assembly: string
  project: string
  status: string
  pricing_mode: 'automatico' | 'manual'
  pricing_basis: 'm2' | 'm3' | 'ml' | 'un'
  unit_price: string
  manual_total: string
}
type Quote = {
  id: string
  quote_number: string
  client_name: string
  requester: string | null
  project_name: string | null
  work_site: string | null
  quote_date: string
  valid_until: string | null
  discount: number
  extra_cost: number
  subtotal: number
  total: number
  notes: string | null
  items: Item[]
  created_at: string
}
const emptyItem = (n: number): Item => ({
  item: String(n).padStart(2, '0'), description: '', tag: '', area: '',
  height: '', length: '', width: '', assembly: '', project: '', status: '',
  pricing_mode: 'automatico', pricing_basis: 'm2', unit_price: '', manual_total: ''
})
const money = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const number = (v: string) => {
  const n = Number(String(v || '0').replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}
const quoteTotal = (item: Item) => {
  if (item.pricing_mode === 'manual') return number(item.manual_total)
  const h = number(item.height), l = number(item.length), w = number(item.width)
  const qty = item.pricing_basis === 'm2' ? h * l
    : item.pricing_basis === 'm3' ? h * l * w
      : item.pricing_basis === 'ml' ? l : 1
  return qty * number(item.unit_price)
}
const dateToday = () => {
  const d = new Date()
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}
const fileName = (v: string) => (v || 'orcamento').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_-]+/g, '-')

export default function Quotations({ readOnly = false }: { readOnly?: boolean }) {
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [editingQuoteId, setEditingQuoteId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [client, setClient] = useState('')
  const [requester, setRequester] = useState('')
  const [project, setProject] = useState('')
  const [workSite, setWorkSite] = useState('')
  const [quoteDate, setQuoteDate] = useState(dateToday())
  const [validUntil, setValidUntil] = useState('')
  const [discount, setDiscount] = useState('0')
  const [extraCost, setExtraCost] = useState('0')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<Item[]>(() => [emptyItem(1)])
  const [message, setMessage] = useState('')

  const loadQuotes = useCallback(async () => {
    if (!supabase) return
    setLoading(true)
    const { data, error } = await supabase.from('quotations')
      .select('*').order('created_at', { ascending: false })
    if (error) setMessage(`Não foi possível carregar os orçamentos: ${error.message}`)
    else setQuotes((data || []) as Quote[])
    setLoading(false)
  }, [])

  useEffect(() => { void loadQuotes() }, [loadQuotes])

  const filledItems = useMemo(() => items.filter(i =>
    [i.description, i.tag, i.area, i.height, i.length, i.width, i.assembly, i.project, i.status].some(v => v.trim())
  ), [items])
  const subtotal = useMemo(() => filledItems.reduce((sum, i) => sum + quoteTotal(i), 0), [filledItems])
  const total = Math.max(0, subtotal - number(discount) + number(extraCost))

  function resetForm() {
    setEditingQuoteId(null)
    setClient(''); setRequester(''); setProject(''); setWorkSite('')
    setQuoteDate(dateToday()); setValidUntil(''); setDiscount('0')
    setExtraCost('0'); setNotes('')
    setItems([emptyItem(1)])
    setCreating(false); setMessage('')
  }
function editQuote(q: Quote) {
  setEditingQuoteId(q.id)
  setClient(q.client_name || '')
  setRequester(q.requester || '')
  setProject(q.project_name || '')
  setWorkSite(q.work_site || '')
  setQuoteDate(q.quote_date || dateToday())
  setValidUntil(q.valid_until || '')
  setDiscount(String(q.discount ?? 0))
  setExtraCost(String(q.extra_cost ?? 0))
  setNotes(q.notes || '')
  setItems(q.items?.length ? q.items : [emptyItem(1)])
  setMessage(`Editando orçamento de ${q.client_name}`)
  setCreating(true)
}
  function updateItem(index: number, field: keyof Item, value: string) {
    setItems(current => current.map((item, i) => i === index ? { ...item, [field]: value } : item))
  }
  function addItems(amount = 1) {
    setItems(current => [
      ...current,
      ...Array.from({ length: amount }, (_, i) => emptyItem(current.length + i + 1))
    ])
  }
  function removeItem(index: number) {
    setItems(current => current.filter((_, i) => i !== index).map((item, i) => ({ ...item, item: String(i + 1).padStart(2, '0') })))
  }

  async function saveQuote() {
    if (readOnly) {
      setMessage('Seu usuário não tem permissão para salvar orçamentos.')
      return
    }

    if (!supabase) {
      setMessage('Conexão com o Supabase não configurada. Confira o arquivo .env.')
      return
    }
    if (!client.trim()) { setMessage('Informe o cliente antes de salvar.'); return }
    if (!filledItems.length) { setMessage('Preencha pelo menos uma descrição de ponto ou equipamento.'); return }
    setSaving(true); setMessage('')
    const payload = {
      client_name: client.trim(), requester: requester.trim() || null,
      project_name: project.trim() || null, work_site: workSite.trim() || null,
      quote_date: quoteDate, valid_until: validUntil || null,
      discount: number(discount), extra_cost: number(extraCost),
      subtotal, total, notes: notes.trim() || null, items
    }
    const { error } = editingQuoteId
  ? await supabase.from('quotations').update(payload).eq('id', editingQuoteId)
  : await supabase.from('quotations').insert(payload)
    setSaving(false)
    if (error) { setMessage(`Erro ao salvar: ${error.message}. Confira se a migração SQL foi executada.`); return }
    setMessage('Orçamento salvo com sucesso.')
    await loadQuotes()
    
    setCreating(false)
  }

  async function deleteQuote(q: Quote) {
    if (readOnly) {
      setMessage('Seu usuário não tem permissão para excluir orçamentos.')
      return
    }

    if (!supabase) {
      setMessage('Conexão com o Supabase não configurada.')
      return
    }

    const confirmed = window.confirm(
      `Deseja realmente excluir o orçamento de ${q.client_name}?\n\nEssa ação não poderá ser desfeita.`
    )

    if (!confirmed) return

    setSaving(true)
    setMessage('')

    const { error } = await supabase
      .from('quotations')
      .delete()
      .eq('id', q.id)

    setSaving(false)

    if (error) {
      setMessage(`Erro ao excluir orçamento: ${error.message}`)
      return
    }

    setMessage(`Orçamento de ${q.client_name} excluído com sucesso.`)
    await loadQuotes()
  }

  const getExportItems = (source: Item[]) => source

    .filter(i => [i.description, i.tag, i.area, i.height, i.length, i.width, i.assembly, i.project, i.status]
      .some(v => String(v || '').trim()))
    .map((item, index) => ({ ...item, item: String(index + 1).padStart(2, '0') }))

  
  async function exportSpreadsheet(quote: Partial<Quote> & { items: Item[]; client_name: string; quote_date: string; discount: number; extra_cost: number }) {
    const headers = [
      'ITEM',
      'DESCRIÇÃO',
      'TAG',
      'ÁREA',
      'ALTURA',
      'COMPRIMENTO',
      'LARGURA',
      'MONTAGEM',
      'PROJETO',
      'STATUS'
    ]

    const rows = getExportItems(quote.items).map(item => [
      item.item,
      item.description || '',
      item.tag || '',
      item.area || '',
      item.height || '',
      item.length || '',
      item.width || '',
      item.assembly || '',
      item.project || '',
      item.status || ''
    ])

    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'VM Andaimes'
    workbook.subject = 'Relação de pontos de parada'
    workbook.title = 'Relação de pontos de parada'

    const sheet = workbook.addWorksheet('Pontos de parada')

    sheet.columns = [
      { header: headers[0], key: 'item', width: 8 },
      { header: headers[1], key: 'description', width: 65 },
      { header: headers[2], key: 'tag', width: 13 },
      { header: headers[3], key: 'area', width: 13 },
      { header: headers[4], key: 'height', width: 12 },
      { header: headers[5], key: 'length', width: 16 },
      { header: headers[6], key: 'width', width: 12 },
      { header: headers[7], key: 'assembly', width: 20 },
      { header: headers[8], key: 'project', width: 18 },
      { header: headers[9], key: 'status', width: 14 }
    ]

    sheet.addRows(rows)
    
    // Mescla a descrição do local nas linhas dos andaimes daquele ponto
    let startRow = 2

    while (startRow <= rows.length + 1) {
      const description = String(sheet.getCell(startRow, 2).value || '').trim()

      if (!description) {
        startRow++
        continue
      }

      let endRow = startRow

      while (
        endRow + 1 <= rows.length + 1 &&
        String(sheet.getCell(endRow + 1, 2).value || '').trim() === description
      ) {
        endRow++
      }

      if (endRow > startRow) {
        sheet.mergeCells(startRow, 2, endRow, 2)
      }

      startRow = endRow + 1
    }


    sheet.views = [{ state: 'frozen', ySplit: 1 }]

    sheet.pageSetup = {
      paperSize: 9,
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      printTitlesRow: '1:1',
      margins: {
        left: 0.2,
        right: 0.2,
        top: 0.35,
        bottom: 0.35,
        header: 0.15,
        footer: 0.15
      }
    }

    sheet.pageSetup.printArea = `A1:J${Math.max(1, rows.length + 1)}`
    sheet.properties.defaultRowHeight = 22

    const thinBlack = {
      style: 'thin' as const,
      color: { argb: 'FF000000' }
    }

    const header = sheet.getRow(1)
    header.height = 30

    for (let col = 1; col <= 10; col++) {
      const cell = header.getCell(col)

      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1F4E78' }
      }

      cell.font = {
        name: 'Arial',
        size: 10,
        bold: true,
        color: { argb: 'FFFFFFFF' }
      }

      cell.alignment = {
        horizontal: 'center',
        vertical: 'middle',
        wrapText: true
      }

      cell.border = {
        top: thinBlack,
        left: thinBlack,
        bottom: thinBlack,
        right: thinBlack
      }
    }

    for (let rowNumber = 2; rowNumber <= rows.length + 1; rowNumber++) {
      const row = sheet.getRow(rowNumber)
      row.height = 22

      for (let col = 1; col <= 10; col++) {
        const cell = row.getCell(col)

        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: {
            argb: col <= 8 ? 'FFF1F2F5' : 'FFFFFFFF'
          }
        }

        cell.font = {
          name: 'Arial',
          size: 10,
          color: { argb: 'FF111111' }
        }

        cell.alignment = {
          horizontal: 'center',
          vertical: 'middle',
          wrapText: true
        }

        cell.border = {
          top: thinBlack,
          left: thinBlack,
          bottom: thinBlack,
          right: thinBlack
        }
      }
    }

    const buffer = await workbook.xlsx.writeBuffer()

    download(
      new Blob([buffer as BlobPart], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      }),
      `VM-Planilha-Pontos-${fileName(quote.client_name)}.xlsx`
    )
  }

  function download(blob: Blob, name: string) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = name; a.click()
    URL.revokeObjectURL(url)
  }


  function exportPdf(quote: Partial<Quote> & { items: Item[]; client_name: string; quote_date: string; discount: number; extra_cost: number }) {
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    })

    const rows = getExportItems(quote.items)

    const headers = [
      'ITEM',
      'DESCRIÇÃO',
      'TAG',
      'ÁREA',
      'ALTURA',
      'COMPRIMENTO',
      'LARGURA',
      'MONTAGEM',
      'PROJETO',
      'STATUS'
    ]

    const widths = [11, 125, 15, 15, 15, 19, 15, 28, 25, 19]

    const xPositions: number[] = []
    let x = 5

    widths.forEach(width => {
      xPositions.push(x)
      x += width
    })

    let y = 8

    const headerHeight = 10
    const pageBottom = 202

    const thinBlack = 0.15

    const drawHeader = () => {
      headers.forEach((title, index) => {
        const cx = xPositions[index]
        const width = widths[index]

        pdf.setFillColor(31, 78, 120)
        pdf.setDrawColor(0, 0, 0)
        pdf.setLineWidth(thinBlack)
        pdf.rect(cx, y, width, headerHeight, 'FD')

        pdf.setFont('helvetica', 'bold')
        pdf.setFontSize(7)
        pdf.setTextColor(255, 255, 255)

        pdf.text(
          title,
          cx + width / 2,
          y + 6.3,
          { align: 'center' }
        )
      })

      y += headerHeight
    }

    drawHeader()

    rows.forEach(item => {
      const values = [
        item.item,
        item.description || '',
        item.tag || '',
        item.area || '',
        item.height || '',
        item.length || '',
        item.width || '',
        item.assembly || '',
        item.project || '',
        item.status || ''
      ]

      const wrapped = values.map((value, index) =>
        pdf.splitTextToSize(
          String(value),
          widths[index] - 2
        )
      )

      const rowHeight = Math.max(
        7,
        ...wrapped.map(lines => lines.length * 3.2 + 2)
      )

      if (y + rowHeight > pageBottom) {
        pdf.addPage()
        y = 8
        drawHeader()
      }

      values.forEach((_, index) => {
        const cx = xPositions[index]
        const width = widths[index]

        pdf.setFillColor(
          index < 8 ? 241 : 255,
          index < 8 ? 242 : 255,
          index < 8 ? 245 : 255
        )

        pdf.setDrawColor(0, 0, 0)
        pdf.setLineWidth(thinBlack)

        pdf.rect(
          cx,
          y,
          width,
          rowHeight,
          'FD'
        )

        pdf.setFont('helvetica', 'normal')
        pdf.setFontSize(7)
        pdf.setTextColor(17, 17, 17)

        const lines = wrapped[index]

        if (lines.length > 0) {
          pdf.text(
            lines,
            cx + width / 2,
            y + 3.8,
            { align: 'center' }
          )
        }
      })

      y += rowHeight
    })

    pdf.save(
      `VM-Planilha-Pontos-${fileName(quote.client_name)}.pdf`
    )
  }

  
async function exportCurrent(kind: 'xlsx' | 'pdf') {
    const current = {
      client_name: client,
      requester,
      project_name: project,
      work_site: workSite,
      quote_date: quoteDate,
      valid_until: validUntil,
      discount: number(discount),
      extra_cost: number(extraCost),
      notes,
      items
    }

    if (kind === 'xlsx') {
      await exportSpreadsheet(current)
    } else {
      exportPdf(current)
    }
  }
  async function exportSaved(q: Quote, kind: 'xlsx' | 'pdf') {
    if (kind === 'xlsx') await exportSpreadsheet(q)
    else exportPdf(q)
  }

  return (
    <section className="panel quotation-module">
      <div className="panel-heading">
        <div><h2>Orçamentos VM</h2><p>Monte propostas, calcule valores e baixe a planilha no modelo CSV original e PDF.</p></div>
        {!readOnly && <button className="btn primary" onClick={() => { setCreating(true); setMessage('') }}><FilePlus2 size={17}/> Novo orçamento</button>}
      </div>
      {message && <div className="quotation-message">{message}</div>}
      {creating && (
        <div className="quotation-editor">
          <div className="quotation-section-title"><h3>Identificação do orçamento</h3><span>Preencha os dados do cliente e projeto</span></div>
          <div className="quotation-fields">
            <label>Cliente / empresa<input value={client} onChange={e => setClient(e.target.value)} placeholder="Nome do cliente" /></label>
            <label>Solicitado por<input value={requester} onChange={e => setRequester(e.target.value)} placeholder="Nome do solicitante" /></label>
            <label>Projeto<input value={project} onChange={e => setProject(e.target.value)} placeholder="Número ou nome do projeto" /></label>
            <label>Área / local<input value={workSite} onChange={e => setWorkSite(e.target.value)} placeholder="Área ou local da montagem" /></label>
            <label>Data<input type="date" value={quoteDate} onChange={e => setQuoteDate(e.target.value)} /></label>
            <label>Validade<input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} /></label>
          </div>
          <div className="quotation-section-title"><h3>Pontos de parada / equipamentos</h3><span>{items.length} linhas disponíveis · somente itens preenchidos serão baixados</span></div>
          <div className="quotation-items-list">
            {items.map((it, index) => (
              <article className="quotation-item-card" key={index}>
                <div className="quotation-item-card-heading">
                  <strong>ITEM {it.item}</strong>
                  <span className="quotation-total-cell">{money(quoteTotal(it))}</span>
                  <button className="icon-btn" title={`Remover item ${it.item}`} onClick={() => removeItem(index)} disabled={items.length === 1}><Trash2 size={15}/></button>
                </div>
                <div className="quotation-item-grid">
                  <label className="quotation-item-description">DESCRIÇÃO<input aria-label={`Descrição item ${it.item}`} value={it.description} onChange={e => updateItem(index,'description',e.target.value)} placeholder="Descrição do ponto ou equipamento" /></label>
                  <label>TAG<input value={it.tag} onChange={e => updateItem(index,'tag',e.target.value)} /></label>
                  <label>ÁREA<input value={it.area} onChange={e => updateItem(index,'area',e.target.value)} /></label>
                  <label>ALTURA<input type="number" min="0" step="0.01" value={it.height} onChange={e => updateItem(index,'height',e.target.value)} /></label>
                  <label>COMPRIMENTO<input type="number" min="0" step="0.01" value={it.length} onChange={e => updateItem(index,'length',e.target.value)} /></label>
                  <label>LARGURA<input type="number" min="0" step="0.01" value={it.width} onChange={e => updateItem(index,'width',e.target.value)} /></label>
                  <label>MONTAGEM<input value={it.assembly} onChange={e => updateItem(index,'assembly',e.target.value)} /></label>
                  <label>PROJETO<input value={it.project} onChange={e => updateItem(index,'project',e.target.value)} /></label>
                  <label>STATUS<input value={it.status} onChange={e => updateItem(index,'status',e.target.value)} /></label>
                  <label>CÁLCULO<select value={it.pricing_mode} onChange={e => updateItem(index,'pricing_mode',e.target.value as Item['pricing_mode'])}><option value="automatico">Automático</option><option value="manual">Manual</option></select></label>
                  <label>BASE<select value={it.pricing_basis} onChange={e => updateItem(index,'pricing_basis',e.target.value as Item['pricing_basis'])}><option value="m2">m²</option><option value="m3">m³</option><option value="ml">Metro linear</option><option value="un">Unidade</option></select></label>
                  <label>PREÇO UNITÁRIO (R$)<input type="number" min="0" step="0.01" value={it.unit_price} onChange={e => updateItem(index,'unit_price',e.target.value)} /></label>
                  <label>VALOR MANUAL (R$)<input type="number" min="0" step="0.01" value={it.manual_total} onChange={e => updateItem(index,'manual_total',e.target.value)} /></label>
                </div>
              </article>
            ))}
          </div>
          <div className="quotation-add-actions">
            <button className="btn secondary" onClick={() => addItems(1)}><Plus size={16}/> Adicionar 1 linha</button>
            <button className="btn secondary" onClick={() => addItems(10)}><Plus size={16}/> Adicionar 10 linhas</button>
            <span>{items.length} linhas no formulário · sem limite fixo de linhas</span>
          </div>
          <div className="quotation-section-title"><h3>Preços e condições</h3><span>Preço unitário para cálculo automático</span></div>
          <div className="quotation-fields quotation-price-fields">
            <label>Desconto (R$)<input type="number" min="0" step="0.01" value={discount} onChange={e => setDiscount(e.target.value)} /></label>
            <label>Acréscimos (R$)<input type="number" min="0" step="0.01" value={extraCost} onChange={e => setExtraCost(e.target.value)} /></label>
            <label className="quotation-notes">Observações<textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}/></label>
          </div>
          <div className="quotation-summary">
            <div><span>Subtotal</span><strong>{money(subtotal)}</strong></div>
            <div><span>Desconto</span><strong>{money(number(discount))}</strong></div>
            <div><span>Acréscimos</span><strong>{money(number(extraCost))}</strong></div>
            <div className="quotation-grand-total"><span>Total do orçamento</span><strong>{money(total)}</strong></div>
          </div>
          <div className="quotation-actions">
            
<button className="btn secondary" onClick={() => void exportCurrent('xlsx')}>
  <FileSpreadsheet size={17}/> Baixar Excel
</button>

<button className="btn secondary" onClick={() => void exportCurrent('pdf')}>
  <ArrowDownToLine size={17}/> Baixar PDF
</button>
            {!readOnly && <button className="btn primary" disabled={saving} onClick={() => void saveQuote()}><Save size={17}/>{saving ? 'Salvando...' : 'Salvar orçamento'}</button>}
            <button className="btn ghost" onClick={resetForm}>Cancelar</button>
          </div>
          <p className="quotation-help"><Calculator size={14}/> Cálculo automático: m² = altura × comprimento; m³ = altura × comprimento × largura; metro linear = comprimento; unidade = 1. No modo manual, informe o valor total da linha.</p>
        </div>
      )}
      <div className="quotation-section-title quotation-list-title"><h3>Orçamentos salvos</h3><button className="btn secondary" onClick={() => void loadQuotes()}><RefreshCw size={15}/> Atualizar</button></div>
      {loading ? <p className="muted">Carregando orçamentos...</p> : quotes.length === 0 ? (
        <div className="empty"><FileText size={26}/><p>Nenhum orçamento salvo ainda.</p></div>
      ) : (
        <div className="quotation-saved-list">{quotes.map(q => (
          <div className="quotation-saved-row" key={q.id}>
            <div><strong>{q.client_name}</strong><span>{q.client_name} · {q.project_name || 'Sem projeto'} · {q.quote_date}</span></div>
            <strong>{money(Number(q.total || 0))}</strong>
            <div className="quotation-saved-actions">
            <button
  className="btn secondary"
  onClick={() => editQuote(q)}
>
  Editar
</button>
              <button className="btn secondary" onClick={() => void exportSaved(q,'xlsx')}><FileSpreadsheet size={15}/> Planilha Excel</button>
              <button className="btn secondary" onClick={() => void exportSaved(q,'pdf')}><ArrowDownToLine size={15}/> PDF</button>

{!readOnly && (
  <button
    className="btn secondary"
    onClick={() => void deleteQuote(q)}
    disabled={saving}
  >
    <Trash2 size={15} /> Excluir
  </button>
)}

            </div>
          </div>
        ))}</div>
      )}
    </section>
  )
}

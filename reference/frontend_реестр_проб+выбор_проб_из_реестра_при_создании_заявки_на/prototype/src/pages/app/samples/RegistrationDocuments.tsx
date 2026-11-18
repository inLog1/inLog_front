import { Input } from '../../../shared/ui/input'
import { ATTACHMENT_TYPES, displayAttachmentType, type AttachmentType, type SampleAttachment } from './attachments'
import type { DocumentDraft } from './documentDraft'

export function RegistrationDocumentsField({ draft, onChange, existing, batch, disabled, summaryLabel }: { draft: DocumentDraft; onChange: (value: DocumentDraft) => void; existing: SampleAttachment[]; batch?: boolean; disabled?: boolean; summaryLabel?:string }) {
  return <details className="rounded-lg border border-border bg-muted/20 p-4">
    <summary className="cursor-pointer text-sm font-semibold">{summaryLabel ?? (batch ? 'Общие документы для партии' : 'Документы при поступлении')} <span className="font-normal text-muted-foreground">· необязательно{draft.files.length || draft.existingId ? ` · выбрано: ${draft.files.length + (draft.existingId ? 1 : 0)}` : ''}</span></summary>
    <p className="mt-2 text-xs text-muted-foreground">{batch ? 'Выбранные документы будут связаны с каждой пробой в партии. Документ для отдельной пробы можно добавить в её карточке.' : 'Выбранные документы будут связаны с этой пробой. Для следующей пробы их можно выбрать отдельно.'}</p>
    {existing.length > 0 && <label className="mt-3 grid gap-1.5 text-sm font-medium">Ранее добавленный документ<select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={draft.existingId} onChange={event=>onChange({...draft, existingId:event.target.value})} disabled={disabled}><option value="">Не выбран</option>{existing.map(file=><option key={file.id} value={file.id}>{displayAttachmentType(file.type)} · {file.filename}</option>)}</select></label>}
    <div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="grid gap-1.5 text-sm font-medium">Тип документа<select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={draft.type} onChange={event => onChange({...draft, type:event.target.value as AttachmentType})} disabled={disabled}>{ATTACHMENT_TYPES.map(type=><option key={type}>{type}</option>)}</select></label><label className="grid gap-1.5 text-sm font-medium">Файлы<Input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp,.docx,.xlsx" onChange={event=>onChange({...draft, files:Array.from(event.target.files ?? [])})} disabled={disabled} /></label></div>
    <p className="mt-2 text-xs text-muted-foreground">PDF, JPG, PNG, WEBP, DOCX или XLSX; до 10 файлов, по 10 МБ и 30 МБ всего.</p>
  </details>
}

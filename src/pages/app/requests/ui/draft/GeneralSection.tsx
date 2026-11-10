import { useTranslation } from 'react-i18next'
import {
  REQUEST_LEGACY_PRIORITIES,
  REQUEST_PRIORITIES,
  REQUEST_TITLE_MAX,
  isRequestPriority,
  type ExecutorLaboratory,
  type OrganizationKind,
  type RequestDraftDetails,
} from '../../../../../entities/request'
import { Input } from '../../../../../shared/ui/input'
import { CalendarDatePicker } from '../../../../../shared/ui/calendar-date-picker'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../../../shared/ui/select'
import { requestLabel } from '../../model/display'
import { DraftField, DraftSection } from './draft-ui'

const NONE = 'none'

export function GeneralSection({
  kind,
  customerName,
  executorName,
  customerOrganizationId,
  executorOrganizationId,
  customers,
  laboratories,
  partiesLoading,
  details,
  partyIssue,
  saveAttempted,
  invalid,
  onCustomer,
  onExecutor,
  onChange,
}: {
  kind: OrganizationKind
  customerName: string
  executorName: string
  customerOrganizationId: number | null
  executorOrganizationId: number | null
  customers: ExecutorLaboratory[]
  laboratories: ExecutorLaboratory[]
  partiesLoading: boolean
  details: RequestDraftDetails
  partyIssue: boolean
  saveAttempted: boolean
  invalid: Set<string>
  onCustomer: (id: number) => void
  onExecutor: (id: number | null) => void
  onChange: (next: Partial<RequestDraftDetails>) => void
}) {
  const { t } = useTranslation()
  const dash = t('requests.dash')
  const currentYear = new Date().getFullYear()
  const withCurrent = (items: ExecutorLaboratory[], id: number | null, name: string) => (
    id != null && !items.some((item) => item.id === id)
      ? [...items, { id, shortName: name || dash }]
      : items
  )
  const customerOptions = withCurrent(customers, customerOrganizationId, customerName)
  const executorOptions = withCurrent(laboratories, executorOrganizationId, executorName)
  const legacy = (REQUEST_LEGACY_PRIORITIES as readonly string[]).includes(details.priority)
  const priorities = legacy
    ? [details.priority, ...REQUEST_PRIORITIES]
    : [...REQUEST_PRIORITIES]
  return (
    <DraftSection
      id="request-general"
      index={1}
      title={t('requests.draft.sections.general')}
      description={t('requests.draft.general-lead')}
    >
      <div className="grid max-w-3xl gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <DraftField label={t('requests.draft.title')} required field="projectName">
            <Input
              value={details.projectName}
              maxLength={REQUEST_TITLE_MAX}
              aria-invalid={(saveAttempted && invalid.has('projectName')) || undefined}
              onChange={(event) => onChange({ projectName: event.target.value })}
            />
          </DraftField>
        </div>
        {kind === 'laboratory' ? (
          <DraftField label={t('requests.draft.customer')} required field="customerOrganizationId">
            <Select
              value={customerOrganizationId == null ? undefined : String(customerOrganizationId)}
              onValueChange={(value) => onCustomer(Number(value))}
              disabled={partiesLoading || customerOptions.length === 0}
            >
              <SelectTrigger aria-invalid={partyIssue && customerOrganizationId == null} className="w-full">
                <SelectValue placeholder={partiesLoading ? t('requests.loading') : t('requests.wizard.not-selected')} />
              </SelectTrigger>
              <SelectContent>
                {customerOptions.map((item) => (
                  <SelectItem key={item.id} value={String(item.id)}>{item.shortName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </DraftField>
        ) : (
          <DraftField label={t('requests.draft.customer')} required field="customerOrganizationId">
            <Input value={requestLabel(customerName, dash)} disabled />
          </DraftField>
        )}
        <DraftField label={t('requests.draft.executor')} required field="executorOrganizationId">
          <Select
            value={executorOrganizationId == null ? undefined : String(executorOrganizationId)}
            onValueChange={(value) => onExecutor(Number(value))}
            disabled={partiesLoading || executorOptions.length === 0}
          >
            <SelectTrigger aria-invalid={partyIssue} className="w-full">
              <SelectValue placeholder={partiesLoading ? t('requests.loading') : t('requests.wizard.not-selected')} />
            </SelectTrigger>
            <SelectContent>
              {executorOptions.map((item) => (
                <SelectItem key={item.id} value={String(item.id)}>{item.shortName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </DraftField>
        <DraftField label={t('requests.draft.priority')} field="priority" hint={legacy ? t('requests.draft.priority-legacy') : undefined}>
          <Select
            value={details.priority || NONE}
            onValueChange={(value) => onChange({ priority: isRequestPriority(value) ? value : '' })}
          >
            <SelectTrigger aria-invalid={invalid.has('priority')} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {details.priority === '' ? <SelectItem value={NONE}>{t('requests.wizard.not-selected')}</SelectItem> : null}
              {priorities.map((id) => (
                <SelectItem key={id} value={id}>{t(`requests.draft.priority-${id}`)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </DraftField>
        <DraftField label={t('requests.draft.desired-date')} field="plannedCompletion">
          <CalendarDatePicker
            id="plannedCompletion"
            value={details.plannedCompletion || null}
            fromYear={currentYear}
            toYear={currentYear + 30}
            aria-invalid={invalid.has('plannedCompletion')}
            onChange={(value) => onChange({ plannedCompletion: value ?? '' })}
          />
        </DraftField>
      </div>
    </DraftSection>
  )
}

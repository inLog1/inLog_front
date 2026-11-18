import { Building2, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { LabeledIconSelect } from '../../../shared/ui/labeled-icon-select'
import { organizationOptionLabel } from '../model/request-organizations'
import { useRequestOrganizations } from '../model/useRequestOrganizations'

export function OrganizationSwitcher() {
  const { t } = useTranslation()
  const choice = useRequestOrganizations()
  if (!choice.selected) {
    if (choice.pending || choice.options.length > 0) {
      return <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" aria-label={t('requests.loading')} />
    }
    return null
  }

  return (
    <LabeledIconSelect
      label={t('shell.organization')}
      icon={Building2}
      value={String(choice.selected.id)}
      options={choice.options.map((item) => ({
        value: String(item.id),
        label: organizationOptionLabel(item),
      }))}
      onValueChange={(value) => {
        const organizationId = Number(value)
        if (!Number.isInteger(organizationId)) return
        choice.select(organizationId)
      }}
      className="max-w-[14rem] sm:max-w-[20rem]"
    />
  )
}

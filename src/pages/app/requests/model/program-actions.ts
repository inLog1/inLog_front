import {
  customerProgramIsComplete,
  lineFromNeed,
  readProgramMeta,
  type RequestListItem,
  type RequestProgramMeta,
  type RequestProgramStudyLine,
  type RequestResearchNeed,
  type RequestStatus,
} from '../../../../entities/request'

export function programEditorSeed(request: RequestListItem): { lines: RequestProgramStudyLine[]; note: string } {
  const meta = readProgramMeta(request.details?.programMeta)
  const needs = request.details?.needs ?? []
  return {
    lines: meta.lines.length > 0 ? meta.lines : needs.map(lineFromNeed),
    note: meta.note,
  }
}

/** Buttons the card may show. The mock API repeats these rules. */
export type ProgramAction = 'prepare' | 'save' | 'submit' | 'agree' | 'approve' | 'edit' | 'return_program'

export function programActions(input: {
  status: RequestStatus
  customerOrganizationId: number
  executorOrganizationId: number
  organizationId: number
  needs: readonly RequestResearchNeed[]
  meta: RequestProgramMeta
  canManage: boolean
  canApprove: boolean
  editing: boolean
}): ProgramAction[] {
  if (input.status !== 'in_review' || input.meta.approval === 'approved') return []
  const own = input.customerOrganizationId === input.executorOrganizationId
  const executor = input.organizationId === input.executorOrganizationId
  const customer = input.organizationId === input.customerOrganizationId
  const defined = customerProgramIsComplete(input.needs)
    && input.meta.lines.length === 0
    && input.meta.preparedBy !== 'laboratory'
  const actions: ProgramAction[] = []

  if (executor && input.canApprove) {
    if (!own && defined) actions.push('agree')
    if (own && (defined || input.meta.approval === 'draft' || input.meta.approval === 'returned')) actions.push('approve')
  }

  const laboratoryPrepares = executor && input.canManage && !defined && input.meta.approval !== 'pending_customer'
  if (laboratoryPrepares) {
    const open = input.editing || input.meta.approval === 'draft' || input.meta.approval === 'returned'
    if (open) actions.push('save')
    else actions.push('prepare')
    if (!own && (input.meta.approval === 'draft' || input.meta.approval === 'returned')) actions.push('submit')
  }

  if (!own && customer && input.meta.approval === 'pending_customer') {
    if (input.canApprove) {
      actions.push('approve')
      actions.push('return_program')
    }
    if (input.canManage) {
      if (input.editing) actions.push('save')
      else actions.push('edit')
    }
  }

  return actions
}

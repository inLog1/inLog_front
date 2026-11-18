import { describe, expect, it } from 'vitest'
import {
  draftWriteTarget,
  applyPopstate,
  historyHold,
  internalLinkTarget,
  isOrganizationSwitch,
  settleSavedLeave,
} from './leave-guard'

const origin = 'http://localhost:5179'
const here = '/forms/form-1?org=101'

describe('form leave decisions', () => {
  it('asks before an in-app link and ignores new tabs, other sites, and the same page', () => {
    const base = { target: '', button: 0, modified: false, defaultPrevented: false, origin, current: here, base: `${origin}${here}` }
    expect(internalLinkTarget({ ...base, href: '/?org=101' })).toBe('/?org=101')
    expect(internalLinkTarget({ ...base, href: 'https://example.test/forms' })).toBeNull()
    expect(internalLinkTarget({ ...base, href: here })).toBeNull()
    expect(internalLinkTarget({ ...base, href: '/forms/form-1?org=102' })).toBeNull()
    expect(internalLinkTarget({ ...base, href: '/', modified: true })).toBeNull()
    expect(internalLinkTarget({ ...base, href: '/', target: '_blank' })).toBeNull()
  })

  it('treats only an organization search change as an organization switch', () => {
    expect(isOrganizationSwitch(here, '/forms/form-1?org=102')).toBe(true)
    expect(isOrganizationSwitch(here, '/forms/form-1?org=102&project=1')).toBe(false)
    expect(isOrganizationSwitch(here, '/?org=102')).toBe(false)
  })

  it('holds browser back and forward, and lets an organization change through', () => {
    const back = historyHold({ active: true, here, destination: '/?org=101', hereIndex: 4, destinationIndex: 3 })
    expect(back).toEqual({ hold: true, undo: 1, prompt: '/?org=101' })
    const forward = historyHold({ active: true, here, destination: '/forms?org=101', hereIndex: 4, destinationIndex: 5 })
    expect(forward).toEqual({ hold: true, undo: -1, prompt: '/forms?org=101' })
    expect(historyHold({ active: true, here, destination: '/forms/form-1?org=102', hereIndex: 4, destinationIndex: 3 }).hold).toBe(false)
    expect(historyHold({ active: false, here, destination: '/', hereIndex: 4, destinationIndex: 3 }).hold).toBe(false)
  })

  it('swallows the undo step so the router does not reload the editor', () => {
    const blocked = applyPopstate({ skipping: 0, active: true, here, destination: '/forms?org=101', hereIndex: 4, destinationIndex: 3 })
    expect(blocked).toEqual({ action: 'stop', skipping: 1, undo: 1, prompt: '/forms?org=101' })
    const undo = applyPopstate({ skipping: blocked.skipping, active: true, here, destination: here, hereIndex: 4, destinationIndex: 4 })
    expect(undo).toEqual({ action: 'stop', skipping: 0 })
    expect(applyPopstate({ skipping: 0, active: true, here, destination: '/forms/form-1?org=102', hereIndex: 4, destinationIndex: 5 }).action).toBe('ignore')
  })

  it('moves on only after the same save succeeds, and writes the original organization', () => {
    expect(settleSavedLeave({ ticket: 1, currentTicket: 1, mounted: true, saved: true })).toBe('navigate')
    expect(settleSavedLeave({ ticket: 1, currentTicket: 1, mounted: true, saved: false })).toBe('remain')
    expect(settleSavedLeave({ ticket: 1, currentTicket: 2, mounted: true, saved: true })).toBe('remain')
    expect(settleSavedLeave({ ticket: 1, currentTicket: 1, mounted: false, saved: true })).toBe('remain')
    expect(draftWriteTarget(101, 'form-1', 102)).toEqual({ organizationId: 101, formId: 'form-1' })
  })
})

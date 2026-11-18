import { describe, expect, it } from 'vitest'
import { constructorResultMatchesScreen, selectConstructorNode } from './select-constructor-node'

const organizationA = [
  { id: 1, parent: 0 },
  { id: 3, parent: 1 },
]
const organizationB = [
  { id: 2, parent: 0 },
]

describe('selectConstructorNode', () => {
  it('does not keep the previous node while the next organization list is absent', () => {
    expect(selectConstructorNode(undefined, 1)).toBeNull()
  })

  it('does not select a node that is missing from the loaded organization', () => {
    expect(selectConstructorNode(organizationB, 1)).toBe(2)
  })

  it('keeps a node that belongs to the loaded organization', () => {
    expect(selectConstructorNode(organizationA, 1)).toBe(1)
    expect(selectConstructorNode(organizationA, null)).toBe(1)
  })
})

describe('constructorResultMatchesScreen', () => {
  it('keeps a finished write on the organization and node that started it', () => {
    expect(constructorResultMatchesScreen(
      { organizationId: 101, nodeId: 1 },
      { organizationId: 102, nodeId: 2 },
    )).toBe(false)
    expect(constructorResultMatchesScreen(
      { organizationId: 101, nodeId: 1 },
      { organizationId: 101, nodeId: 1 },
    )).toBe(true)
  })
})

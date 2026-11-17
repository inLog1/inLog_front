import { describe, expect, it } from 'vitest'
import type { DirectoryDefinition, DirectoryField } from '../../../entities/personnel/model/types'
import {
  appendField,
  attributeDeleteBlock,
  attributePlacements,
  canAddAttribute,
  canDeleteAttributeGroup,
  editableFieldPatch,
  isProtectedCatalogField,
  isUserCatalogField,
  CATALOG_ALL_ID,
  filterAllCatalogFields,
  filterCatalogDirectories,
  filterCatalogFields,
  flattenCatalogFields,
  isCatalogAllView,
  moveField,
  omitField,
  replaceField,
} from './attribute-catalog'

function field(id: string, key: string, label: string, required = false): DirectoryField {
  return { id, key, label, type: 'text', required, archived: false }
}

function directory(source: DirectoryDefinition['source'], fields: DirectoryField[]): DirectoryDefinition {
  return {
    id: 'dir:101:sample',
    organizationId: 101,
    key: 'sample',
    title: 'Подразделения',
    description: '',
    revision: 2,
    fields,
    source,
    archived: false,
  }
}

describe('attribute catalog writes', () => {
  const name = field('name', 'name', 'Название', true)
  const code = field('code', 'code', 'Код')
  const manual = directory({ type: 'manual' }, [name, code])
  const registry = directory({ type: 'registry', registry: 'departments' }, [name, code])

  it('resolves all-catalog selection and flattens fields across directories', () => {
    const other = { ...manual, id: 'dir:101:other', title: 'Должности' }
    expect(isCatalogAllView(null, [manual])).toBe(true)
    expect(isCatalogAllView(CATALOG_ALL_ID, [manual])).toBe(true)
    expect(isCatalogAllView(manual.id, [manual])).toBe(false)
    expect(isCatalogAllView('missing', [manual])).toBe(true)
    const rows = flattenCatalogFields([manual, other])
    expect(rows).toHaveLength(4)
    expect(filterAllCatalogFields(rows, 'долж').map((row) => row.field.id)).toEqual(['name', 'code'])
  })

  it('filters directories by title and fields by label or code', () => {
    expect(filterCatalogDirectories([manual], 'подр').map((item) => item.id)).toEqual([manual.id])
    expect(filterCatalogDirectories([manual], 'code')).toEqual([])
    expect(filterCatalogFields([name, code], 'code').map((item) => item.id)).toEqual(['code'])
    expect(filterCatalogFields([name, code], 'наз').map((item) => item.id)).toEqual(['name'])
  })

  it('links copies of one attribute by bundle id', () => {
    const note = { ...field('a', 'custom', 'Примечание'), bundleId: 'ab-1' }
    const copy = { ...field('b', 'custom', 'Примечание'), bundleId: 'ab-1' }
    const other = field('c', 'title', 'Название')
    const left = directory({ type: 'manual' }, [note])
    const right = { ...directory({ type: 'manual' }, [copy, other]), id: 'dir:101:other', title: 'Должности' }
    expect(attributePlacements([left, right], note).map((item) => item.field.id)).toEqual(['a', 'b'])
    expect(attributePlacements([left, right], other).map((item) => item.directory.id)).toEqual([right.id])
    expect(appendField([other], { label: 'Новое', required: false, type: 'text' }, 'new:1', 'ab-1')[1]).toMatchObject({
      id: 'new:1',
      bundleId: 'ab-1',
    })
  })

  it('allows adding custom fields for manual and registry directories when structure is granted', () => {
    expect(canAddAttribute(manual, { structure: true, schemaCreate: false })).toBe(true)
    expect(canAddAttribute(registry, { structure: false, schemaCreate: true })).toBe(true)
    expect(canAddAttribute(registry, { structure: true, schemaCreate: false })).toBe(false)
    expect(canAddAttribute(manual, { structure: false, schemaCreate: true })).toBe(false)
    expect(isProtectedCatalogField(registry, name)).toBe(true)
    expect(isUserCatalogField({ ...code, key: 'custom' })).toBe(true)
    expect(appendField([name], { label: '  Примечание ', required: true, type: 'textarea', constraints: { maxLength: 500 } }, 'new:note')).toEqual([
      { id: 'name', label: 'Название', required: true, archived: false, type: 'text' },
      { id: 'new:note', label: 'Примечание', required: true, archived: false, type: 'textarea', constraints: { maxLength: 500 } },
    ])
  })

  it('keeps registry flags on protected fields and allows edits on custom extensions', () => {
    const custom = field('extra', 'custom', 'Краткое название')
    expect(editableFieldPatch(registry, name, { label: 'Имя', required: false, archived: true, type: 'text' })).toEqual({
      label: 'Имя',
      required: true,
      archived: false,
      type: 'text',
      constraints: undefined,
    })
    expect(editableFieldPatch(registry, custom, { label: 'Краткое', required: true, archived: false, type: 'text' })).toEqual({
      label: 'Краткое',
      required: true,
      archived: false,
      type: 'text',
      constraints: undefined,
    })
    expect(replaceField(registry, 'name', { label: 'Имя', required: false, archived: true, type: 'text' })).toEqual([
      { id: 'name', label: 'Имя', required: true, archived: false, type: 'text' },
      { id: 'code', label: 'Код', required: false, archived: false, type: 'text' },
    ])
  })

  it('blocks deletion of protected registry fields, filled fields, and the record label', () => {
    const custom = field('extra', 'custom', 'Краткое название')
    expect(attributeDeleteBlock(registry, code, [], true)).toBe('registry')
    expect(attributeDeleteBlock(registry, custom, [], true)).toBeNull()
    expect(attributeDeleteBlock(manual, code, [], false)).toBe('loading')
    expect(attributeDeleteBlock(manual, field('title', 'title', 'Название', true), [{ values: {} }], true)).toBe('label')
    expect(attributeDeleteBlock(manual, code, [{ values: { code: 'А' } }], true)).toBe('in-use')
    expect(attributeDeleteBlock(manual, code, [{ values: { code: '  ' } }], true)).toBeNull()
    expect(omitField([name, code], 'code')?.map((item) => item.id)).toEqual(['name'])
  })

  it('lets a delete grant remove a custom group and keeps starter and registry groups', () => {
    const custom = directory({ type: 'manual' }, [name])
    const starter = { ...custom, key: 'positions' }
    expect(canDeleteAttributeGroup(custom, { delete: true })).toBe(true)
    expect(canDeleteAttributeGroup(custom, { delete: false })).toBe(false)
    expect(canDeleteAttributeGroup(starter, { delete: true })).toBe(false)
    expect(canDeleteAttributeGroup(registry, { delete: true })).toBe(false)
  })

  it('reorders fields without dropping any', () => {
    const moved = moveField([name, code], 'code', 'name')
    expect(moved.map((item) => item.id)).toEqual(['code', 'name'])
    expect(moveField(moved, 'missing', 'name')).toBe(moved)
  })
})

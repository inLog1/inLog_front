import { describe, expect, it } from 'vitest'
import { createSeed } from '../../../app/mocks/db/seed'
import { DEFAULT_REQUEST_SAMPLE_FIELDS, getRequestSampleFields, setRequestSampleFields } from './requestFields'

describe('sample fields for requests', () => {
  it('uses defaults until an organization sets its fields', () => {
    expect(getRequestSampleFields(createSeed(), 101)).toEqual(DEFAULT_REQUEST_SAMPLE_FIELDS)
  })
  it('saves only selected fields for one organization and always keeps the sample ID', () => {
    const state = createSeed()
    const next = setRequestSampleFields(state, 2, 101, ['well','sampleType','well'])
    expect(getRequestSampleFields(next, 101)).toEqual(['code','sampleType','parentCode','well','stage','inspection'])
    expect(getRequestSampleFields(next, 102)).toEqual(DEFAULT_REQUEST_SAMPLE_FIELDS)
    expect(state.sampleRequestFields).toBeUndefined()
  })
  it('only allows a superadmin or administrator for the selected organization', () => {
    const state = createSeed()
    expect(() => setRequestSampleFields(state, 3, 101, ['field'])).toThrow('forbidden')
    expect(() => setRequestSampleFields(state, 2, 102, ['field'])).toThrow('forbidden')
    expect(getRequestSampleFields(setRequestSampleFields(state, 1, 102, ['field']), 102)).toEqual(['code','parentCode','field','stage','inspection'])
    expect(() => setRequestSampleFields(state, 1, 101, ['unknown'])).toThrow('invalid-fields')
  })
})

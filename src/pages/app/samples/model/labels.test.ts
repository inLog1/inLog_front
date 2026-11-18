import { describe, expect, it } from 'vitest'
import { SAMPLE_INSPECTIONS, SAMPLE_STAGES, SAMPLE_TYPES } from '../../../../entities/sample'
import {
  SAMPLE_INSPECTION_MESSAGE_KEY,
  SAMPLE_STAGE_MESSAGE_KEY,
  sampleTypeMessageKey,
} from './labels'

describe('sample screen labels', () => {
  it('maps stored stages, inspections and types to translation keys', () => {
    for (const stage of SAMPLE_STAGES) {
      expect(SAMPLE_STAGE_MESSAGE_KEY[stage]).toMatch(/^samples\.stage\./)
    }
    for (const inspection of SAMPLE_INSPECTIONS) {
      expect(SAMPLE_INSPECTION_MESSAGE_KEY[inspection]).toMatch(/^samples\.inspection\./)
    }
    for (const type of SAMPLE_TYPES) {
      expect(sampleTypeMessageKey(type)).toMatch(/^samples\.types\.sample-type-/)
    }
    expect(sampleTypeMessageKey('Не указан')).toBe('samples.types.unspecified')
    expect(SAMPLE_STAGE_MESSAGE_KEY['Поступила']).not.toBe('Received')
  })
})

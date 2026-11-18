/** Shared mock sample types used by the registry and research programs. */
export const SAMPLE_TYPES = ['Керн', 'Нефть', 'Газ', 'Вода', 'Конденсат', 'Другое'] as const
export const SAMPLE_TYPE_OPTIONS = [
  { id:'sample-type-core', label:SAMPLE_TYPES[0] },
  { id:'sample-type-oil', label:SAMPLE_TYPES[1] },
  { id:'sample-type-gas', label:SAMPLE_TYPES[2] },
  { id:'sample-type-water', label:SAMPLE_TYPES[3] },
  { id:'sample-type-condensate', label:SAMPLE_TYPES[4] },
  { id:'sample-type-other', label:SAMPLE_TYPES[5] },
] as const
/** Former request values remain readable on already saved drafts. */
export const LEGACY_SAMPLE_KIND_IDS: readonly string[] = ['sample-kind-depth', 'sample-kind-surface', 'sample-kind-separator']

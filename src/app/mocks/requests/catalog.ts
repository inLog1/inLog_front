import type { RequestCatalog, RequestDraftCatalogIds } from '../../../entities/request'

/**
 * Limited demonstration values for the request wizard.
 * Personnel directories are departments and positions, and reading them needs directories.read.
 * Request authors do not receive that grant, so the research lists stay inside the request mock.
 */
const OPTIONS = {
  fields: [
    { id: 'field-north', label: 'Северное' },
    { id: 'field-east', label: 'Восточное' },
  ],
  wells: [
    { id: 'well-12', label: '12' },
    { id: 'well-18', label: '18' },
  ],
  pads: [
    { id: 'pad-3', label: '3' },
    { id: 'pad-7', label: '7' },
  ],
  formations: [
    { id: 'formation-u1', label: 'Ю1' },
    { id: 'formation-u2', label: 'Ю2' },
  ],
  materials: [
    { id: 'material-sandstone', label: 'Песчаник' },
    { id: 'material-clay', label: 'Глина' },
  ],
  fluidKinds: [
    { id: 'fluid-oil', label: 'Нефть' },
    { id: 'fluid-gas', label: 'Газ' },
    { id: 'fluid-water', label: 'Вода' },
  ],
  wellTypes: [
    { id: 'well-type-production', label: 'Добывающая' },
    { id: 'well-type-exploration', label: 'Разведочная' },
  ],
  sampleKinds: [
    { id: 'sample-kind-depth', label: 'Глубинная' },
    { id: 'sample-kind-surface', label: 'Поверхностная' },
    { id: 'sample-kind-separator', label: 'Сепараторная' },
  ],
  workKinds: [
    { id: 'work-porosity', label: 'Пористость' },
    { id: 'work-permeability', label: 'Проницаемость' },
    { id: 'work-saturation', label: 'Насыщенность' },
    { id: 'work-composition', label: 'Состав флюида' },
  ],
  units: [
    { id: 'unit-sample', label: 'обр.' },
    { id: 'unit-meter', label: 'м' },
    { id: 'unit-milliliter', label: 'мл' },
  ],
  curators: [
    { id: 'curator-petrova', label: 'Петрова М. С.' },
    { id: 'curator-sokolov', label: 'Соколов И. П.' },
  ],
} as const

export function requestDraftOptions(): Omit<RequestCatalog, 'organizationKind'> {
  const options = OPTIONS
  return {
    fields: [...options.fields],
    wells: [...options.wells],
    pads: [...options.pads],
    formations: [...options.formations],
    materials: [...options.materials],
    fluidKinds: [...options.fluidKinds],
    wellTypes: [...options.wellTypes],
    sampleKinds: [...options.sampleKinds],
    workKinds: [...options.workKinds],
    units: [...options.units],
    curators: [...options.curators],
    samples: [
      { id: 'sample-k104', number: 'К-104', geologicalNumber: 'Г-104', sampleKind: 'core', interval: '2410–2411', geometry: 'cylinder', remainder: '1', availability: 'available' },
      { id: 'sample-k118', number: 'К-118', geologicalNumber: 'Г-118', sampleKind: 'core', interval: '2418–2419', geometry: 'cylinder', remainder: '0,4', availability: 'in_use' },
      { id: 'sample-f22', number: 'Ф-22', geologicalNumber: 'Г-22', sampleKind: 'fluid', interval: '1860–1862', geometry: 'bottle', remainder: '1', availability: 'available' },
      { id: 'sample-f30', number: 'Ф-30', geologicalNumber: 'Г-30', sampleKind: 'fluid', interval: '1904–1906', geometry: 'bottle', remainder: '0', availability: 'archived' },
    ],
  }
}

export function requestDraftCatalogIds(): RequestDraftCatalogIds {
  const options = requestDraftOptions()
  return {
    fields: options.fields.map((item) => item.id),
    wells: options.wells.map((item) => item.id),
    pads: options.pads.map((item) => item.id),
    formations: options.formations.map((item) => item.id),
    materials: options.materials.map((item) => item.id),
    fluidKinds: options.fluidKinds.map((item) => item.id),
    wellTypes: options.wellTypes.map((item) => item.id),
    sampleKinds: options.sampleKinds.map((item) => item.id),
    workKinds: options.workKinds.map((item) => item.id),
    units: options.units.map((item) => item.id),
    curators: options.curators.map((item) => item.id),
    samples: options.samples.map((item) => item.id),
  }
}

import { Box, ClipboardList, FileText, FlaskConical, Layers, List, Table2, TestTubes, type LucideIcon } from 'lucide-react'
import { isSectionIcon, type SectionIconKey } from '../../../entities/section'

const ICONS: Record<SectionIconKey, LucideIcon> = {
  clipboard: ClipboardList,
  table: Table2,
  layers: Layers,
  box: Box,
  'file-text': FileText,
  list: List,
  flask: FlaskConical,
  samples: TestTubes,
}

export function sectionIcon(key: string): LucideIcon {
  return isSectionIcon(key) ? ICONS[key] : ClipboardList
}

export const SECTION_ICON_LIST = Object.keys(ICONS) as SectionIconKey[]

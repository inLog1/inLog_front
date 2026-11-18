import type { LithGroup, WellRow } from "./types"

export function prepareLithology(
    data: WellRow[],
    lithDict: any
  ): LithGroup[] {
    const result: LithGroup[] = []
  
    let current: any = null
  
    data.forEach(row => {
      if (row.lith == null) return
  
      if (!current || current.lithId !== row.lith) {
        if (current) result.push(current)
  
        const lithMeta = lithDict[row.lith] ?? {}
  
        current = {
          lithId: row.lith,
          start: row.dept,
          end: row.dept,
          color: lithMeta.color ?? '#fff',
          name: lithMeta.name ?? `Литотип ${row.lith}`,
          vertDepthText: 'Н/Д'
        }
      } else {
        current.end = row.dept
      }
    })
  
    if (current) result.push(current)
  
    return result
  }
  
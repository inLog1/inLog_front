export type WellRow = {
    dept: number
    verticalDept?: number
    lith?: number
    [curve: string]: number | undefined
  }
  
  export type LithGroup = {
    lithId: number
    start: number
    end: number
    color: string
    name: string
    vertDepthText: string
  }
  
  export type CurveConfig =
    | {
        type: 'single'
        column: string
        name: string
        title: string
        log_scale?: boolean
      }
    | {
        type: 'multi'
        columns: string[]
        names: string[]
        title: string
        log_scale?: boolean
      }
  
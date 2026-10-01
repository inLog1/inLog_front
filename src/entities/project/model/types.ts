export interface Project {
    id: number
    name: string
    organization?: number
    role?: string | null
    reservoir: string
    company_customer: string
    contractor: string
    country: string
    created_at?: string
    wells?: any
    pads?: any
    cores?: any
    wellBores?: any
    well_log_mnemonics?:any
    well_log_strange_nans?:string[]
    isCollapsed?:boolean
}
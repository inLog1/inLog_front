export interface ProjectRequest {
    name: string
    reservoir: string
    company_customer: string
    contractor: string
    country: string
    organization: number
}

export interface MemberResponse {
    belonging: string
    created_at: string
    id: number
    project: number
    role: string
    user: {
        email: string
        full_name: string
        id: number
        mobile_phone: string
        name: string
        organization: string
        position: string
        work_phone: string
        avatar: {
            large: string
            medium: string
            small: string
            original: string
        }
    }
}
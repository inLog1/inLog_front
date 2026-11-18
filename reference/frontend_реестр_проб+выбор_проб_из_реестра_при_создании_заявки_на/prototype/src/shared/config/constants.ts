export const ACCESS_TOKEN = 'token'
export const REFRESH_TOKEN = 'refresh_token'

export const DATE_REQUEST_FORMAT = 'yyyy-MM-dd'
export const DATE_VIEW_FORMAT = 'dd.MM.yyyy'
export const DEBOUNCE_DELAY = 500

export const priorityTypes = {
    low: 'low',
    medium: 'medium',
    important: 'important',
    critical: 'critical',
} as const

export const priorityColors = {
    [priorityTypes.low]: 'green-500',
    [priorityTypes.medium]: 'yellow-500',
    [priorityTypes.important]: 'orange-500',
    [priorityTypes.critical]: 'red-500',
}

export const priorityColorStyles = {
    [priorityTypes.low]: 'var(--low-priority)',
    [priorityTypes.medium]: 'var(--medium-priority)',
    [priorityTypes.important]: 'var(--important-priority)',
    [priorityTypes.critical]: 'var(--critical-priority)',
}

export const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg', '.ico', '.tiff', '.tif', '.heic', '.heif']

export const APP_LANGUAGE_KEY = 'app-language'
export const I18NEXT_LANGUAGE_KEY = 'i18nextLng'
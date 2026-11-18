export const getValidText = (value?: string | null) => value?.trim() ?? ''

export const getUserFullName = (user?: {
  first_name?: string
  last_name?: string
  name?: string
  surname?: string
  email?: string
}) => {
  const fromApi = `${getValidText(user?.first_name)} ${getValidText(user?.last_name)}`.trim()
  if (fromApi) return fromApi

  const legacy = `${getValidText(user?.name)} ${getValidText(user?.surname)}`.trim()
  return legacy || getValidText(user?.email)
}

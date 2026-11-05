/** Heading on an organization card: full name, then the short name in parentheses. */
export function organizationHeading(fullName: string, shortName: string): string {
  const full = fullName.trim()
  const short = shortName.trim()
  if (!full) return short
  if (!short) return full
  return `${full}(${short})`
}

/**
 * Surname, initials and position. Every part is required.
 * A missing surname, given name, patronymic or position yields null.
 */
export function personWithPosition(person: {
  surname: string
  name: string
  patronymic: string
  position: string
}): string | null {
  const surname = person.surname.trim()
  const name = person.name.trim()
  const patronymic = person.patronymic.trim()
  const position = person.position.trim()
  if (!surname || !name || !patronymic || !position) return null
  const initial = (value: string) => value.charAt(0).toLocaleUpperCase('ru')
  return `${surname} ${initial(name)}.${initial(patronymic)}. - ${position}`
}

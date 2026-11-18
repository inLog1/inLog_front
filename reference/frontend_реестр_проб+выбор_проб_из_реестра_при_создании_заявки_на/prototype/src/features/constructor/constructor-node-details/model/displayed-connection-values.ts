/** Fixed parents are shown without asking MultiSelect to persist the missing values. */
export function displayedConnectionValues(
  relatedGroups: readonly number[] | undefined,
  options: readonly { value: string; fixed?: boolean }[],
): string[] {
  const selected = (relatedGroups ?? []).map((id) => String(id))
  const missingFixed = options
    .filter((option) => option.fixed && !selected.includes(option.value))
    .map((option) => option.value)
  return missingFixed.length === 0 ? selected : [...selected, ...missingFixed]
}

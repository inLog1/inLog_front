let generation = 0

export function beginDevSwitch(): number {
  generation += 1
  return generation
}

export function devSwitchTicket(): number {
  return generation
}

export function isCurrentDevSwitch(ticket: number): boolean {
  return ticket === generation
}

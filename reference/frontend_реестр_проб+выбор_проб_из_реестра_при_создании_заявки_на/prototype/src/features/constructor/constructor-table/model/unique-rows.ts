type RowWithKey = {
    key: string
    [field: string]: unknown
}

export const uniqueRowsByKey = <T extends RowWithKey>(rows: T[]): T[] => {
    const byKey = new Map<string, T>()

    for (const row of rows) {
        if (!row?.key) continue

        const existing = byKey.get(row.key)
        byKey.set(row.key, existing ? { ...existing, ...row, key: row.key } : row)
    }

    return Array.from(byKey.values())
}

export const createUniqueRowKey = (existingRows: Array<{ key: string }>): string => {
    const existing = new Set(existingRows.map((row) => row.key))
    let key = Date.now().toString()

    while (existing.has(key)) {
        key = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    }

    return key
}

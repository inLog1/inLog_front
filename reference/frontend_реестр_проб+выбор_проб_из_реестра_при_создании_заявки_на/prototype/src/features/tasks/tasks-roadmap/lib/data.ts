
export const scalePresets = {
    year: [
        { unit: "year", step: 1, format: "%Y" },
    ],
    month: [
        { unit: "month", step: 1, format: "%M %Y" },
    ],
    week: [
        { unit: "month", step: 1, format: "%M %Y" },
        { unit: "week", step: 1, format: "Week %W" },
    ],
    day: [
        { unit: "month", step: 1, format: "%M %Y" },
        { unit: "week", step: 1, format: "Week %W" },
        { unit: "day", step: 1, format: "%d" },
    ],
};

export const taskTypes = [
    { id: "summary", label: "Сводка" },
    { id: "task", label: "Задача" },
    { id: "critical", label: "Критическая" },
    { id: "important", label: "Важная" },
    { id: "low", label: "Низкий приоритет" },
    { id: "medium", label: "Средний приоритет" },
    { id: "default", label: "Обычная" },
]
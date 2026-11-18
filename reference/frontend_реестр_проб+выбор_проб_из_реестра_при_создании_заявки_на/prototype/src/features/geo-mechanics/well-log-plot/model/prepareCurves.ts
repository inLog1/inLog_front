import type { WellRow, CurveConfig } from "./types"
import type { Data } from "plotly.js"

export function prepareCurveTraces(
    data: WellRow[],
    depth: number[],
    configs: CurveConfig[],
    dict: any
  ): Data[] {
    const traces: Data[] = []
  
    configs.forEach(config => {
      if (config.type === 'single') {
        traces.push({
          type: 'scatter',
          mode: 'lines',
          x: data.map(r => r[config.column] ?? null),
          y: depth,
          name: config.name,
          line: {
            color: dict[config.column]?.curve_color
          },
          hovertemplate:
            `<b>${config.name}</b><br>` +
            `Значение: %{x}<br>` +
            `Глубина: %{y} м<extra></extra>`
        })
      }
  
      if (config.type === 'multi') {
        config.columns.forEach((col, i) => {
          traces.push({
            type: 'scatter',
            mode: 'lines',
            x: data.map(r => r[col] ?? null),
            y: depth,
            name: config.names[i],
            line: {
              color: dict[col]?.curve_color
            }
          })
        })
      }
    })
  
    return traces
  }
  
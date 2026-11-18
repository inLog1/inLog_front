import type { Layout } from "plotly.js"

export function prepareLayout(depthTicks: number[]): Partial<Layout> {
    return {
      height: 800,
      margin: { l: 80, r: 40, t: 40, b: 40 },
      hovermode: 'y unified',
      yaxis: {
        autorange: 'reversed',
        tickvals: depthTicks
      },
      xaxis: {
        domain: [0.05, 0.95]
      }
    }
  }
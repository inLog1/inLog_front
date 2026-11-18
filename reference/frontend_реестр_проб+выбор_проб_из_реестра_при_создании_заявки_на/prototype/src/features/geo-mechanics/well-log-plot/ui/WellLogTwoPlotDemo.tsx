import Plot from 'react-plotly.js'

export const WellLogPlotTwoTracksDemo = () => {
  const depth = Array.from({ length: 300 }, (_, i) => i)

  const curve1 = depth.map(d => Math.sin(d / 20) * 50 + 100)
  const curve2 = depth.map(d => Math.cos(d / 15) * 30 + 60)

  return (
    <Plot
      data={[
        // ───── ТРЕК 1 ─────
        {
          type: 'scatter',
          mode: 'lines',
          x: curve1,
          y: depth,
          name: 'GR',
          xaxis: 'x',
          yaxis: 'y',
          hovertemplate:
            '<b>GR</b><br>' +
            'Значение: %{x}<br>' +
            'Глубина: %{y} м<extra></extra>'
        },

        // ───── ТРЕК 2 ─────
        {
          type: 'scatter',
          mode: 'lines',
          x: curve2,
          y: depth,
          name: 'RES',
          xaxis: 'x2',
          yaxis: 'y',
          hovertemplate:
            '<b>RES</b><br>' +
            'Значение: %{x}<br>' +
            'Глубина: %{y} м<extra></extra>'
        }
      ]}
      layout={{
        height: 700,
        margin: { l: 80, r: 40, t: 60, b: 40 },
        hovermode: 'y unified',

        // ───── ОБЩАЯ ГЛУБИНА ─────
        yaxis: {
          autorange: 'reversed',
          title: { text: 'Глубина, м' }
        },

        // ───── ТРЕК 1 ─────
        xaxis: {
          domain: [0.05, 0.45],
          title: { text: 'GR' }
        },

        // ───── ТРЕК 2 ─────
        xaxis2: {
          domain: [0.55, 0.95],
          title: { text: 'RES' },
          matches: 'x' // важно для зума
        }
      }}
      config={{ responsive: true }}
    />
  )
}

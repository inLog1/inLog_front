import Plot from 'react-plotly.js'

export const WellLogPlotDemo = () => {
  const depth = Array.from({ length: 300 }, (_, i) => i)
  const curve = depth.map(d => Math.sin(d / 20) * 50 + 100)

  return (
    <Plot
      data={[
        {
          type: 'scatter',
          mode: 'lines',
          x: curve,
          y: depth,
          name: 'TEST CURVE', // ← ТОЛЬКО name
          hovertemplate:
            '<b>TEST CURVE</b><br>' +
            'Значение: %{x}<br>' +
            'Глубина: %{y} м<extra></extra>'
        }
      ]}
      layout={{
        height: 600,
        margin: { l: 80, r: 40, t: 40, b: 40 },
        yaxis: {
          autorange: 'reversed',
          title: { text: 'Глубина, м' } // ← title ТОЛЬКО объект
        },
        xaxis: {
          title: { text: 'Значение' }
        },
        hovermode: 'y unified'
      }}
      config={{ responsive: true }}
    />
  )
}

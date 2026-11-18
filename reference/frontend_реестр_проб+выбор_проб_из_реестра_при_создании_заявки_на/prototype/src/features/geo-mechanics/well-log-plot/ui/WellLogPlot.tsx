import Plot from 'react-plotly.js'
import { prepareLayout } from '../model/prepareLayout'
import { prepareLithology } from '../model/prepareLithology'
import type { CurveConfig, WellRow } from '../model/types'
import { prepareCurveTraces } from '../model/prepareCurves'

type Props = {
  data: WellRow[]
  curves: CurveConfig[]
  lithDict: Record<number, { color: string; name: string }>
}

export const WellLogPlot = ({ data, curves, lithDict }: Props) => {
  const depth = data.map(r => r.dept)

  const curveTraces = prepareCurveTraces(data, depth, curves, lithDict)
  const lithology = prepareLithology(data, lithDict)

  return (
    <Plot
      data={[...lithology, ...curveTraces]}
      layout={{
        ...prepareLayout(depth.filter((_, i) => i % 1000 === 0)),
      }}
      config={{ responsive: true, displayModeBar: false }}
    />
  )
}

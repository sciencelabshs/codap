import React, {MutableRefObject, useState} from "react"
import {range} from "d3"
import {useAxis} from "../hooks/use-axis"
import {useAxisLayoutContext} from "../models/axis-layout-context"
import {IAxisModel} from "../models/axis-model"
import {SubAxis} from "./sub-axis"

import "./axis.scss"

interface IProps {
  axisModel: IAxisModel
  label?: string
  enableAnimation: MutableRefObject<boolean>
  showScatterPlotGridLines?: boolean
  centerCategoryLabels?: boolean
}

export const Axis = ({
                       label, axisModel, showScatterPlotGridLines = false,
                       enableAnimation,
                       centerCategoryLabels = true,
                     }: IProps) => {
  const
    layout = useAxisLayoutContext(),
    place = axisModel?.place || 'bottom',
    [axisElt, setAxisElt] = useState<SVGGElement | null>(null)

  useAxis({
    axisModel, axisElt, axisTitle: label, centerCategoryLabels
  })

  const getSubAxes = () => {
    const numRepetitions = layout.getAxisMultiScale(place)?.repetitions ?? 1
    return range(numRepetitions).map(i => {
      return <SubAxis key={i}
                      numSubAxes={numRepetitions}
                      subAxisIndex={i}
                      axisModel={axisModel}
                      enableAnimation={enableAnimation}
                      showScatterPlotGridLines={showScatterPlotGridLines}
                      centerCategoryLabels={centerCategoryLabels}
      />
    })
  }

  return (
    <>
      <g className='axis' ref={elt => setAxisElt(elt)} data-testid={`axis-${place}`}>
        {getSubAxes()}
      </g>
    </>
  )
}

/**
 * Graph Custom Hooks
 */
import {extent} from "d3"
import {useEffect, useMemo} from "react"
import {IAttribute} from "../../../data-model/attribute"
import {INumericAxisModel} from "../models/axis-model"
import {ScaleBaseType, useGraphLayoutContext} from "../models/graph-layout"
import {InternalizedData} from "../graphing-types"
import {useDataSetContext} from "../../../hooks/use-data-set-context"
import {computeNiceNumericBounds} from "../utilities/graph_utils"

interface IDragHandlers {
  start: (event: MouseEvent) => void
  drag: (event: MouseEvent) => void
  end: (event: MouseEvent) => void
}

export const useDragHandlers = (target: any, {start, drag, end}: IDragHandlers) => {
  useEffect(() => {
    target.addEventListener('mousedown', start)
    target.addEventListener('mousemove', drag)
    target.addEventListener('mouseup', end)
    // On cleanup, remove event listeners
    return () => {
      target.removeEventListener('mousedown', start)
      target.removeEventListener('mousemove', drag)
      target.removeEventListener('mouseup', end)
    }
  }, [target, start, drag, end])
}

export interface IUseGetDataProps {
  xAxis: INumericAxisModel
  yAxis: INumericAxisModel
}

export const useGetData = (props: IUseGetDataProps) => {
  const {xAxis, yAxis} = props,
    dataset = useDataSetContext(),
    layout = useGraphLayoutContext(),
    xScale = layout.axisScale("bottom"),
    yScale = layout.axisScale("left")

  const result = useMemo(() => {
    let xAttrId = '', yAttrId = '', xName = '', yName = ''
    const data: InternalizedData = {
      xAttributeID: '',
      yAttributeID: '',
      cases: []
    }

    const findNumericAttrIds = (attrsToSearch: IAttribute[]) => {
        for (const iAttr of attrsToSearch) {
          if (iAttr.type === 'numeric') {
            if (xAttrId === '') {
              xAttrId = iAttr.id
            } else if (yAttrId === '') {
              yAttrId = iAttr.id
            } else {
              break
            }
          }
        }
      },

      setNiceDomain = (values: number[], scale: ScaleBaseType, axis: INumericAxisModel) => {
        const valueExtent = extent(values, d => d) as [number, number],
          niceBounds = computeNiceNumericBounds(valueExtent[0], valueExtent[1])
        scale.domain([niceBounds.min, niceBounds.max])
        const [min, max] = scale.domain()
        axis.setDomain(min, max)
      }

    if (dataset) {
      const
        attributes = dataset?.attributes

      findNumericAttrIds(attributes || [])
      if (xAttrId === '' || yAttrId === '') {
        return {xName, yName, data}
      }

      const xValues = dataset.attrFromID(xAttrId).numValues,
        yValues = dataset.attrFromID(yAttrId).numValues
      data.xAttributeID = xAttrId
      data.yAttributeID = yAttrId
      xName = dataset.attrFromID(data.xAttributeID)?.name || ''
      yName = dataset.attrFromID(data.yAttributeID)?.name || ''
      data.cases = dataset.cases.map(aCase => aCase.__id__)
        .filter(anID => {
          return isFinite(Number(dataset.getNumeric(anID, xAttrId))) &&
            isFinite(Number(dataset.getNumeric(anID, yAttrId)))
        })
      if (data.cases.length > 0) {
        setNiceDomain(xValues, xScale, xAxis)
        setNiceDomain(yValues, yScale, yAxis)
      }
    }
    return {xName, yName, data}
  }, [dataset, xAxis, xScale, yAxis, yScale])

  return result
}

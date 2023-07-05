import React from "react"
import { Box, Button, Checkbox, Flex, FormControl, useToast} from "@chakra-ui/react"
import t from "../../../../utilities/translation/translate"
import { ITileModel } from "../../../../models/tiles/tile-model"
import { isGraphModel } from "../../models/graph-model"
import { InspectorPalette } from "../../../inspector-panel"
import { MovableLineModel } from "../../adornments/adornment-models"
import { computeSlopeAndIntercept} from "../../utilities/graph-utils"
import { kMovableLineType } from "../../graphing-types"
import ValuesIcon from "../../../../assets/icons/icon-values.svg"

import "./point-format-panel.scss"

interface IProps {
  tile?: ITileModel
  panelRect?: DOMRect
  buttonRect?: DOMRect
  setShowPalette: (palette: string | undefined) => void
}

export const GraphMeasurePalette = ({tile, panelRect, buttonRect, setShowPalette}: IProps) => {
  const toast = useToast()
  const graphModel = isGraphModel(tile?.content) ? tile?.content : undefined

  const measures = {
    "casePlot": [ t("DG.Inspector.graphCount")],
    "dotChart": [ t("DG.Inspector.graphCount"),
                  t("DG.Inspector.graphPercent")],
    "dotPlot":  [ t("DG.Inspector.graphCount"),
                  t("DG.Inspector.showLabels"),
                  t("DG.Inspector.graphPlottedMean"),
                  t("DG.Inspector.graphPlottedMedian"),
                  t("DG.Inspector.graphPlottedStDev"),
                  t("DG.Inspector.graphPlottedMeanAbsDev"),
                  t("DG.Inspector.graphPlottedBoxPlot"),
                  t("DG.Inspector.graphBoxPlotShowOutliers"),
                  t("DG.Inspector.graphPlottedValue")
                ],
    "scatterPlot": [  t("DG.Inspector.graphCount"),
                      t("DG.Inspector.graphConnectingLine"),
                      t("DG.Inspector.graphMovablePoint"),
                      t("DG.Inspector.graphMovableLine"),
                      t("DG.Inspector.graphLSRL"),
                      t("DG.Inspector.graphInterceptLocked"),
                      t("DG.Inspector.graphPlottedFunction"),
                      t("DG.Inspector.graphPlottedValue"),
                      t("DG.Inspector.graphSquares"),
                    ]
  }

  const handleSetting = (measure: string, val: boolean) => {
    toast({
      title: 'Item clicked',
      description: `You clicked on ${measure} ${val}`,
      status: 'success',
      duration: 5000,
      isClosable: true,
    })
    if (val && graphModel) {
      let adornment = undefined
      // get the xAxis and yAxis from the graphModel
      const xAxis = graphModel.getAxis('bottom'),
        yAxis = graphModel.getAxis('left')
      const { intercept, slope } = computeSlopeAndIntercept(xAxis, yAxis)

      switch (measure) {
        // TODO: Handle other adornment types
        case kMovableLineType:
          adornment = MovableLineModel.create({
              type: measure
          })
          adornment.setLine({intercept, slope})
      }
      if (adornment) {
        graphModel?.addAdornment(adornment)
      }
    } else {
      graphModel?.removeAdornment(measure)
    }
  }

  return (
    <InspectorPalette
      title={t("DG.Inspector.values")}
      Icon={<ValuesIcon />}
      setShowPalette={setShowPalette}
      panelRect={panelRect}
      buttonRect={buttonRect}
    >
      <Flex className="palette-form" direction="column">
        <Box className="form-title">Show ...</Box>
        {graphModel && measures[graphModel.plotType].map((title:string) => {
           const isChecked = !!graphModel?.adornments?.find(a => a.type === title)
           const titleSlug = title.replace(/ /g, "-").toLowerCase()
           return (
            <FormControl key={title}>
              <Checkbox
                data-testid={`adornment-checkbox-${titleSlug}`}
                defaultChecked={isChecked}
                onChange={e => handleSetting(title, e.target.checked)}
              >
                {title}
              </Checkbox>
            </FormControl>
          )
        })}
        {graphModel?.plotType === "dotPlot" &&
          <Button size="xs" w="120px">Movable Value</Button>}
      </Flex>
    </InspectorPalette>
  )
}

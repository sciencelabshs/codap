import { Button, Select } from '@chakra-ui/react'
import { Active, DragOverlay, useDndContext, useDroppable } from "@dnd-kit/core"
import { observer } from "mobx-react-lite"
import React, { useState } from "react"
import { IAttribute } from "../data-model/attribute"
import { DataBroker } from "../data-model/data-broker"
import { getDragAttributeId, IDropData, IUseDraggableAttribute, useDraggableAttribute } from '../hooks/use-drag-drop'
import { prf } from "../utilities/profiler"
import { CodapV2Document } from '../v2/codap-v2-document'

import "./data-summary.scss"

interface IProps {
  broker?: DataBroker
  v2Document?: CodapV2Document
}
export const DataSummary = observer(({ broker, v2Document }: IProps) => {
  const data = broker?.selectedDataSet || broker?.last

  const { active } = useDndContext()
  const isSummaryDrag = active && `${active.id}`.startsWith("summary")
  const dragAttributeID = getDragAttributeId(active)
  const dragAttribute = dragAttributeID ? data?.attrFromID(dragAttributeID) : undefined

  // used to determine when a dragged attribute is over the summary component
  const { setNodeRef } = useDroppable({ id: "summary-component-drop", data: { accepts: ["attribute"] } })

  const [selectedAttribute, setSelectedAttribute] = useState<IAttribute | undefined>()

  const handleDrop = (attributeId: string) => {
    setSelectedAttribute(data?.attrFromID(attributeId))
  }

  const handleDataSetSelection = (evt: React.ChangeEvent<HTMLSelectElement>) => {
    broker?.setSelectedDataSetId(evt.target.value)
  }

  const DataSelectPopup = () => {
    const dataSetSummaries = broker?.summaries
    const renderOption = (name: string, id: string) => {
      return <option key={name} value={id}>{name}</option>
    }

    if (dataSetSummaries) {
      return (
        <Select onChange={handleDataSetSelection} value={data?.id}>
          { dataSetSummaries?.map(summary => {
              return renderOption(summary.name || `DataSet ${summary.id}`, summary.id)
            })
          }
        </Select>
      )
    }

    return null
  }

  const componentTypes = v2Document?.components.map(component => component.type)
  const componentList = componentTypes?.join(", ")

  return (
    <div ref={setNodeRef} className="data-summary">
      <p>{data ? `Parsed "${data.name}" with ${data.cases.length} case(s) and...` : "No data"}</p>
      {componentList &&
        <div className="data-components">
          <div className="data-components-title"><b>Components</b></div>
          <p>{componentList}</p>
        </div>
      }
      <div className="data-attributes">
        <div className="data-attributes-title"><b>Attributes</b></div>
        {data?.attributes.map(attr => (
          <DraggableAttribute key={attr.id} attribute={attr} />
        ))}
      </div>
      {data && <DataSelectPopup />}
      {data && <SummaryDropTarget attribute={selectedAttribute} onDrop={handleDrop}/>}
      {data && <ProfilerButton />}
      <DragOverlay dropAnimation={null}>
        {data && isSummaryDrag && dragAttribute
          ? <OverlayAttribute attribute={dragAttribute} />
          : null}
      </DragOverlay>
    </div>
  )
})

interface IDraggableAttributeProps {
  attribute: IAttribute
}
const DraggableAttribute = ({ attribute }: IDraggableAttributeProps) => {
  const draggableOptions: IUseDraggableAttribute = { prefix: "summary", attributeId: attribute.id }
  const { attributes, listeners, setNodeRef } = useDraggableAttribute(draggableOptions)
  return (
    <div ref={setNodeRef} className="draggable-attribute" {...attributes} {...listeners}>
      {attribute.name}
    </div>
  )
}
const OverlayAttribute = ({ attribute }: IDraggableAttributeProps) => {
  return (
    <div className={`draggable-attribute overlay`} >
      {attribute.name}
    </div>
  )
}

interface ISummaryDropTargetProps {
  attribute?: IAttribute
  onDrop?: (attributeId: string) => void
}
const SummaryDropTarget = ({ attribute, onDrop }: ISummaryDropTargetProps) => {
  const handleDrop = (active: Active) => {
    const dragAttributeID = getDragAttributeId(active)
    dragAttributeID && onDrop?.(dragAttributeID)
  }
  const data: IDropData = { accepts: ["attribute"], onDrop: handleDrop }
  const { isOver, setNodeRef } = useDroppable({ id: "summary-inspector-drop", data })
  return (
    <>
      <div ref={setNodeRef} className={`summary-inspector-drop ${isOver ? "over" : ""}`}>
        Attribute Inspector
      </div>
      {attribute &&
        <div className="summary-attribute-info">
          <p><b>{`${attribute.name}`}</b> is <i>{`${attribute.type}`}</i></p>
        </div>
      }
    </>
  )
}

const ProfilerButton = () => {
  const [isProfiling, setIsProfiling] = useState(prf.isProfiling)

  const handleClick = () => {
    if (prf.isProfiling) {
      prf.endProfiling()
      setIsProfiling(false)
      prf.report()
    }
    else {
      prf.clear()
      prf.beginProfiling()
      setIsProfiling(true)
    }
  }

  return (
    <Button className={`profiler-button`} onClick={handleClick} size="sm" >
      {isProfiling ? "Stop Profiling" : "Start Profiling"}
    </Button>
  )
}
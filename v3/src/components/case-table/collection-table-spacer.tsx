import { clsx } from "clsx"
import { observer } from "mobx-react-lite"
import React, { useMemo, useRef } from "react"
import { useCaseMetadata } from "../../hooks/use-case-metadata"
import { useCollectionContext, useParentCollectionContext } from "../../hooks/use-collection-context"
import { useDataSetContext } from "../../hooks/use-data-set-context"
import { getDragAttributeInfo, useTileDroppable } from "../../hooks/use-drag-drop"
import { measureText } from "../../hooks/use-measure-text"
import { IDataSet } from "../../models/data/data-set"
// import { getNumericCssVariable } from "../../utilities/css-utils"
import t from "../../utilities/translation/translate"
import { kChildMostTableCollectionId } from "./case-table-types"
import { useCollectionTableModel } from "./use-collection-table-model"
import { CurvedSpline } from "./curved-spline"

interface IProps {
  onDrop?: (dataSet: IDataSet, attrId: string) => void
}
export const CollectionTableSpacer = observer(function CollectionTableSpacer({ onDrop }: IProps) {
  const data = useDataSetContext()
  const caseMetadata = useCaseMetadata()
  const parentCollection = useParentCollectionContext()
  const parentCollectionId = parentCollection?.id
  const parentTableModel = useCollectionTableModel(parentCollectionId)
  const parentScrollTop = parentTableModel?.scrollTop ?? 0
  const childCollection = useCollectionContext()
  const childCollectionId = childCollection?.id || kChildMostTableCollectionId
  const childTableModel = useCollectionTableModel()
  const parentMost = !parentCollection
  const { active, isOver, setNodeRef } = useTileDroppable(`new-collection-${childCollectionId}`, _active => {
    const { dataSet, attributeId: dragAttributeID } = getDragAttributeInfo(_active) || {}
    dataSet && dragAttributeID && onDrop?.(dataSet, dragAttributeID)
  })

  const classes = clsx("collection-table-spacer", { active: !!getDragAttributeInfo(active), over: isOver, parentMost })
  const dropMessage = t("DG.CaseTableDropTarget.dropMessage")
  const dropMessageWidth = useMemo(() => measureText(dropMessage, "12px sans-serif"), [dropMessage])
  const tableSpacerDivRef = useRef<HTMLElement | null>(null)
  const divHeight = tableSpacerDivRef.current?.getBoundingClientRect().height
  const kMargin = 10
  const msgStyle: React.CSSProperties =
    { bottom: divHeight && dropMessageWidth ? (divHeight - dropMessageWidth) / 2 - kMargin : undefined }
  const parentCases = parentCollection ? data?.getCasesForCollection(parentCollection.id) : []
  const indexRanges = childTableModel?.parentIndexRanges

  const handleRef = (element: HTMLElement | null) => {
    tableSpacerDivRef.current = element
    setNodeRef(element)
  }

  if (!data || !parentCases) return null

  const everyCaseIsCollapsed = parentCases.every((value) => caseMetadata?.isCollapsed(value.__id__))

  // Keep for now in case of accessibility application (wider area of input)
  // function handleAreaClick(e: React.MouseEvent) {
  //   const parentGridBounds = parentGridRef.current?.getBoundingClientRect()
  //   const rowHeaderHeight = getNumericCssVariable(parentGridRef.current, "--rdg-header-row-height") ?? 30
  //   const rowHeight = getNumericCssVariable(parentGridRef.current, "--rdg-row-height") ?? 18
  //   // TODO: real buttons; handle scrolled table
  //   const clickedRow = Math.floor((e.clientY - (parentGridBounds?.top ?? 0) - rowHeaderHeight) / rowHeight)
  //   const cases = data && parentCollection ? data?.getCasesForCollection(parentCollection.id) : []
  //   const clickedCase = cases[clickedRow]
  //   if (caseMetadata && clickedCase) {
  //     const isCollapsed = caseMetadata.isCollapsed(clickedCase.__id__)
  //     caseMetadata.setIsCollapsed(clickedCase.__id__, !isCollapsed)
  //   }
  // }

  function handleTopClick() {
    parentCases?.forEach((value) => caseMetadata?.setIsCollapsed(value.__id__, !everyCaseIsCollapsed))
  }

  const topTooltipKey = `DG.CaseTable.dividerView.${everyCaseIsCollapsed ? 'expandAllTooltip' : 'collapseAllTooltip'}`
  const topButtonTooltip = t(topTooltipKey)

  return (
    <div className={classes} ref={handleRef}>
      {parentCollectionId && parentTableModel && childTableModel &&
        <>
          <div className="spacer-top">
            {<ExpandCollapseButton isCollapsed={everyCaseIsCollapsed || false} onClick={handleTopClick}
              title={topButtonTooltip} />}
          </div>
          <div className="spacer-mid">
            <svg className="spacer-mid-layer lower-layer">
              {indexRanges?.map(({ id: parentCaseId, firstChildIndex, lastChildIndex }, index) => {
                return <CurvedSpline key={`${parentCaseId}-${index}`}
                                      prevY1={parentTableModel.getTopOfRowModuloScroll(index)}
                                      y1={parentTableModel.getBottomOfRowModuloScroll(index)}
                                      prevY2={childTableModel.getTopOfRowModuloScroll(firstChildIndex)}
                                      y2={childTableModel.getBottomOfRowModuloScroll(lastChildIndex)}
                                      even={(index + 1) % 2 === 0}
                        />
              })}
            </svg>
            <div className="spacer-mid-layer">
              {parentCases?.map((value, index) => (
                <ExpandCollapseButton key={value.__id__} isCollapsed={!!caseMetadata?.isCollapsed(value.__id__)}
                  onClick={() => caseMetadata?.setIsCollapsed(value.__id__, !caseMetadata?.isCollapsed(value.__id__))}
                  styles={{ left: '3px', top: `${((index * childTableModel.rowHeight) - parentScrollTop) + 4}px`}}
                />
              ))}
            </div>
          </div>
        </>
      }

      <div className="drop-message" style={msgStyle}>{isOver ? dropMessage : ""}</div>
    </div>
  )
})

interface ExpandCollapseButtonProps {
  isCollapsed: boolean,
  onClick: () => void,
  styles?: {
    left?: string,
    top?: string,
  },
  title?: string,
}

function ExpandCollapseButton({ isCollapsed, onClick, styles, title }: ExpandCollapseButtonProps) {
  const tooltipKey = `DG.CaseTable.dividerView.${isCollapsed ? "expandGroupTooltip" : "collapseGroupTooltip"}`
  const tooltip = title ?? t(tooltipKey)
  return (
    <button type="button" className="expand-collapse-button" onClick={onClick} style={styles}>
      <img className={`expand-collapse-image ${isCollapsed ? 'closed' : 'open'}`} title={tooltip} />
    </button>
  )
}

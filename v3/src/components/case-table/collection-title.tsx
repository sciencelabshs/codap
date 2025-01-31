import React, { useEffect, useRef, useState } from "react"
import { useDndContext } from "@dnd-kit/core"
import { Button, Editable, EditableInput, EditablePreview } from "@chakra-ui/react"
import throttle from "lodash/throttle"
import {useResizeDetector} from "react-resize-detector"
import { observer } from "mobx-react-lite"
import { clsx } from "clsx"
import pluralize from "pluralize"
import { uniqueName } from "../../utilities/js-utils"
import { useDataSetContext } from "../../hooks/use-data-set-context"
import { useCollectionContext } from "../../hooks/use-collection-context"
import { getCollectionAttrs } from "../../models/data/data-set-utils"
import t from "../../utilities/translation/translate"
import AddIcon from "../../assets/icons/icon-add-circle.svg"
import { useTileModelContext } from "../../hooks/use-tile-model-context"

export const CollectionTitle = observer(function CollectionTitle() {
  const data = useDataSetContext()
  const collection = useCollectionContext()
  const { isTileSelected } = useTileModelContext()
  const { setTitle, displayTitle } = collection
  const defaultName = pluralize((getCollectionAttrs(collection, data)[0]?.name) ?? '')
  const caseCount = data?.getCasesForCollection(collection?.id).length ?? 0
  const tileRef = useRef<HTMLDivElement | null>(null)
  const contentRef = useRef<HTMLDivElement | null>(null)
  const titleRef = useRef<HTMLDivElement>(null)
  const title = displayTitle || defaultName
  // used to trigger a render
  const [ , setTableScrollLeft] = useState(0)
  const { active } = useDndContext()
  const dragging = !!active
  const [isEditing, setIsEditing] = useState(false)
  const isTileInFocus = isTileSelected()

  // re-render the component when either the tile or the title change size
  useResizeDetector({ targetRef: tileRef })
  useResizeDetector({ targetRef: titleRef })

  useEffect(() => {
    // these parents exist for the lifetime of the component
    tileRef.current = titleRef.current?.closest(".codap-component") ?? null
    contentRef.current = titleRef.current?.closest(".case-table-content") ?? null

    const updateScrollPosition = throttle((e: Event) => {
      if (e.currentTarget != null) {
        setTableScrollLeft((e.currentTarget as HTMLDivElement).scrollLeft)
      }
    }, 15)

    const contentElt = contentRef.current
    contentElt?.addEventListener("scroll", updateScrollPosition)
    return () => {
      contentElt?.removeEventListener("scroll", updateScrollPosition)
    }
  }, [])

  const tileRect = tileRef.current?.getBoundingClientRect()
  const titleRect = titleRef.current?.getBoundingClientRect()
  const titleStyle: React.CSSProperties = { left: 0, right: 0 }
  const addIconStyle: React.CSSProperties = { right: 0 }

  if (tileRect && titleRect) {
    const deltaLeft = titleRect.left - tileRect.left
    const deltaRight = titleRect.right - tileRect.right
    if (deltaLeft < 0) {
      titleStyle.left = -deltaLeft + 6
    }
    if (deltaRight > 0) {
      titleStyle.right = deltaRight
      addIconStyle.right = deltaRight
    }
  }

  const handleChangeTitle = (nextValue?: string) => {
    if (nextValue) {
      setTitle(nextValue)
    }
  }

  const handleAddNewAttribute = () => {
    const newAttrName = uniqueName("newAttr",
      (aName: string) => !data?.attributes.find(attr => aName === attr.name)
     )
    data?.addAttribute({ name: newAttrName }, { collection: collection.id })
  }

  const casesStr = t(caseCount === 1 ? "DG.DataContext.singleCaseName" : "DG.DataContext.pluralCaseName")
  const addIconClass = clsx("add-icon", { focused: isTileInFocus })

  return (
    <div className="collection-title-wrapper" ref={titleRef}>
      <div className="collection-title" style={titleStyle}>
        <Editable value={isEditing ? title : `${title} (${caseCount} ${casesStr})`}
            onEdit={() => setIsEditing(true)} onSubmit={() => setIsEditing(false)} onCancel={() => setIsEditing(false)}
            isPreviewFocusable={!dragging} submitOnBlur={true} onChange={handleChangeTitle}>
          <EditablePreview paddingY={0} />
          <EditableInput value={title} paddingY={0} className="collection-title-input" />
        </Editable>
      </div>
      <Button className="add-attribute-icon-button" title={t("DG.TableController.newAttributeTooltip")}
          data-testid={"collection-add-attribute-icon-button"} style={addIconStyle} >
        <AddIcon className={addIconClass} onClick={handleAddNewAttribute} />
      </Button>
    </div>
  )
})

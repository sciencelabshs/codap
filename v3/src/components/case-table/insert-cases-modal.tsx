import React, { useRef, useState } from "react"
import { Button, FormControl, FormLabel, HStack, ModalBody, ModalCloseButton, ModalFooter, ModalHeader,
  NumberDecrementStepper, NumberIncrementStepper, NumberInput,
  NumberInputField, NumberInputStepper, Radio, RadioGroup, Tooltip } from "@chakra-ui/react"
import t from "../../utilities/translation/translate"
import { CodapModal } from "../codap-modal"
import { useDataSetContext } from "../../hooks/use-data-set-context"

interface IProps {
  caseId: string
  isOpen: boolean
  onClose: () => void
}

export const InsertCasesModal: React.FC<IProps> =
  ({caseId, isOpen, onClose}: IProps) => {
  const initialRef = useRef(null)
  const data = useDataSetContext()
  const [numCasesToInsert, setNumCasesToInsert] = useState(1)
  const [insertPosition, setInsertPosition] = useState("after")

  const handleInsertPositionChange = (value: any) => {
    setInsertPosition(value)
  }

  const handleNumCasesToInsertChange = (value: string) => {
    setNumCasesToInsert(parseInt(value, 10))
  }

  const insertCases = () => {
    onClose()
    const casesToAdd = []
    if (numCasesToInsert) {
      for (let i=0; i < numCasesToInsert; i++) {
        casesToAdd.push({})
      }
    }
    data?.addCases(casesToAdd, {[insertPosition]: caseId})
  }

  const buttons=[{  label: t("DG.AttrFormView.cancelBtnTitle"),
                    tooltip: t("DG.AttrFormView.cancelBtnTooltip"),
                    onClick: onClose },
                 {  label: t("DG.CaseTable.insertCasesDialog.applyBtnTitle"),
                    tooltip: t("DG.CaseTable.insertCasesDialog.applyBtnTooltip"),
                    onClick: insertCases }
                ]

  return (
    <CodapModal
      isOpen={isOpen}
      onClose={onClose}
      modalWidth={"280px"}
    >
      <ModalHeader h="30" className="codap-modal-header" fontSize="md" data-testid="codap-modal-header">
        <div className="codap-modal-icon-container" />
        <div className="codap-header-title">{t("DG.CaseTable.insertCasesDialog.title")}</div>
        <ModalCloseButton onClick={onClose} data-testid="modal-close-button"/>
      </ModalHeader>
      <ModalBody>
        <FormControl display="flex" flexDirection="column">
          <FormLabel h="20px" display="flex" flexDirection="row" alignItems="center">
            {t("DG.CaseTable.insertCasesDialog.numCasesPrompt")}
            <NumberInput size="xs" w="80px" min={0} ml={5} defaultValue={1} data-testid="num-case-input"
                        value={numCasesToInsert} onFocus={(e) => e.target.select()}
                        onChange={value => handleNumCasesToInsertChange(value)}>
              <NumberInputField ref={initialRef} placeholder="0" />
              <NumberInputStepper>
                <NumberIncrementStepper data-testid="num-case-input-increment-up"/>
                <NumberDecrementStepper data-testid="num-case-input-incement-down"/>
              </NumberInputStepper>
            </NumberInput>
          </FormLabel>
          <FormLabel display="flex" flexDirection="row">{t("DG.CaseTable.insertCasesDialog.beforeAfter.prompt")}
            <RadioGroup onChange={value => handleInsertPositionChange(value)} value={insertPosition} ml={5}>
              <HStack>
                <Radio value="before" data-testid="add-before">
                  {t("DG.CaseTable.insertCasesDialog.beforeAfter.before")}
                </Radio>
                <Radio value="after" data-testid="add-after">
                  {t("DG.CaseTable.insertCasesDialog.beforeAfter.after")}
                </Radio>
              </HStack>
            </RadioGroup>
          </FormLabel>
        </FormControl>
      </ModalBody>
      <ModalFooter mt="-5">
        {buttons.map((b: any, i)=>{
          const key = `${i}-${b.className}`
          return (
            <Tooltip key={key} label={b.tooltip} h="20px" fontSize="12px"
              color="white" openDelay={1000} placement="bottom" bottom="15px" left="15px"
              data-testid="modal-tooltip">
              <Button key={key} size="xs" variant="ghost" ml="5" onClick={b.onClick} data-testid={`${b.label}-button`}>
                {b.label}
              </Button>
            </Tooltip>
          )
        })}
      </ModalFooter>
    </CodapModal>
  )
}

import { CalculatorTileElements as calc } from "../support/elements/calculator-tile"
import { ComponentElements as c } from "../support/elements/component-elements"

const calculatorName = "Calculator"

context("Data summary UI", () => {
  beforeEach(function () {
      const queryParams = "?sample=mammals&dashboard&mouseSensor"
      const url = `${Cypress.config("index")}${queryParams}`
      cy.visit(url)
      cy.wait(2500)
  })
  it("populates default title", () => {
    c.getComponentTitle("calculator").should("contain", calculatorName)
  })
  it("updates calculator title", () => {
    const newCalculatorName = "my calc"
    c.getComponentTitle("calculator").should("have.text", calculatorName)
    c.changeComponentTitle("calculator", newCalculatorName)
    c.getComponentTitle("calculator").should("have.text", newCalculatorName)
  })
  it("close calculator from toolshelf", () => {
    const newCalculatorName = "my calc"
    c.getComponentTitle("calculator").should("contain", calculatorName)
    c.changeComponentTitle("calculator", newCalculatorName)
    c.getComponentTitle("calculator").should("have.text", newCalculatorName)

    c.createFromToolshelf("calculator")
    c.checkComponentDoesNotExist("calculator")

    c.createFromToolshelf("calculator")
    c.checkComponentExists("calculator")
    c.getComponentTitle("calculator").should("contain", calculatorName)
  })
  it("close calculator from close button", () => {
    const newCalculatorName = "my calc"
    c.getComponentTitle("calculator").should("contain", calculatorName)
    c.changeComponentTitle("calculator", newCalculatorName)
    c.getComponentTitle("calculator").should("have.text", newCalculatorName)

    c.closeComponent("calculator")
    c.checkComponentDoesNotExist("calculator")

    c.createFromToolshelf("calculator")
    c.checkComponentExists("calculator")
    c.getComponentTitle("calculator").should("contain", calculatorName)
  })
  it("checks all calculator tooltips", () => {
    c.selectTile("calculator")
    c.getToolShelfIcon("calculator").then($element => {
      c.checkToolTip($element, c.tooltips.calculatorToolShelfIcon)
    })
    c.getMinimizeButton("calculator").then($element => {
      c.checkToolTip($element, c.tooltips.minimizeComponent)
    })
    c.getCloseButton("calculator").then($element => {
      c.checkToolTip($element, c.tooltips.closeComponent)
    })
  })
  it("can make calculations", () => {
    calc.enterExpression("12X(1+2)=")
    calc.checkCalculatorDisplay("36")
  })
})

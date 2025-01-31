import { IAttribute } from "../models/data/attribute"
import { CollectionModel } from "../models/data/collection"
import { IDataSet, toCanonical } from "../models/data/data-set"
import { ISharedCaseMetadata, SharedCaseMetadata } from "../models/shared/shared-case-metadata"
import { ISharedDataSet, SharedDataSet } from "../models/shared/shared-data-set"
import {
  CodapV2Component, ICodapV2Attribute, ICodapV2Case, ICodapV2Collection, ICodapV2DataContext, ICodapV2DocumentJson,
  isCodapV2Attribute, isV2TableComponent
} from "./codap-v2-types"

export class CodapV2Document {
  private document: ICodapV2DocumentJson
  private guidMap: Record<number, { type: string, object: any }> = {}
  private dataMap: Record<number, ISharedDataSet> = {}
  private v3AttrMap: Record<number, IAttribute> = {}
  private metadataMap: Record<number, ISharedCaseMetadata> = {}

  constructor(document: ICodapV2DocumentJson) {
    this.document = document

    // register the document
    this.guidMap[document.guid] = { type: "DG.Document", object: document }

    this.registerContexts(document.contexts)
    this.registerComponents(document.components)
  }

  get contexts() {
    return this.document.contexts
  }

  get components() {
    return this.document.components
  }

  get globalValues() {
    return this.document.globalValues
  }

  get datasets() {
    return Object.values(this.dataMap)
  }

  get metadata() {
    return Object.values(this.metadataMap)
  }

  getDataAndMetadata(v2Id: number) {
    return { data: this.dataMap[v2Id], metadata: this.metadataMap[v2Id] }
  }

  getParentCase(aCase: ICodapV2Case) {
    const parentCaseId = aCase.parent
    return parentCaseId != null ? this.guidMap[parentCaseId]?.object as ICodapV2Case: undefined
  }

  getV2Attribute(v2Id: number) {
    return this.guidMap[v2Id]
  }

  getV3Attribute(v2Id: number) {
    return this.v3AttrMap[v2Id]
  }

  registerComponents(components?: CodapV2Component[]) {
    components?.forEach(component => {
      const { guid, type } = component
      this.guidMap[guid] = { type, object: component }

      // extract table metadata (e.g. column widths)
      if (isV2TableComponent(component)) {
        const { _links_, attributeWidths } = component.componentStorage
        const data = this.dataMap[_links_.context.id].dataSet
        const metadata = this.metadataMap[_links_.context.id]
        attributeWidths?.forEach(entry => {
          const v2Attr = this.guidMap[entry._links_.attr.id]
          if (isCodapV2Attribute(v2Attr)) {
            const attrId = data.attrIDFromName(v2Attr.name)
            if (attrId && entry.width) {
              metadata.setColumnWidth(attrId, entry.width)
            }
          }
        })
      }
    })
  }

  registerContexts(contexts?: ICodapV2DataContext[]) {
    contexts?.forEach(context => {
      const { guid, type = "DG.DataContext", document, name = "", collections = [] } = context
      if (document && this.guidMap[document]?.type !== "DG.Document") {
        console.warn("CodapV2Document.registerContexts: context with invalid document guid:", context.document)
      }
      this.guidMap[guid] = { type, object: context }
      const sharedDataSet = SharedDataSet.create({ dataSet: { name } })
      this.dataMap[guid] = sharedDataSet
      this.metadataMap[guid] = SharedCaseMetadata.create({ data: this.dataMap[guid].id })

      this.registerCollections(sharedDataSet.dataSet, collections)
    })
  }

  registerCollections(data: IDataSet, collections: ICodapV2Collection[]) {
    collections.forEach((collection, index) => {
      const { attrs = [], cases = [], guid, name = "", title = "", type = "DG.Collection" } = collection
      this.guidMap[guid] = { type, object: collection }

      // assumes hierarchical collection are in order parent => child
      const level = collections.length - index - 1  // 0 === child-most
      this.registerAttributes(data, attrs, level)
      this.registerCases(data, cases, level)

      if (level > 0) {
        const collectionModel = CollectionModel.create({ name, title })
        attrs.forEach(attr => {
          const attrModel = data.attrFromName(attr.name)
          attrModel && collectionModel.addAttribute(attrModel)
        })
        data.addCollection(collectionModel)
      }
      else {
        data.ungrouped.setName(name)
        data.ungrouped.setTitle(title)
      }
    })
  }

  registerAttributes(data: IDataSet, attributes: ICodapV2Attribute[], level: number) {
    attributes.forEach(attr => {
      const { guid, name = "", title = "", type, formula: _formula } = attr
      const formula = _formula ? { display: _formula } : undefined
      this.guidMap[guid] = { type: type || "DG.Attribute", object: attr }
      this.v3AttrMap[guid] = data.addAttribute({ name, ...formula, title })
    })
  }

  registerCases(data: IDataSet, cases: ICodapV2Case[], level: number) {
    cases.forEach(_case => {
      const { guid, values } = _case
      this.guidMap[guid] = { type: "DG.Case", object: _case }
      // only add child/leaf cases
      if (level === 0) {
        let caseValues = toCanonical(data, values)
        // look up parent case attributes and add them to caseValues
        for (let parentCase = this.getParentCase(_case); parentCase; parentCase = this.getParentCase(parentCase)) {
          caseValues = { ...(parentCase.values ? toCanonical(data, parentCase.values) : undefined), ...caseValues }
        }
        data.addCases([caseValues])
      }
    })
  }
}

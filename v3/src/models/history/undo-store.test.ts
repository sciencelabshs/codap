import { cloneDeep } from "lodash"
import { flow, getSnapshot, getType, Instance, types } from "mobx-state-tree"
import { nanoid } from "nanoid"
import { SharedModel, ISharedModel } from "../shared/shared-model"
import { registerSharedModelInfo } from "../shared/shared-model-registry"
import { TileContentModel } from "../tiles/tile-content"
import { registerTileComponentInfo } from "../tiles/tile-component-info"
import { registerTileContentInfo } from "../tiles/tile-content-info"
import { DocumentContentModel, IDocumentContentSnapshotIn } from "../document/document-content"
import { createDocumentModel } from "../document/create-document-model"
import { when } from "mobx"
import { CDocument, TreeManager } from "./tree-manager"
import { HistoryEntrySnapshot } from "./history"
import { withoutUndo } from "./without-undo"

// way to get a writable reference to libDebug
const libDebug = require("../../lib/debug")

function wait(millis: number) {
  return new Promise(resolve => setTimeout(resolve, millis))
}

const TestSharedModel = SharedModel
  .named("TestSharedModel")
  .props({
    type: "TestSharedModel",
    value: types.maybe(types.string)
  })
  .actions(self => ({
    setValue(value: string) {
      self.value = value
    }
  }))
interface TestSharedModelType extends Instance<typeof TestSharedModel> {}

registerSharedModelInfo({
  type: "TestSharedModel",
  modelClass: TestSharedModel
})

const TestTileChild = types.model("TestTileChild", {
  value: types.string
})
.actions(self => ({
  setValue(_value: string) { self.value = _value },
  setValueWithoutUndo(_value: string) {
    withoutUndo()
    self.value = _value
  }
}))

const TestTile = TileContentModel
  .named("TestTile")
  .props({
    type: "TestTile",
    text: types.maybe(types.string),
    flag: types.maybe(types.boolean),
    counter: 0,
    child: types.maybe(TestTileChild)
  })
  .volatile(self => ({
    updateCount: 0
  }))
  .views(self => ({
    get sharedModel() {
      const sharedModelManager = self.tileEnv?.sharedModelManager
      const firstSharedModel = sharedModelManager?.getTileSharedModels(self)?.[0]
      if (!firstSharedModel || getType(firstSharedModel) !== TestSharedModel) {
        return undefined
      }
      return firstSharedModel as TestSharedModelType
    },
  }))
  .actions(self => ({
    updateAfterSharedModelChanges(sharedModel?: ISharedModel) {
      self.updateCount++
      const sharedModelValue = self.sharedModel?.value
      self.text = sharedModelValue ? `${sharedModelValue}-tile` : undefined
    },
    setFlag(_flag: boolean) {
      self.flag = _flag
    },
    setFlagWithoutUndo(_flag: boolean) {
      withoutUndo()
      self.flag = _flag
    },
    updateCounterAsync: flow(function *updateCounterAsync() {
      self.counter += 1
      // eslint-disable-next-line testing-library/await-async-utils
      yield wait(50) // intermittent failures with shorter waits
      self.counter += 1
    }),
    updateCounterWithoutUndoAsync: flow(function *updateCounterWithoutUndoAsync() {
      withoutUndo()
      self.counter += 1
      // eslint-disable-next-line testing-library/await-async-utils
      yield wait(50) // intermittent failures with shorter waits
      self.counter += 1
    }),
    setChildValue(_value: string) {
      self.child?.setValueWithoutUndo(_value)
    }
  }))
interface TestTileType extends Instance<typeof TestTile> {}

const TestTileComponent: React.FC<any> = () => {
  throw new Error("Component not implemented.")
}
const TestTileTitleBarComponent: React.FC<any> = () => {
  throw new Error("Component not implemented.")
}

registerTileContentInfo({
  type: "TestTile",
  prefix: "TEST",
  modelClass: TestTile,
  defaultContent(options) {
    return TestTile.create()
  }
})
registerTileComponentInfo({
  type: "TestTile",
  TitleBar: TestTileTitleBarComponent,
  Component: TestTileComponent,
  tileEltClass: "test-tile"
})

const defaultDocumentContent = {
  sharedModelMap: {
    "sm1": {
      sharedModel: {
        id: "sm1",
        type: "TestSharedModel"
      },
      tiles: [ "t1" ]
    }
  },
  tileMap: {
    "t1": {
      id: "t1",
      content: {
        type: "TestTile"
      },
    }
  }
}

function setupDocument(initialContent? : IDocumentContentSnapshotIn) {
  const docContentSnapshot = initialContent || defaultDocumentContent
  const docContent = DocumentContentModel.create(docContentSnapshot)

  // This is needed to setup the tree monitor and shared model manager
  const docModel = createDocumentModel({
    type: "Test",
    key: "test",
    content: docContent as any
  })

  // Enable the tree monitor so the events will be recorded
  docModel.treeMonitor!.enabled = true

  const sharedModel = docContent.sharedModelMap.get("sm1")?.sharedModel as TestSharedModelType
  const tileContent = docContent.tileMap.get("t1")?.content as TestTileType
  const manager = docModel.treeManagerAPI as Instance<typeof TreeManager>
  const undoStore = manager.undoStore

  return {docModel, docContent, sharedModel, tileContent, manager, undoStore}
}

const setFlagTrueEntry = {
  action: "/content/tileMap/t1/content/setFlag",
  created: expect.any(Number),
  id: expect.any(String),
  records: [
    { action: "/content/tileMap/t1/content/setFlag",
      inversePatches: [
        { op: "replace", path: "/content/tileMap/t1/content/flag", value: undefined}
      ],
      patches: [
        { op: "replace", path: "/content/tileMap/t1/content/flag", value: true}
      ],
      tree: "test"
    },
  ],
  state: "complete",
  tree: "test",
  undoable: true
}

it("records a tile change as one history event with one TreeRecordEntry", async () => {
  const {tileContent, manager} = setupDocument()
  // This should record a history entry with this change and any changes to tiles
  // triggered by this change
  tileContent.setFlag(true)

  await expectEntryToBeComplete(manager, 1)
  const changeDocument = manager.document

  expect(getSnapshot(changeDocument.history)).toEqual([
    setFlagTrueEntry
  ])
})

const undoEntry = {
  action: "undo",
  created: expect.any(Number),
  id: expect.any(String),
  records: [
    { action: "/applyPatchesFromManager",
      inversePatches: [
        { op: "replace", path: "/content/tileMap/t1/content/flag", value: true}
      ],
      patches: [
        { op: "replace", path: "/content/tileMap/t1/content/flag", value: undefined}
      ],
      tree: "test"
    },
  ],
  state: "complete",
  tree: "manager",
  undoable: false
}

it("can undo a tile change", async () => {
  const {tileContent, manager, undoStore} = setupDocument()
  // This should record a history entry with this change and any changes to tiles
  // triggered by this change
  tileContent.setFlag(true)

  // Make sure this entry is recorded before undoing it
  await expectEntryToBeComplete(manager, 1)

  undoStore.undo()
  await expectEntryToBeComplete(manager, 2)

  expect(tileContent.flag).toBeUndefined()

  const changeDocument = manager.document
  expect(getSnapshot(changeDocument.history)).toEqual([
    setFlagTrueEntry,
    undoEntry
  ])
})

const redoEntry = {
  action: "redo",
  created: expect.any(Number),
  id: expect.any(String),
  records: [
    { action: "/applyPatchesFromManager",
      inversePatches: [
        { op: "replace", path: "/content/tileMap/t1/content/flag", value: undefined}
      ],
      patches: [
        { op: "replace", path: "/content/tileMap/t1/content/flag", value: true}
      ],
      tree: "test"
    },
  ],
  state: "complete",
  tree: "manager",
  undoable: false
}

it("can redo a tile change", async () => {
  const {tileContent, manager, undoStore} = setupDocument()
  // This should record a history entry with this change and any changes to tiles
  // triggered by this change
  tileContent.setFlag(true)

  // Make sure this entry is recorded before undoing it
  await expectEntryToBeComplete(manager, 1)

  undoStore.undo()
  await expectEntryToBeComplete(manager, 2)

  expect(tileContent.flag).toBeUndefined()

  undoStore.redo()
  await expectEntryToBeComplete(manager, 3)

  expect(tileContent.flag).toBe(true)

  const changeDocument = manager.document
  expect(getSnapshot(changeDocument.history)).toEqual([
    setFlagTrueEntry,
    undoEntry,
    redoEntry
  ])
})


it("records a async tile change as one history event with one TreeRecordEntry", async () => {
  const {tileContent, manager} = setupDocument()
  // This should record a history entry with this change and any changes to tiles
  // triggered by this change
  await tileContent.updateCounterAsync()

  await expectEntryToBeComplete(manager, 1)
  const changeDocument = manager.document

  expect(getSnapshot(changeDocument.history)).toEqual([
    {
      action: "/content/tileMap/t1/content/updateCounterAsync",
      created: expect.any(Number),
      id: expect.any(String),
      records: [
        { action: "/content/tileMap/t1/content/updateCounterAsync",
          inversePatches: [
            { op: "replace", path: "/content/tileMap/t1/content/counter", value: 0},
            { op: "replace", path: "/content/tileMap/t1/content/counter", value: 1}
          ],
          patches: [
            { op: "replace", path: "/content/tileMap/t1/content/counter", value: 1},
            { op: "replace", path: "/content/tileMap/t1/content/counter", value: 2}
          ],
          tree: "test"
        },
      ],
      state: "complete",
      tree: "test",
      undoable: true
    }
  ])
})

it("records an async tile change and an interleaved history event with 2 entries", async () => {
  const {tileContent, manager} = setupDocument()
  // This should record a history entry with this change and any changes to tiles
  // triggered by this change
  const updateCounterPromise = tileContent.updateCounterAsync()
  await wait(1)
  tileContent.setFlag(true)

  await updateCounterPromise

  await expectEntryToBeComplete(manager, 2)
  const changeDocument = manager.document

  expect(getSnapshot(changeDocument.history)).toEqual([
    setFlagTrueEntry,
    {
      action: "/content/tileMap/t1/content/updateCounterAsync",
      created: expect.any(Number),
      id: expect.any(String),
      records: [
        { action: "/content/tileMap/t1/content/updateCounterAsync",
          inversePatches: [
            { op: "replace", path: "/content/tileMap/t1/content/counter", value: 0},
            { op: "replace", path: "/content/tileMap/t1/content/counter", value: 1}
          ],
          patches: [
            { op: "replace", path: "/content/tileMap/t1/content/counter", value: 1},
            { op: "replace", path: "/content/tileMap/t1/content/counter", value: 2}
          ],
          tree: "test"
        },
      ],
      state: "complete",
      tree: "test",
      undoable: true
    }
  ])
})

it("can skip adding an action to the undo list", async () => {
  const {tileContent, manager, undoStore} = setupDocument()
  // This should record a history entry with this change and any changes to tiles
  // triggered by this change
  tileContent.setFlagWithoutUndo(true)

  // Make sure this entry is recorded before undoing it
  await expectEntryToBeComplete(manager, 1)

  expect(undoStore.canUndo).toBe(false)

  expect(tileContent.flag).toBe(true)

  const changeDocument = manager.document
  expect(getSnapshot(changeDocument.history)).toEqual([
    // override the action name of the initialUpdateEntry
    {
      ...setFlagTrueEntry,
      action: "/content/tileMap/t1/content/setFlagWithoutUndo",
      undoable: false,
      records: [{
        ...setFlagTrueEntry.records[0],
        action: "/content/tileMap/t1/content/setFlagWithoutUndo",
      }]
    }
  ])
})

it("can handle withoutUndo even when tree isn't monitored", async () => {
  const {tileContent, manager, undoStore, docModel} = setupDocument()

  // disable the monitor
  docModel.treeMonitor!.enabled = false

  // Because the monitor is disabled this won't record an entry,
  // and the withoutUndo should basically be ignored
  jestSpyConsole("warn", spy => {
    tileContent.setFlagWithoutUndo(true)
    expect(spy).not.toHaveBeenCalled()
  })

  // We can't undo because nothing was recorded
  expect(undoStore.canUndo).toBe(false)

  expect(tileContent.flag).toBe(true)

  const changeDocument = manager.document
  expect(getSnapshot(changeDocument.history)).toEqual([])
})

it("does not warn about withoutUndo when tree isn't monitored and DEBUG_UNDO is on", async () => {
  const {tileContent, docModel} = setupDocument()

  // disable the monitor
  docModel.treeMonitor!.enabled = false

  libDebug.DEBUG_UNDO = true

  // Because the monitor is disabled this won't record an entry,
  // and the withoutUndo should basically be ignored
  jestSpyConsole("warn", spy => {
    tileContent.setFlagWithoutUndo(true)
    expect(spy).not.toHaveBeenCalled()
  })

  libDebug.DEBUG_UNDO = false
})

it("does not warn about withoutUndo if tile is not in a tree and DEBUG_UNDO is on", async () => {

  // This type of case can happen when a tile is added to the authored content
  // in that case there is no tree
  const tileContent = TestTile.create()

  libDebug.DEBUG_UNDO = true

  jestSpyConsole("warn", spy => {
    tileContent.setFlagWithoutUndo(true)
    expect(spy).not.toHaveBeenCalled()
  })

  libDebug.DEBUG_UNDO = false
})

it("will print a warning and still add the action to the undo list if any child actions call withoutUndo", async () => {
  const documentWithTileChild = {
    ...defaultDocumentContent,
    tileMap: {
      "t1": {
        id: "t1",
        content: {
          type: "TestTile",
          child: {
            value: "initial child value"
          }
        },
      }
    }
  }

  const {tileContent, manager, undoStore} = setupDocument(documentWithTileChild)

  jestSpyConsole("warn", spy => {
    tileContent.setChildValue("new child value")

    // It currently prints a warning when withoutUndo is called by a child action
    expect(spy).toHaveBeenCalled()
  })

  // Make sure this entry is recorded before undoing it
  await expectEntryToBeComplete(manager, 1)

  expect(undoStore.canUndo).toBe(true)

  expect(tileContent.child?.value).toBe("new child value")

  const changeDocument = manager.document

  expect(getSnapshot(changeDocument.history)).toEqual([
    {
      action: "/content/tileMap/t1/content/setChildValue",
      created: expect.any(Number),
      id: expect.any(String),
      records: [
        { action: "/content/tileMap/t1/content/setChildValue",
          inversePatches: [
            { op: "replace", path: "/content/tileMap/t1/content/child/value",
              value: "initial child value"}
          ],
          patches: [
            { op: "replace", path: "/content/tileMap/t1/content/child/value",
              value: "new child value"}
          ],
          tree: "test"
        },
      ],
      state: "complete",
      tree: "test",
      undoable: true
    }
  ])
})



it("records undoable actions that happen in the middle async actions which are not undoable", async () => {
  const {tileContent, manager, undoStore} = setupDocument()

  const updateCounterPromise = tileContent.updateCounterWithoutUndoAsync()

  await wait(1)

  tileContent.setFlag(true)

  await updateCounterPromise

  // Make sure the entries are recorded
  await expectEntryToBeComplete(manager, 2)

  expect(undoStore.canUndo).toBe(true)

  expect(tileContent.flag).toBe(true)
  expect(tileContent.counter).toBe(2)

  const changeDocument = manager.document
  expect(getSnapshot(changeDocument.history)).toEqual([
    setFlagTrueEntry,
    {
      action: "/content/tileMap/t1/content/updateCounterWithoutUndoAsync",
      created: expect.any(Number),
      id: expect.any(String),
      records: [
        { action: "/content/tileMap/t1/content/updateCounterWithoutUndoAsync",
          inversePatches: [
            { op: "replace", path: "/content/tileMap/t1/content/counter", value: 0},
            { op: "replace", path: "/content/tileMap/t1/content/counter", value: 1}
          ],
          patches: [
            { op: "replace", path: "/content/tileMap/t1/content/counter", value: 1},
            { op: "replace", path: "/content/tileMap/t1/content/counter", value: 2}
          ],
          tree: "test"
        },
      ],
      state: "complete",
      tree: "test",
      undoable: false
    }
  ])

})

/**
 * Remove the Jest `expect.any(Number)` on created, and provide a real id.
 * @param entry
 * @returns
 */
function makeRealHistoryEntry(entry: any): HistoryEntrySnapshot {
  const realEntry = cloneDeep(entry)
  realEntry.created = Date.now()
  realEntry.id = nanoid()
  return realEntry
}

it("can replay the history entries", async () => {
    // TODO: this isn't the best test because we are starting out with some initial
    // document state. We should create a history entry that setups up this initial
    // document state so we can test creating a document's content complete from
    // scratch.
    const {tileContent, manager} = setupDocument()

    // Add the history entries used in the tests above so we can replay them all at
    // the same time.
    const history = [
      makeRealHistoryEntry(setFlagTrueEntry),
      makeRealHistoryEntry(undoEntry),
      makeRealHistoryEntry(redoEntry)
    ]
    manager.setChangeDocument(CDocument.create({history}))
    await manager.replayHistoryToTrees()

    expect(tileContent.flag).toBe(true)

    // The history should not change after it is replayed
    const changeDocument = manager.document
    expect(getSnapshot(changeDocument.history)).toEqual(history)

})

const initialSharedModelUpdateEntry = {
  action: "/content/sharedModelMap/sm1/sharedModel/setValue",
  created: expect.any(Number),
  id: expect.any(String),
  records: [
    { action: "/handleSharedModelChanges",
      inversePatches: [
        { op: "replace", path: "/content/tileMap/t1/content/text", value: undefined}
      ],
      patches: [
        { op: "replace", path: "/content/tileMap/t1/content/text", value: "something-tile"}
      ],
      tree: "test"
    },
    { action: "/content/sharedModelMap/sm1/sharedModel/setValue",
      inversePatches: [
        { op: "replace", path: "/content/sharedModelMap/sm1/sharedModel/value", value: undefined}
      ],
      patches: [
        { op: "replace", path: "/content/sharedModelMap/sm1/sharedModel/value", value: "something"}
      ],
      tree: "test"
    }
  ],
  state: "complete",
  tree: "test",
  undoable: true
}

it("records a shared model change as one history event with two TreeRecordEntries", async () => {
  const {sharedModel, manager} = setupDocument()
  // This should record a history entry with this change and any changes to tiles
  // triggered by this change
  sharedModel.setValue("something")

  await expectEntryToBeComplete(manager, 1)

  const changeDocument = manager.document
  expect(getSnapshot(changeDocument.history)).toEqual([
    initialSharedModelUpdateEntry
  ])
})

const undoSharedModelEntry = {
  action: "undo",
  created: expect.any(Number),
  id: expect.any(String),
  records: [
    { action: "/applyPatchesFromManager",
      inversePatches: [
        { op: "replace", path: "/content/tileMap/t1/content/text", value: "something-tile"}
      ],
      patches: [
        { op: "replace", path: "/content/tileMap/t1/content/text", value: undefined}
      ],
      tree: "test"
    },
    { action: "/applyPatchesFromManager",
      inversePatches: [
        { op: "replace", path: "/content/sharedModelMap/sm1/sharedModel/value", value: "something"}
      ],
      patches: [
        { op: "replace", path: "/content/sharedModelMap/sm1/sharedModel/value", value: undefined}
      ],
      tree: "test"
    }
  ],
  state: "complete",
  tree: "manager",
  undoable: false
}

it("can undo a shared model change", async () => {
  const {sharedModel, tileContent, manager, undoStore} = setupDocument()
  // This should record a history entry with this change and any changes to tiles
  // triggered by this change
  sharedModel.setValue("something")

  // This might not really be needed but it is a good way to wait for all of the async
  // calls to propagate before making assertions
  await expectUpdateToBeCalledTimes(tileContent, 1)
  expect(sharedModel.value).toBe("something")

  undoStore.undo()

  await expectEntryToBeComplete(manager, 2)
  // TODO: document why update is called 1 more times here
  await expectUpdateToBeCalledTimes(tileContent, 3)

  expect(sharedModel.value).toBeUndefined()

  const changeDocument = manager.document
  expect(getSnapshot(changeDocument.history)).toEqual([
    initialSharedModelUpdateEntry,
    undoSharedModelEntry
  ])
})

const redoSharedModelEntry = {
  action: "redo",
  created: expect.any(Number),
  id: expect.any(String),
  records: [
    { action: "/applyPatchesFromManager",
      inversePatches: [
        { op: "replace", path: "/content/tileMap/t1/content/text", value: undefined}
      ],
      patches: [
        { op: "replace", path: "/content/tileMap/t1/content/text", value: "something-tile"}
      ],
      tree: "test"
    },
    { action: "/applyPatchesFromManager",
      inversePatches: [
        { op: "replace", path: "/content/sharedModelMap/sm1/sharedModel/value", value: undefined}
      ],
      patches: [
        { op: "replace", path: "/content/sharedModelMap/sm1/sharedModel/value", value: "something"}
      ],
      tree: "test"
    }
  ],
  state: "complete",
  tree: "manager",
  undoable: false
}

it("can redo a shared model change", async () => {
  const {sharedModel, tileContent, manager, undoStore} = setupDocument()
  // This should record a history entry with this change and any changes to tiles
  // triggered by this change
  sharedModel.setValue("something")

  // This might not really be needed but it is a good way to wait for all of the async
  // calls to propagate before making assertions
  await expectUpdateToBeCalledTimes(tileContent, 1)
  expect(sharedModel.value).toBe("something")
  expect(tileContent.text).toBe("something-tile")

  undoStore.undo()

  // TODO: document why the update is called 1 more times here
  await expectUpdateToBeCalledTimes(tileContent, 3)
  expect(sharedModel.value).toBeUndefined()
  expect(tileContent.text).toBeUndefined()

  undoStore.redo()

  // TODO: document why the update is called 1 more times here
  await expectUpdateToBeCalledTimes(tileContent, 5)
  expect(sharedModel.value).toBe("something")
  expect(tileContent.text).toBe("something-tile")

  const changeDocument = manager.document
  expect(getSnapshot(changeDocument.history)).toEqual([
    initialSharedModelUpdateEntry,
    undoSharedModelEntry,
    redoSharedModelEntry
  ])
})

it("can replay history entries that include shared model changes", async () => {
  // TODO: this isn't the best test because we are starting out with some initial
  // document state. We should create a history entry that setups up this initial
  // document state so we can test creating a document's content complete from
  // scratch.
  const {tileContent, sharedModel, manager} = setupDocument()

  // Add the history entries used in the tests above so we can replay them all at
  // the same time.
  const history = [
    makeRealHistoryEntry(initialSharedModelUpdateEntry),
    makeRealHistoryEntry(undoSharedModelEntry),
    makeRealHistoryEntry(redoSharedModelEntry)
  ]

  manager.setChangeDocument(CDocument.create({history}))
  await manager.replayHistoryToTrees()

  expect(sharedModel.value).toBe("something")
  expect(tileContent.text).toBe("something-tile")

  // The history should not change after it is replayed
  const changeDocument = manager.document
  expect(getSnapshot(changeDocument.history)).toEqual(history)
})

// This is recording 3 events for something that should probably be 1
// However we don't have a good solution for that yet.
it("can track the addition of a new shared model", async () => {
  // Start with just a tile and no shared model
  const {tileContent, manager} = setupDocument({
    tileMap: {
      "t1": {
        id: "t1",
        content: {
          type: "TestTile"
        },
      }
    }
  })

  const sharedModelManager = tileContent.tileEnv?.sharedModelManager
  const newSharedModel = TestSharedModel.create({value: "new model"})
  const sharedModelId = newSharedModel.id
  sharedModelManager?.addTileSharedModel(tileContent, newSharedModel)

  await expectEntryToBeComplete(manager, 3)

  const changeDocument = manager.document
  expect(getSnapshot(changeDocument.history)).toEqual([
    {
      action: "/content/addSharedModel",
      created: expect.any(Number),
      id: expect.any(String),
      records: [
        {
          action: "/content/addSharedModel",
          inversePatches: [
            { op: "remove", path: `/content/sharedModelMap/${sharedModelId}` }
          ],
          patches: [
            {
              op: "add", path: `/content/sharedModelMap/${sharedModelId}`,
              value: {
                sharedModel: {
                  id: sharedModelId,
                  type: "TestSharedModel",
                  value: "new model"
                },
                tiles: []
              }
            }
          ],
          tree: "test"
        }
      ],
      state: "complete",
      tree: "test",
      undoable: true
    },
    {
      action: `/content/sharedModelMap/${sharedModelId}/addTile`,
      created: expect.any(Number),
      id: expect.any(String),
      records: [
        {
          action: `/content/sharedModelMap/${sharedModelId}/addTile`,
          inversePatches: [
            { op: "remove", path: `/content/sharedModelMap/${sharedModelId}/tiles/0`}
          ],
          patches: [
            {
              op: "add", path: `/content/sharedModelMap/${sharedModelId}/tiles/0`,
              value: "t1"
            }
          ],
          tree: "test"
        }
      ],
      state: "complete",
      tree: "test",
      undoable: true
    },
    {
      action: "/content/tileMap/t1/content/updateAfterSharedModelChanges",
      created: expect.any(Number),
      id: expect.any(String),
      records: [
        {
          action: "/content/tileMap/t1/content/updateAfterSharedModelChanges",
          inversePatches: [
            {
              op: "replace", path: "/content/tileMap/t1/content/text",
              value: undefined
            }
          ],
          patches: [
            {
              op: "replace", path: "/content/tileMap/t1/content/text",
              value: "new model-tile"
            }
          ],
          tree: "test"
        }
      ],
      state: "complete",
      tree: "test",
      undoable: true
    }
  ])
})

async function expectUpdateToBeCalledTimes(testTile: TestTileType, times: number) {
  const updateCalledTimes = when(() => testTile.updateCount === times, {timeout: 100})
  return expect(updateCalledTimes).resolves.toBeUndefined()
}

// TODO: it would nicer to use a custom Jest matcher here so we can
// provide a better error message when it fails
async function expectEntryToBeComplete(manager: Instance<typeof TreeManager>, length: number) {
  const changeDocument = manager.document
  let timedOut = false
  try {
    await when(
      () => changeDocument.history.length >= length && changeDocument.history.at(length-1)?.state === "complete",
      {timeout: 100})
  } catch (e) {
    timedOut = true
  }
  expect({
    historyLength: changeDocument.history.length,
    lastEntryState: changeDocument.history.at(-1)?.state,
    activeExchanges: changeDocument.history.at(-1)?.activeExchanges.toJSON(),
    timedOut
  }).toEqual({
    historyLength: length,
    lastEntryState: "complete",
    activeExchanges: [],
    timedOut: false
  })
}

import type { BTreeState, BTreePage } from './btree.types'

const MAX_KEYS = 3

function createPage(id: string, isLeaf: boolean): BTreePage {
  return {
    id,
    isLeaf,
    keys: [],
    children: [],
    ctids: [],
    leftLink: null,
    rightLink: null,
  }
}

export function createInitialBTreeState(): BTreeState {
  const rootId = 'p0'
  const pages: Record<string, BTreePage> = {
    [rootId]: createPage(rootId, true),
  }
  return {
    pages,
    rootId,
    nextPageId: 1,
    height: 1,
    insertedKeys: [],
    lastOp: 'Ready',
  }
}

function findLeaf(state: BTreeState, key: number): string {
  let pageId = state.rootId
  while (!state.pages[pageId].isLeaf) {
    const page = state.pages[pageId]
    let childIdx = 0
    for (let i = 0; i < page.keys.length; i++) {
      if (key < page.keys[i]) {
        break
      }
      childIdx = i + 1
    }
    pageId = page.children[childIdx]
  }
  return pageId
}

export function btreeInsert(state: BTreeState, key: number): BTreeState {
  if (state.insertedKeys.includes(key)) {
    return { ...state, lastOp: `Key ${key} already exists` }
  }

  const leafId = findLeaf(state, key)
  const pages = { ...state.pages }
  const leaf = { ...pages[leafId] }

  // Insert into leaf (maintain sorted order)
  let insertIdx = 0
  for (let i = 0; i < leaf.keys.length; i++) {
    if (key < leaf.keys[i]) {
      insertIdx = i
      break
    }
    insertIdx = i + 1
  }

  leaf.keys.splice(insertIdx, 0, key)
  leaf.ctids.splice(insertIdx, 0, `${leaf.id}:${insertIdx}`)
  pages[leafId] = leaf

  let newState: BTreeState = {
    ...state,
    pages,
    insertedKeys: [...state.insertedKeys, key],
    lastOp: `Inserted ${key} into leaf ${leafId}`,
  }

  // Check for overflow and split
  if (leaf.keys.length > MAX_KEYS) {
    newState = splitLeaf(newState, leafId)
  }

  return newState
}

function splitLeaf(state: BTreeState, leafId: string): BTreeState {
  const leaf = state.pages[leafId]
  const midIdx = Math.floor(leaf.keys.length / 2)

  const newPageId = `p${state.nextPageId}`
  const newLeaf = createPage(newPageId, true)

  // Split keys/ctids
  newLeaf.keys = leaf.keys.slice(midIdx)
  newLeaf.ctids = leaf.ctids.slice(midIdx)
  leaf.keys = leaf.keys.slice(0, midIdx)
  leaf.ctids = leaf.ctids.slice(0, midIdx)

  // Maintain leaf chain
  newLeaf.leftLink = leafId
  newLeaf.rightLink = leaf.rightLink
  if (leaf.rightLink) {
    const rightLeaf = state.pages[leaf.rightLink]
    rightLeaf.leftLink = newPageId
    state.pages[leaf.rightLink] = rightLeaf
  }
  leaf.rightLink = newPageId

  const pages = { ...state.pages, [leafId]: leaf, [newPageId]: newLeaf }
  const pushKey = newLeaf.keys[0]

  const newState: BTreeState = {
    ...state,
    pages,
    nextPageId: state.nextPageId + 1,
    lastOp: `Split leaf ${leafId} → ${newPageId}, push key ${pushKey}`,
  }

  // Push key to parent
  return pushKeyUp(newState, state.rootId, pushKey, leafId, newPageId)
}

function pushKeyUp(state: BTreeState, parentId: string, key: number, leftChildId: string, rightChildId: string): BTreeState {
  if (parentId === state.rootId && state.pages[parentId].isLeaf) {
    // Root was a leaf, need to create new root
    return createNewRoot(state, key, leftChildId, rightChildId)
  }

  const parent = { ...state.pages[parentId] }
  let insertIdx = 0
  for (let i = 0; i < parent.keys.length; i++) {
    if (key < parent.keys[i]) {
      insertIdx = i
      break
    }
    insertIdx = i + 1
  }

  parent.keys.splice(insertIdx, 0, key)
  parent.children.splice(insertIdx + 1, 0, rightChildId)

  const pages = { ...state.pages, [parentId]: parent }
  const newState: BTreeState = {
    ...state,
    pages,
    lastOp: `Pushed key ${key} to ${parentId}`,
  }

  // Check for overflow in parent
  if (parent.keys.length > MAX_KEYS) {
    return splitInternal(newState, parentId)
  }

  return newState
}

function splitInternal(state: BTreeState, pageId: string): BTreeState {
  const page = state.pages[pageId]
  const midIdx = Math.floor(page.keys.length / 2)
  const pushKey = page.keys[midIdx]

  const newPageId = `p${state.nextPageId}`
  const newPage = createPage(newPageId, false)

  newPage.keys = page.keys.slice(midIdx + 1)
  newPage.children = page.children.slice(midIdx + 1)
  page.keys = page.keys.slice(0, midIdx)
  page.children = page.children.slice(0, midIdx + 1)

  const pages = { ...state.pages, [pageId]: page, [newPageId]: newPage }

  const newState: BTreeState = {
    ...state,
    pages,
    nextPageId: state.nextPageId + 1,
    lastOp: `Split internal ${pageId} → ${newPageId}`,
  }

  // Find parent and push up
  const parentId = findParent(newState, pageId)
  if (!parentId) {
    return createNewRoot(newState, pushKey, pageId, newPageId)
  }

  return pushKeyUp(newState, parentId, pushKey, pageId, newPageId)
}

function findParent(state: BTreeState, childId: string): string | null {
  const root = state.pages[state.rootId]
  if (root.isLeaf) return null
  return findParentHelper(state, state.rootId, childId)
}

function findParentHelper(state: BTreeState, nodeId: string, targetId: string): string | null {
  const node = state.pages[nodeId]
  for (const childId of node.children) {
    if (childId === targetId) return nodeId
    if (!state.pages[childId].isLeaf) {
      const result = findParentHelper(state, childId, targetId)
      if (result) return result
    }
  }
  return null
}

function createNewRoot(state: BTreeState, key: number, leftId: string, rightId: string): BTreeState {
  const newRootId = `p${state.nextPageId}`
  const newRoot = createPage(newRootId, false)
  newRoot.keys = [key]
  newRoot.children = [leftId, rightId]

  const pages = { ...state.pages, [newRootId]: newRoot }

  return {
    ...state,
    pages,
    rootId: newRootId,
    nextPageId: state.nextPageId + 1,
    height: state.height + 1,
    lastOp: `Created new root ${newRootId}, tree height now ${state.height + 1}`,
  }
}

export function btreeSearch(state: BTreeState, key: number): { found: boolean; location: string } {
  const leafId = findLeaf(state, key)
  const leaf = state.pages[leafId]
  const idx = leaf.keys.findIndex(k => k === key)
  if (idx >= 0) {
    return { found: true, location: `${leafId}:${idx}` }
  }
  return { found: false, location: 'not found' }
}

export function btreeRangeScan(state: BTreeState, lo: number, hi: number): { keys: number[]; pageIds: string[] } {
  let leafId = findLeaf(state, lo)
  const leaf = state.pages[leafId]
  let startIdx = leaf.keys.findIndex(k => k >= lo)
  if (startIdx < 0) startIdx = leaf.keys.length

  const result: number[] = []
  const pageIds: string[] = []

  while (leafId) {
    const page = state.pages[leafId]
    for (let i = startIdx; i < page.keys.length; i++) {
      if (page.keys[i] > hi) break
      result.push(page.keys[i])
      pageIds.push(leafId)
    }
    if (!page.rightLink || page.rightLink === null) break
    leafId = page.rightLink
    startIdx = 0
  }

  return { keys: result, pageIds }
}

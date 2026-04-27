export interface BTreePage {
  id: string
  isLeaf: boolean
  keys: number[]
  children: string[]
  ctids: string[]
  leftLink: string | null
  rightLink: string | null
}

export interface BTreeState {
  pages: Record<string, BTreePage>
  rootId: string
  nextPageId: number
  height: number
  insertedKeys: number[]
  lastOp: string
}

export type BTreeAnimStep =
  | { type: 'hash-key'; key: number; pageId: string }
  | { type: 'traverse'; fromId: string; toId: string }
  | { type: 'leaf-split'; pageId: string; newPageId: string; splitKey: number }
  | { type: 'root-split'; newRootId: string }
  | { type: 'insert-done'; key: number; pageId: string }

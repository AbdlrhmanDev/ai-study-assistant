import { LIST_TYPES, WorkspaceBlock } from "./types";

export const MAX_BLOCK_DEPTH = 8;

let idCounter = 0;
export function newBlockId(): string {
  idCounter += 1;
  return `b${Date.now().toString(36)}${idCounter}`;
}

export function findBlock(blocks: WorkspaceBlock[], id: string): WorkspaceBlock | null {
  for (const block of blocks) {
    if (block.id === id) return block;
    const found = findBlock(block.children, id);
    if (found) return found;
  }
  return null;
}

export function depthOf(blocks: WorkspaceBlock[], id: string, depth = 1): number | null {
  for (const block of blocks) {
    if (block.id === id) return depth;
    const found = depthOf(block.children, id, depth + 1);
    if (found !== null) return found;
  }
  return null;
}

function maxDepthOf(block: WorkspaceBlock): number {
  if (!block.children.length) return 1;
  return 1 + Math.max(...block.children.map(maxDepthOf));
}

/** Immutably replace the block matching `id` using `updater`. No-op if not found. */
export function updateBlockById(
  blocks: WorkspaceBlock[],
  id: string,
  updater: (block: WorkspaceBlock) => WorkspaceBlock,
): WorkspaceBlock[] {
  return blocks.map((block) => {
    if (block.id === id) return updater(block);
    if (!block.children.length) return block;
    const nextChildren = updateBlockById(block.children, id, updater);
    return nextChildren === block.children ? block : { ...block, children: nextChildren };
  });
}

/** Immutably remove the block matching `id`. Returns [nextTree, removedBlock]. */
export function removeBlockById(
  blocks: WorkspaceBlock[],
  id: string,
): [WorkspaceBlock[], WorkspaceBlock | null] {
  let removed: WorkspaceBlock | null = null;
  const next: WorkspaceBlock[] = [];
  for (const block of blocks) {
    if (block.id === id) {
      removed = block;
      continue;
    }
    if (block.children.length) {
      const [nextChildren, childRemoved] = removeBlockById(block.children, id);
      if (childRemoved) {
        removed = childRemoved;
        next.push({ ...block, children: nextChildren });
        continue;
      }
    }
    next.push(block);
  }
  return [next, removed];
}

/** Insert `block` as a sibling immediately after `afterId`. Falls back to the end of the root list if `afterId` is null/not found. */
export function insertBlockAfter(
  blocks: WorkspaceBlock[],
  afterId: string | null,
  block: WorkspaceBlock,
): WorkspaceBlock[] {
  if (afterId === null) return [...blocks, block];
  let inserted = false;
  const next: WorkspaceBlock[] = [];
  for (const item of blocks) {
    next.push(item);
    if (item.id === afterId) {
      next.push(block);
      inserted = true;
    } else if (item.children.length) {
      const nextChildren = insertBlockAfter(item.children, afterId, block);
      if (nextChildren !== item.children) {
        next[next.length - 1] = { ...item, children: nextChildren };
        inserted = true;
      }
    }
  }
  return inserted ? next : [...blocks, block];
}

function findParentChain(
  blocks: WorkspaceBlock[],
  id: string,
  parents: WorkspaceBlock[] = [],
): WorkspaceBlock[] | null {
  for (const block of blocks) {
    if (block.id === id) return parents;
    const found = findParentChain(block.children, id, [...parents, block]);
    if (found) return found;
  }
  return null;
}

/** Make `id` a child of its immediately preceding sibling (a no-op if it has none, or if doing so would exceed the max nesting depth). */
export function indentBlock(blocks: WorkspaceBlock[], id: string): WorkspaceBlock[] {
  const parents = findParentChain(blocks, id);
  if (!parents) return blocks;
  const siblings = parents.length ? parents[parents.length - 1].children : blocks;
  const index = siblings.findIndex((block) => block.id === id);
  if (index <= 0) return blocks;

  const target = siblings[index];
  const newParent = siblings[index - 1];
  if (parents.length + maxDepthOf(target) >= MAX_BLOCK_DEPTH) return blocks;

  const [withoutTarget] = removeBlockById(blocks, id);
  return updateBlockById(withoutTarget, newParent.id, (block) => ({
    ...block,
    children: [...block.children, target],
  }));
}

/** Move `id` up one nesting level, becoming a sibling right after its current parent. No-op if already at the root. */
export function outdentBlock(blocks: WorkspaceBlock[], id: string): WorkspaceBlock[] {
  const parents = findParentChain(blocks, id);
  if (!parents || !parents.length) return blocks;
  const parent = parents[parents.length - 1];
  const target = findBlock(blocks, id);
  if (!target) return blocks;

  const [withoutTarget] = removeBlockById(blocks, id);
  return insertBlockAfter(withoutTarget, parent.id, target);
}

/** General-purpose move: remove `id` from wherever it is and re-insert as a sibling after `afterId` (or at root end if null). Used by drag-and-drop and "Move to". */
export function moveBlockAfter(
  blocks: WorkspaceBlock[],
  id: string,
  afterId: string | null,
): WorkspaceBlock[] {
  if (id === afterId) return blocks;
  const [withoutTarget, removed] = removeBlockById(blocks, id);
  if (!removed) return blocks;
  return insertBlockAfter(withoutTarget, afterId, removed);
}

/** Nest `id` as the last child of `parentId`. Used by drag-and-drop nesting. */
export function nestBlockInto(
  blocks: WorkspaceBlock[],
  id: string,
  parentId: string,
): WorkspaceBlock[] {
  if (id === parentId) return blocks;
  const target = findBlock(blocks, id);
  if (!target) return blocks;
  const parentDepth = depthOf(blocks, parentId);
  if (parentDepth === null || parentDepth + maxDepthOf(target) >= MAX_BLOCK_DEPTH) return blocks;

  const [withoutTarget] = removeBlockById(blocks, id);
  return updateBlockById(withoutTarget, parentId, (block) => ({
    ...block,
    children: [...block.children, target],
  }));
}

function cloneWithFreshIds(block: WorkspaceBlock): WorkspaceBlock {
  return {
    ...block,
    id: newBlockId(),
    children: block.children.map(cloneWithFreshIds),
  };
}

export function duplicateBlock(blocks: WorkspaceBlock[], id: string): WorkspaceBlock[] {
  const target = findBlock(blocks, id);
  if (!target) return blocks;
  return insertBlockAfter(blocks, id, cloneWithFreshIds(target));
}

/** Ordered list of visible block ids -- respects toggle-collapsed state -- used for Arrow-key navigation and scroll-to-block. */
export function flattenVisible(blocks: WorkspaceBlock[], collapsedIds: Set<string>): string[] {
  const ids: string[] = [];
  for (const block of blocks) {
    ids.push(block.id);
    if (block.type === "toggle" && collapsedIds.has(block.id)) continue;
    ids.push(...flattenVisible(block.children, collapsedIds));
  }
  return ids;
}

export function isEmptyBlock(block: WorkspaceBlock): boolean {
  if (block.children.length) return false;
  if (block.content.trim()) return false;
  const props = block.properties;
  return !props.url && !props.title && !props.description && !props.imageUrl && !props.youtubeId;
}

export function isListType(type: WorkspaceBlock["type"]): boolean {
  return LIST_TYPES.includes(type);
}

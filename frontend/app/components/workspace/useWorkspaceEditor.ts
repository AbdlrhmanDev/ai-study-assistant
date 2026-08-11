import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError, messageFromError, Topic } from "../../lib/api";
import {
  duplicateBlock,
  findBlock,
  flattenVisible,
  indentBlock,
  insertBlockAfter,
  isEmptyBlock,
  moveBlockAfter,
  nestBlockInto,
  newBlockId,
  outdentBlock,
  removeBlockById,
  updateBlockById,
} from "./blockTree";
import { BlockProperties, BlockType, WorkspaceBlock, WorkspacePage, makeBlock } from "./types";

export type SaveStatus = "idle" | "saving" | "saved" | "error" | "conflict";
export type WorkspaceConflict = { title: string; blocks: WorkspaceBlock[]; updatedAt: string };

export function useWorkspaceEditor(pageId: number) {
  const [page, setPage] = useState<WorkspacePage | null>(null);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [title, setTitle] = useState("");
  const [blocks, setBlocks] = useState<WorkspaceBlock[]>([]);
  const [error, setError] = useState("");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [conflict, setConflict] = useState<WorkspaceConflict | null>(null);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [focusRequest, setFocusRequest] = useState<{ id: string; caret: "start" | "end" } | null>(null);

  const saveTimer = useRef<number | null>(null);
  const blocksRef = useRef<WorkspaceBlock[]>([]);
  // Opaque token from the server, echoed back verbatim on every save so it
  // can detect a write from another tab/device that happened in between --
  // never parsed/reformatted client-side (see backend workspace/service.py
  // for why an exact string round-trip matters).
  const lastKnownUpdatedAtRef = useRef<string | null>(null);
  // Keep the ref in sync after every render (not during render, which
  // eslint's react-hooks rules disallow). The one case that matters most --
  // two block actions called back-to-back in the same event-handler tick --
  // is handled separately by writing blocksRef.current directly inside
  // applyBlocks below, so this effect only needs to cover the remaining
  // paths (e.g. the initial load()'s setBlocks call).
  useEffect(() => {
    blocksRef.current = blocks;
  });

  const persist = useCallback(
    async (nextTitle: string | undefined, nextBlocks: WorkspaceBlock[] | undefined) => {
      if (!Number.isInteger(pageId) || pageId < 1) return;
      setSaveStatus("saving");
      try {
        const payload: Record<string, unknown> = {};
        if (nextTitle !== undefined) payload.title = nextTitle;
        if (nextBlocks !== undefined) payload.blocks = nextBlocks;
        if (lastKnownUpdatedAtRef.current) payload.expectedUpdatedAt = lastKnownUpdatedAtRef.current;
        const result = await api<{ page: WorkspacePage }>(`/workspace-pages/${pageId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        lastKnownUpdatedAtRef.current = result.page.updated_at;
        setSaveStatus("saved");
      } catch (requestError) {
        if (requestError instanceof ApiError && requestError.status === 409) {
          // Someone/something else (another tab, another device) saved
          // this page since we last synced -- stop silently overwriting
          // their work. Surface it; the editor UI decides how to let the
          // user reconcile (reload theirs, or keep editing and retry).
          const details = requestError.details as { current?: WorkspaceConflict } | undefined;
          if (details?.current) setConflict(details.current);
          setSaveStatus("conflict");
          return;
        }
        setSaveStatus("error");
      }
    },
    [pageId],
  );

  const reloadFromServer = useCallback(async () => {
    const result = await api<{ page: WorkspacePage }>(`/workspace-pages/${pageId}`);
    lastKnownUpdatedAtRef.current = result.page.updated_at;
    setPage(result.page);
    setTitle(result.page.title);
    blocksRef.current = result.page.blocks;
    setBlocks(result.page.blocks);
    setConflict(null);
    setSaveStatus("idle");
  }, [pageId]);

  const load = useCallback(async () => {
    if (!Number.isInteger(pageId) || pageId < 1) return;
    try {
      const [pageResult, topicsResult] = await Promise.all([
        api<{ page: WorkspacePage }>(`/workspace-pages/${pageId}`),
        api<{ topics: Topic[] }>("/topics"),
      ]);
      setPage(pageResult.page);
      setTitle(pageResult.page.title);
      setTopics(topicsResult.topics);
      lastKnownUpdatedAtRef.current = pageResult.page.updated_at;
      if (pageResult.page.blocks.length === 0) {
        // A page always has at least one block to type into -- seed one
        // empty text block instead of showing an empty state with a
        // separate "add block" button.
        const id = newBlockId();
        const seedBlock = makeBlock("text", id);
        blocksRef.current = [seedBlock];
        setBlocks([seedBlock]);
        void persist(undefined, [seedBlock]);
        setFocusRequest({ id, caret: "start" });
      } else {
        setBlocks(pageResult.page.blocks);
      }
    } catch (requestError) {
      setError(messageFromError(requestError));
    }
  }, [pageId, persist]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const scheduleSave = useCallback(
    (nextTitle?: string, nextBlocks?: WorkspaceBlock[]) => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(() => void persist(nextTitle, nextBlocks), 700);
    },
    [persist],
  );

  const discardConflictAndRetry = useCallback(() => {
    // Keep editing here, but adopt the server's updatedAt so the very next
    // save is evaluated against what's actually current instead of
    // repeating the same conflict.
    if (conflict) lastKnownUpdatedAtRef.current = conflict.updatedAt;
    setConflict(null);
    scheduleSave(title, blocksRef.current);
  }, [conflict, title, scheduleSave]);

  const setTitleValue = useCallback(
    (value: string) => {
      setTitle(value);
      scheduleSave(value || "Untitled page", undefined);
    },
    [scheduleSave],
  );

  const applyBlocks = useCallback(
    (next: WorkspaceBlock[]) => {
      // Also update the ref synchronously (not just via the render-cycle
      // assignment above) so that two block actions called back-to-back in
      // the same tick (e.g. strip slash text + turn block into a heading)
      // each see the other's result instead of both reading stale state.
      blocksRef.current = next;
      setBlocks(next);
      scheduleSave(undefined, next);
    },
    [scheduleSave],
  );

  const updateBlockContent = useCallback(
    (id: string, content: string) => {
      applyBlocks(updateBlockById(blocksRef.current, id, (block) => ({ ...block, content })));
    },
    [applyBlocks],
  );

  const updateBlockProperties = useCallback(
    (id: string, patch: Partial<BlockProperties>) => {
      applyBlocks(
        updateBlockById(blocksRef.current, id, (block) => ({
          ...block,
          properties: { ...block.properties, ...patch },
        })),
      );
    },
    [applyBlocks],
  );

  const turnInto = useCallback(
    (id: string, type: BlockType) => {
      applyBlocks(updateBlockById(blocksRef.current, id, (block) => ({ ...block, type })));
    },
    [applyBlocks],
  );

  const addBlockAfter = useCallback(
    (afterId: string | null, type: BlockType, content = "") => {
      const id = newBlockId();
      const block = makeBlock(type, id, { content });
      applyBlocks(insertBlockAfter(blocksRef.current, afterId, block));
      setFocusRequest({ id, caret: "start" });
      return id;
    },
    [applyBlocks],
  );

  const removeBlock = useCallback(
    (id: string) => {
      const visible = flattenVisible(blocksRef.current, collapsedIds);
      const index = visible.indexOf(id);
      const previousId = index > 0 ? visible[index - 1] : null;
      const [next] = removeBlockById(blocksRef.current, id);
      if (next.length === 0) {
        // Never leave the page fully empty -- seed a fresh block to type
        // into, same as on initial load.
        const newId = newBlockId();
        applyBlocks([makeBlock("text", newId)]);
        setFocusRequest({ id: newId, caret: "start" });
        return;
      }
      applyBlocks(next);
      if (previousId) setFocusRequest({ id: previousId, caret: "end" });
    },
    [applyBlocks, collapsedIds],
  );

  const duplicate = useCallback(
    (id: string) => {
      applyBlocks(duplicateBlock(blocksRef.current, id));
    },
    [applyBlocks],
  );

  const indent = useCallback((id: string) => applyBlocks(indentBlock(blocksRef.current, id)), [applyBlocks]);
  const outdent = useCallback((id: string) => applyBlocks(outdentBlock(blocksRef.current, id)), [applyBlocks]);

  const moveAfter = useCallback(
    (id: string, afterId: string | null) => applyBlocks(moveBlockAfter(blocksRef.current, id, afterId)),
    [applyBlocks],
  );

  const nestInto = useCallback(
    (id: string, parentId: string) => applyBlocks(nestBlockInto(blocksRef.current, id, parentId)),
    [applyBlocks],
  );

  /** Reorder the root-level block array directly (used by the "Move to"
   * up/down/top/bottom context menu action, which is scoped to root-level
   * reordering rather than arbitrary cross-tree moves). */
  const reorderRootBlocks = useCallback(
    (next: WorkspaceBlock[]) => applyBlocks(next),
    [applyBlocks],
  );

  const toggleCollapsed = useCallback((id: string) => {
    setCollapsedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  /** Enter key: split a block's text at the caret into two siblings. */
  const splitBlock = useCallback(
    (id: string, beforeText: string, afterText: string) => {
      const current = findBlock(blocksRef.current, id);
      if (!current) return;
      const withUpdatedContent = updateBlockById(blocksRef.current, id, (block) => ({
        ...block,
        content: beforeText,
      }));
      const newId = newBlockId();
      const nextType = current.type === "code" || current.type === "equation" ? "text" : current.type;
      const newBlock = makeBlock(nextType, newId, { content: afterText });
      applyBlocks(insertBlockAfter(withUpdatedContent, id, newBlock));
      setFocusRequest({ id: newId, caret: "start" });
    },
    [applyBlocks],
  );

  /** Backspace at caret 0 on a non-empty block: merge its text into the previous visible block. */
  const mergeWithPrevious = useCallback(
    (id: string) => {
      const visible = flattenVisible(blocksRef.current, collapsedIds);
      const index = visible.indexOf(id);
      if (index <= 0) return;
      const previousId = visible[index - 1];
      const current = findBlock(blocksRef.current, id);
      const previous = findBlock(blocksRef.current, previousId);
      if (!current || !previous) return;

      const mergedContent = previous.content + current.content;
      const caretOffset = previous.content.length;
      let next = updateBlockById(blocksRef.current, previousId, (block) => ({ ...block, content: mergedContent }));
      const [withoutCurrent] = removeBlockById(next, id);
      next = withoutCurrent;
      applyBlocks(next);
      setFocusRequest({ id: previousId, caret: caretOffset === 0 ? "start" : "end" });
    },
    [applyBlocks, collapsedIds],
  );

  const linkTopic = useCallback(
    async (topicId: number | null) => {
      if (!page) return;
      try {
        const result = await api<{ page: WorkspacePage }>(`/workspace-pages/${page.id}/topic`, {
          method: "PATCH",
          body: JSON.stringify({ topic_id: topicId }),
        });
        setPage(result.page);
      } catch (requestError) {
        setError(messageFromError(requestError));
      }
    },
    [page],
  );

  const deletePage = useCallback(async () => {
    if (!page) return;
    await api<null>(`/workspace-pages/${page.id}`, { method: "DELETE" });
  }, [page]);

  const askAiOnBlock = useCallback(
    async (blockId: string, instruction: string) => {
      if (!page) throw new Error("Page not loaded");
      return api<{ result: { answer: string; provider: string; model: string } }>(
        `/workspace-pages/${page.id}/blocks/${blockId}/ask-ai`,
        { method: "POST", body: JSON.stringify({ instruction }) },
      );
    },
    [page],
  );

  const clearFocusRequest = useCallback(() => setFocusRequest(null), []);

  return {
    page,
    topics,
    title,
    blocks,
    error,
    saveStatus,
    conflict,
    reloadFromServer,
    discardConflictAndRetry,
    collapsedIds,
    focusRequest,
    setTitleValue,
    updateBlockContent,
    updateBlockProperties,
    turnInto,
    addBlockAfter,
    removeBlock,
    duplicate,
    indent,
    outdent,
    moveAfter,
    nestInto,
    reorderRootBlocks,
    toggleCollapsed,
    splitBlock,
    mergeWithPrevious,
    linkTopic,
    deletePage,
    askAiOnBlock,
    clearFocusRequest,
    isEmptyBlock,
  };
}

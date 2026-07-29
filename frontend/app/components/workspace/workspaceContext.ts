import { createContext, KeyboardEvent as ReactKeyboardEvent, useContext } from "react";
import { useWorkspaceEditor } from "./useWorkspaceEditor";

export type WorkspaceEditorApi = ReturnType<typeof useWorkspaceEditor>;

export type BlockMenus = {
  slashMenuBlockId: string | null;
  openSlashMenu: (blockId: string, rect: DOMRect, query: string) => void;
  updateSlashQuery: (query: string) => void;
  closeSlashMenu: () => void;
  handleSlashMenuKeyDown: (event: ReactKeyboardEvent) => boolean;
  openContextMenu: (blockId: string, rect: DOMRect) => void;
  openLinkPasteMenu: (blockId: string, url: string, rect: DOMRect) => void;
  highlightedBlockId: string | null;
};

export type DropHint = { targetId: string; as: "sibling" | "child" } | null;

export type WorkspaceCtx = {
  editor: WorkspaceEditorApi;
  menus: BlockMenus;
  draggingId: string | null;
  setDraggingId: (id: string | null) => void;
  dropHint: DropHint;
  setDropHint: (hint: DropHint) => void;
};

export const WorkspaceContext = createContext<WorkspaceCtx | null>(null);

export function useWorkspaceContext(): WorkspaceCtx {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("Must be rendered inside <BlockList>");
  return ctx;
}

export function blockElementId(id: string) {
  return `workspace-block-${id}`;
}

"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { KeyboardEvent as ReactKeyboardEvent, useCallback, useEffect, useRef, useState } from "react";
import { Trash2, X } from "lucide-react";
import AppSidebar from "../AppSidebar";
import { BlockList } from "./BlockRenderer";
import SlashMenu from "./SlashMenu";
import BlockContextMenu from "./BlockContextMenu";
import LinkPasteMenu from "./LinkPasteMenu";
import AskAiPopover from "./AskAiPopover";
import { findBlock } from "./blockTree";
import { BlockColor, BlockType, LinkPreview } from "./types";
import { useWorkspaceEditor } from "./useWorkspaceEditor";
import { BlockMenus } from "./workspaceContext";

export function WorkspacePageEditor() {
  const params = useSearchParams();
  const pageId = Number(params.get("id"));
  const router = useRouter();

  useEffect(() => {
    if (!Number.isInteger(pageId) || pageId < 1) router.replace("/workspace");
  }, [pageId, router]);

  const editor = useWorkspaceEditor(pageId);

  const [slashMenu, setSlashMenu] = useState<{ blockId: string; rect: DOMRect; query: string } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ blockId: string; rect: DOMRect } | null>(null);
  const [linkPasteMenu, setLinkPasteMenu] = useState<{ blockId: string; url: string; rect: DOMRect } | null>(null);
  const [askAi, setAskAi] = useState<{ blockId: string; rect: DOMRect } | null>(null);
  const [highlightedBlockId, setHighlightedBlockId] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const slashKeyHandlerRef = useRef<(event: ReactKeyboardEvent) => boolean>(() => false);

  // Copy-link-to-block: scroll to and flash-highlight the target block on load.
  useEffect(() => {
    if (!editor.page || !window.location.hash.startsWith("#block-")) return;
    const id = window.location.hash.slice("#block-".length);
    if (!findBlock(editor.blocks, id)) return;
    const el = document.getElementById(`block-wrap-${id}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    // Driven by the URL hash on load -- a genuine external-system sync, not
    // derived render state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHighlightedBlockId(id);
    const timer = window.setTimeout(() => setHighlightedBlockId(null), 2000);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor.page]);

  const menus: BlockMenus = {
    slashMenuBlockId: slashMenu?.blockId ?? null,
    openSlashMenu: useCallback((blockId, rect, query) => setSlashMenu({ blockId, rect, query }), []),
    updateSlashQuery: useCallback((query) => setSlashMenu((current) => (current ? { ...current, query } : current)), []),
    closeSlashMenu: useCallback(() => setSlashMenu(null), []),
    handleSlashMenuKeyDown: useCallback((event) => slashKeyHandlerRef.current(event), []),
    openContextMenu: useCallback((blockId, rect) => setContextMenu({ blockId, rect }), []),
    openLinkPasteMenu: useCallback((blockId, url, rect) => setLinkPasteMenu({ blockId, url, rect }), []),
    highlightedBlockId,
  };

  function handleSlashSelect(type: BlockType) {
    if (!slashMenu) return;
    const block = findBlock(editor.blocks, slashMenu.blockId);
    if (block) {
      // Strip the "/query" text the user typed, then convert the block type.
      const stripped = block.content.replace(/(?:^|\s)\/\S*$/, "");
      editor.updateBlockContent(slashMenu.blockId, stripped);
      editor.turnInto(slashMenu.blockId, type);
    }
    setSlashMenu(null);
    window.setTimeout(() => document.getElementById(`workspace-block-${slashMenu.blockId}`)?.focus(), 0);
  }

  function handleColor(kind: "textColor" | "backgroundColor", color: BlockColor) {
    if (!contextMenu) return;
    editor.updateBlockProperties(contextMenu.blockId, { [kind]: color });
    setContextMenu(null);
  }

  /** "Move to" is scoped to reordering among root-level blocks (see plan
   * notes) -- a full cross-page block picker is a materially bigger
   * feature not otherwise implied by the spec. */
  function handleMove(direction: "up" | "down" | "top" | "bottom") {
    if (!contextMenu) return;
    const { blockId } = contextMenu;
    const blocks = editor.blocks;
    const index = blocks.findIndex((block) => block.id === blockId);
    if (index === -1) {
      setContextMenu(null);
      return;
    }

    let targetIndex = index;
    if (direction === "top") targetIndex = 0;
    else if (direction === "bottom") targetIndex = blocks.length - 1;
    else if (direction === "up") targetIndex = Math.max(0, index - 1);
    else targetIndex = Math.min(blocks.length - 1, index + 1);

    if (targetIndex !== index) {
      const reordered = [...blocks];
      const [moved] = reordered.splice(index, 1);
      reordered.splice(targetIndex, 0, moved);
      editor.reorderRootBlocks(reordered);
    }
    setContextMenu(null);
  }

  async function deletePage() {
    setDeleting(true);
    try {
      await editor.deletePage();
      router.push("/workspace");
    } catch {
      setDeleting(false);
    }
  }

  if (!editor.page) {
    return (
      <main className="dashboard-shell">
        <AppSidebar />
        <section className="dashboard-main">
          <div className="subpage-content">
            {editor.error ? <p className="page-error" role="alert">{editor.error}</p> : <div className="empty">Loading page…</div>}
          </div>
        </section>
      </main>
    );
  }

  const contextBlock = contextMenu ? findBlock(editor.blocks, contextMenu.blockId) : null;

  return (
    <main className="dashboard-shell">
      <AppSidebar />
      <section className="dashboard-main">
        <header className="dash-top">
          <div className="page-breadcrumb"><span>Studia</span> / <Link href="/workspace">Workspace</Link> / {editor.title || "Untitled page"}</div>
        </header>
        <div className="subpage-content">
          {editor.error && <p className="page-error" role="alert">{editor.error}</p>}
          <div className="subpage-title">
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="section-kicker">WORKSPACE PAGE</div>
              <input
                className="workspace-title-input"
                dir="auto"
                value={editor.title}
                onChange={(event) => editor.setTitleValue(event.target.value)}
                placeholder="Untitled page"
              />
              <div className="workspace-topic-link">
                <span className={`workspace-save-status ${editor.saveStatus}`}>
                  {editor.saveStatus === "saving" ? "Saving…" : editor.saveStatus === "saved" ? "Saved" : editor.saveStatus === "error" ? "Save failed" : ""}
                </span>
                <label>
                  Linked topic:{" "}
                  <select value={editor.page.topic_id ?? ""} onChange={(event) => void editor.linkTopic(event.target.value ? Number(event.target.value) : null)}>
                    <option value="">None</option>
                    {editor.topics.map((topic) => <option value={topic.id} key={topic.id}>{topic.title}</option>)}
                  </select>
                </label>
              </div>
            </div>
            <div className="page-actions">
              <button className="button button-secondary" onClick={() => setShowDeleteModal(true)}><Trash2 size={14} /> Delete page</button>
              <Link href="/workspace" className="back-topics">All pages</Link>
            </div>
          </div>

          <BlockList editor={editor} menus={menus} />
        </div>
      </section>

      <SlashMenu
        anchorRect={slashMenu?.rect ?? null}
        query={slashMenu?.query ?? ""}
        open={!!slashMenu}
        onSelect={handleSlashSelect}
        onClose={() => setSlashMenu(null)}
        registerKeyDownHandler={(handler) => (slashKeyHandlerRef.current = handler)}
      />

      <BlockContextMenu
        block={contextBlock}
        anchorRect={contextMenu?.rect ?? null}
        open={!!contextMenu}
        onClose={() => setContextMenu(null)}
        onTurnInto={(type) => {
          if (contextMenu) editor.turnInto(contextMenu.blockId, type);
          setContextMenu(null);
        }}
        onColor={handleColor}
        onDuplicate={() => {
          if (contextMenu) editor.duplicate(contextMenu.blockId);
          setContextMenu(null);
        }}
        onMove={handleMove}
        onDelete={() => {
          if (contextMenu) editor.removeBlock(contextMenu.blockId);
          setContextMenu(null);
        }}
        onAskAi={(rect) => {
          if (contextMenu) setAskAi({ blockId: contextMenu.blockId, rect });
          setContextMenu(null);
        }}
      />

      <LinkPasteMenu
        url={linkPasteMenu?.url ?? null}
        anchorRect={linkPasteMenu?.rect ?? null}
        open={!!linkPasteMenu}
        onClose={() => setLinkPasteMenu(null)}
        onChoose={(choice, preview) => {
          if (!linkPasteMenu) return;
          applyLinkChoice(choice, linkPasteMenu.url, preview);
          setLinkPasteMenu(null);
        }}
      />

      <AskAiPopover blockId={askAi?.blockId ?? null} anchorRect={askAi?.rect ?? null} open={!!askAi} editor={editor} onClose={() => setAskAi(null)} />

      {showDeleteModal && (
        <div className="modal-backdrop" onMouseDown={() => (deleting ? null : setShowDeleteModal(false))}>
          <div role="alertdialog" aria-modal="true" aria-labelledby="delete-page-title" className="topic-modal action-modal delete-modal" onMouseDown={(event) => event.stopPropagation()}>
            <button type="button" className="modal-close" disabled={deleting} onClick={() => setShowDeleteModal(false)}><X size={22} /></button>
            <div className="modal-icon delete-icon"><Trash2 size={22} /></div>
            <div className="eyebrow">REMOVE THIS PAGE</div>
            <h2 id="delete-page-title">Delete “{editor.page.title}”?</h2>
            <p>This permanently removes the page and everything on it. This can&apos;t be undone.</p>
            <div className="modal-actions">
              <button type="button" className="button button-secondary" disabled={deleting} onClick={() => setShowDeleteModal(false)}>Cancel</button>
              <button type="button" className="button button-danger" disabled={deleting} onClick={() => void deletePage()}>
                {deleting ? "Deleting…" : "Delete page"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );

  function applyLinkChoice(choice: "mention" | "embed" | "bookmark" | "url", url: string, preview: LinkPreview | null) {
    const blockId = linkPasteMenu?.blockId;
    if (!blockId) return;
    if (choice === "mention") {
      editor.updateBlockContent(blockId, "");
      editor.updateBlockProperties(blockId, { url, title: preview?.title || url });
    } else if (choice === "url") {
      editor.updateBlockContent(blockId, "");
      editor.updateBlockProperties(blockId, { url, title: url });
    } else if (choice === "embed") {
      editor.turnInto(blockId, "video");
      editor.updateBlockProperties(blockId, {
        url,
        title: preview?.title || url,
        youtubeId: preview?.youtubeId ?? null,
      });
    } else {
      editor.turnInto(blockId, "bookmark");
      editor.updateBlockProperties(blockId, {
        url,
        title: preview?.title || url,
        description: preview?.description ?? null,
        imageUrl: preview?.imageUrl ?? null,
        siteName: preview?.siteName ?? null,
      });
    }
  }
}

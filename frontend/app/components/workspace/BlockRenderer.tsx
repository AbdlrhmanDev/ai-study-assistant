"use client";

import { KeyboardEvent as ReactKeyboardEvent, useEffect, useState } from "react";
import { GripVertical, Plus } from "lucide-react";
import { BLOCK_DEF_MAP } from "./blockDefs";
import { caretOnFirstLine, caretOnLastLine, getCaretOffset, getCaretRect, getPlainText, placeCaret } from "./caret";
import { flattenVisible } from "./blockTree";
import { WorkspaceBlock } from "./types";
import BlockBody from "./BlockBody";
import { BlockMenus, WorkspaceContext, WorkspaceEditorApi, blockElementId, useWorkspaceContext } from "./workspaceContext";

export function BlockList({ editor, menus }: { editor: WorkspaceEditorApi; menus: BlockMenus }) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropHint, setDropHint] = useState<{ targetId: string; as: "sibling" | "child" } | null>(null);

  useEffect(() => {
    if (!editor.focusRequest) return;
    const { id, caret } = editor.focusRequest;
    const el = document.getElementById(blockElementId(id));
    if (el) placeCaret(el, caret);
    editor.clearFocusRequest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor.focusRequest]);

  return (
    <WorkspaceContext.Provider value={{ editor, menus, draggingId, setDraggingId, dropHint, setDropHint }}>
      <div className="workspace-blocks">
        {editor.blocks.map((block) => (
          <BlockNode block={block} depth={0} key={block.id} />
        ))}
        {!editor.blocks.length && (
          <div className="workspace-empty">This page is empty. Add a block below to get started.</div>
        )}
      </div>
    </WorkspaceContext.Provider>
  );
}

export function BlockNode({ block, depth }: { block: WorkspaceBlock; depth: number }) {
  const { editor, menus, draggingId, setDraggingId, dropHint, setDropHint } = useWorkspaceContext();
  const def = BLOCK_DEF_MAP[block.type];
  const collapsed = block.type === "toggle" && editor.collapsedIds.has(block.id);
  const isHighlighted = menus.highlightedBlockId === block.id;

  function focusSibling(direction: "previous" | "next") {
    const visible = flattenVisible(editor.blocks, editor.collapsedIds);
    const index = visible.indexOf(block.id);
    const targetId = direction === "previous" ? visible[index - 1] : visible[index + 1];
    if (!targetId) return false;
    const el = document.getElementById(blockElementId(targetId));
    if (!el) return false;
    placeCaret(el, direction === "previous" ? "end" : "start");
    return true;
  }

  function handleChange(text: string, el: HTMLDivElement) {
    editor.updateBlockContent(block.id, text);
    if (menus.slashMenuBlockId === block.id) {
      const before = text.slice(0, getCaretOffset(el));
      const match = /(?:^|\s)\/(\S*)$/.exec(before);
      if (match) menus.updateSlashQuery(match[1]);
      else menus.closeSlashMenu();
    }
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (menus.slashMenuBlockId === block.id && menus.handleSlashMenuKeyDown(event)) return;

    const el = event.currentTarget;

    if (event.key === "/" && menus.slashMenuBlockId !== block.id) {
      // Let the character insert first; once it's in the DOM, check whether
      // it actually started a slash token (not mid-URL) and open the menu.
      requestAnimationFrame(() => {
        const text = getPlainText(el);
        const offset = getCaretOffset(el);
        const before = text.slice(0, offset);
        if (/(?:^|\s)\/(\S*)$/.test(before)) {
          const rect = getCaretRect() ?? el.getBoundingClientRect();
          menus.openSlashMenu(block.id, rect, "");
        }
      });
      return;
    }

    if (event.key === "Enter" && !event.shiftKey && block.type !== "code" && menus.slashMenuBlockId !== block.id) {
      event.preventDefault();
      const offset = getCaretOffset(el);
      const text = getPlainText(el);
      editor.splitBlock(block.id, text.slice(0, offset), text.slice(offset));
      return;
    }

    if (event.key === "Backspace" && getCaretOffset(el) === 0) {
      const text = getPlainText(el);
      event.preventDefault();
      if (!text && !block.children.length) editor.removeBlock(block.id);
      else editor.mergeWithPrevious(block.id);
      return;
    }

    if (event.key === "ArrowUp" && caretOnFirstLine(el)) {
      if (focusSibling("previous")) event.preventDefault();
      return;
    }
    if (event.key === "ArrowDown" && caretOnLastLine(el)) {
      if (focusSibling("next")) event.preventDefault();
      return;
    }
    if (event.key === "Tab") {
      event.preventDefault();
      if (event.shiftKey) editor.outdent(block.id);
      else editor.indent(block.id);
      return;
    }
  }

  function handleDragOver(event: React.DragEvent) {
    if (!draggingId || draggingId === block.id) return;
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const isNest = event.clientX - rect.left > 36;
    setDropHint({ targetId: block.id, as: isNest ? "child" : "sibling" });
  }

  function handleDrop(event: React.DragEvent) {
    event.preventDefault();
    if (!draggingId || draggingId === block.id || !dropHint) return;
    if (dropHint.as === "child") editor.nestInto(draggingId, block.id);
    else editor.moveAfter(draggingId, block.id);
    setDraggingId(null);
    setDropHint(null);
  }

  const colorClasses = [
    block.properties.textColor && block.properties.textColor !== "default" ? `workspace-block-text-${block.properties.textColor}` : "",
    block.properties.backgroundColor && block.properties.backgroundColor !== "default" ? `workspace-block-bg-${block.properties.backgroundColor}` : "",
  ].filter(Boolean).join(" ");

  return (
    <div
      className={`workspace-block workspace-block-${block.type} ${colorClasses} ${isHighlighted ? "highlighted" : ""} ${dropHint?.targetId === block.id ? `drop-${dropHint.as}` : ""}`}
      style={{ marginLeft: depth * 26 }}
      id={`block-wrap-${block.id}`}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onContextMenu={(event) => {
        event.preventDefault();
        menus.openContextMenu(block.id, event.currentTarget.getBoundingClientRect());
      }}
    >
      {block.type === "toggle" && (
        <button
          type="button"
          className={`workspace-toggle-caret ${collapsed ? "collapsed" : ""}`}
          onClick={() => editor.toggleCollapsed(block.id)}
          aria-expanded={!collapsed}
          aria-label={collapsed ? "Expand toggle" : "Collapse toggle"}
        >
          <def.Icon size={14} />
        </button>
      )}
      <span
        className="workspace-block-handle"
        draggable
        onDragStart={() => setDraggingId(block.id)}
        onDragEnd={() => {
          setDraggingId(null);
          setDropHint(null);
        }}
        onClick={(event) => menus.openContextMenu(block.id, (event.currentTarget as HTMLElement).getBoundingClientRect())}
        role="button"
        tabIndex={0}
        aria-label={`Open block menu for ${def.label}`}
        aria-haspopup="menu"
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            menus.openContextMenu(block.id, (event.currentTarget as HTMLElement).getBoundingClientRect());
          }
        }}
      >
        <GripVertical size={14} />
      </span>
      <button
        type="button"
        className="workspace-block-add"
        onClick={() => editor.addBlockAfter(block.id, "text")}
        aria-label="Add block below"
      >
        <Plus size={14} />
      </button>
      <div className="workspace-block-body">
        <BlockBody block={block} onChange={handleChange} onKeyDown={handleKeyDown} elementId={blockElementId(block.id)} />
      </div>
      {!!block.children.length && !collapsed && (
        <div className="workspace-block-children">
          {block.children.map((child) => (
            <BlockNode block={child} depth={depth + 1} key={child.id} />
          ))}
        </div>
      )}
    </div>
  );
}

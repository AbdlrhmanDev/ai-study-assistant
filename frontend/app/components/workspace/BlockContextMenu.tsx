"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpToLine,
  ArrowDownToLine,
  Check,
  Copy,
  Link2,
  Palette,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react";
import { BLOCK_DEFS, searchBlockDefs } from "./blockDefs";
import { isEmptyBlock } from "./blockTree";
import { usePopoverPosition } from "./usePopoverPosition";
import { useClickOutside } from "./useClickOutside";
import { BlockColor, BlockType, WorkspaceBlock } from "./types";

const COLOR_SWATCHES: { value: BlockColor; label: string }[] = [
  { value: "default", label: "Default" },
  { value: "violet", label: "Violet" },
  { value: "coral", label: "Coral" },
  { value: "mint", label: "Mint" },
  { value: "success", label: "Green" },
  { value: "danger", label: "Red" },
  { value: "warning", label: "Amber" },
  { value: "info", label: "Blue" },
];

type Props = {
  block: WorkspaceBlock | null;
  anchorRect: DOMRect | null;
  open: boolean;
  onClose: () => void;
  onTurnInto: (type: BlockType) => void;
  onColor: (kind: "textColor" | "backgroundColor", color: BlockColor) => void;
  onDuplicate: () => void;
  onMove: (direction: "up" | "down" | "top" | "bottom") => void;
  onDelete: () => void;
  onAskAi: (rect: DOMRect) => void;
};

type Submenu = "none" | "turnInto" | "color" | "moveTo";

export default function BlockContextMenu({
  block,
  anchorRect,
  open,
  onClose,
  onTurnInto,
  onColor,
  onDuplicate,
  onMove,
  onDelete,
  onAskAi,
}: Props) {
  const { popoverRef, style } = usePopoverPosition(anchorRect, open);
  const [search, setSearch] = useState("");
  const [submenu, setSubmenu] = useState<Submenu>("none");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [copied, setCopied] = useState(false);
  const [flipLeft, setFlipLeft] = useState(false);
  const [wasOpen, setWasOpen] = useState(open);
  const triggerRefs = useRef<Record<string, HTMLElement | null>>({});

  useClickOutside(popoverRef, onClose, open);

  useEffect(() => {
    if (submenu === "none" || !popoverRef.current) return;
    const rect = popoverRef.current.getBoundingClientRect();
    setFlipLeft(rect.right + 226 > window.innerWidth);
  }, [submenu, popoverRef]);

  // Reset local state when the menu closes -- computed during render (see
  // AskAiPopover for the same pattern) instead of in an effect.
  if (open !== wasOpen) {
    setWasOpen(open);
    if (!open) {
      setSearch("");
      setSubmenu("none");
      setConfirmingDelete(false);
      setCopied(false);
    }
  }

  const filteredTurnInto = useMemo(() => searchBlockDefs(search), [search]);

  function copyLink() {
    if (!block) return;
    const url = `${window.location.origin}${window.location.pathname}#block-${block.id}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    }).catch(() => undefined);
  }

  if (!open || !block) return null;

  const showSearchResultsOnly = search.trim().length > 0;

  return (
    <div ref={popoverRef} style={style} className="workspace-context-menu" role="menu" aria-label="Block actions">
      <div className="workspace-context-search">
        <Search size={13} />
        <input
          autoFocus
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search actions..."
          aria-label="Search block actions"
        />
      </div>

      {showSearchResultsOnly ? (
        <div className="workspace-context-list">
          {filteredTurnInto.map((def) => (
            <button type="button" className="workspace-context-item" key={def.type} onClick={() => onTurnInto(def.type)} role="menuitem">
              <span><def.Icon size={15} /></span> Turn into {def.label}
            </button>
          ))}
          {!filteredTurnInto.length && <div className="workspace-context-empty">No matching actions</div>}
        </div>
      ) : (
        <div className="workspace-context-list">
          <MenuRow
            icon={<Sparkles size={15} />}
            label="Turn into"
            hasSubmenu
            active={submenu === "turnInto"}
            onEnter={() => setSubmenu("turnInto")}
            setRef={(el) => (triggerRefs.current.turnInto = el)}
          />
          <MenuRow
            icon={<Palette size={15} />}
            label="Color"
            hasSubmenu
            active={submenu === "color"}
            onEnter={() => setSubmenu("color")}
            setRef={(el) => (triggerRefs.current.color = el)}
          />
          <MenuRow icon={<Link2 size={15} />} label={copied ? "Copied!" : "Copy link to block"} onClick={copyLink} />
          <MenuRow icon={<Copy size={15} />} label="Duplicate" shortcut="Ctrl+D" onClick={onDuplicate} />
          <MenuRow
            icon={<ArrowDown size={15} />}
            label="Move to"
            hasSubmenu
            active={submenu === "moveTo"}
            onEnter={() => setSubmenu("moveTo")}
            setRef={(el) => (triggerRefs.current.moveTo = el)}
          />
          <MenuRow icon={<Sparkles size={15} />} label="Ask AI" onClick={(event) => onAskAi(event.currentTarget.getBoundingClientRect())} />
          <div className="workspace-context-divider" />
          {confirmingDelete ? (
            <div className="workspace-context-confirm">
              <span>Delete this block?</span>
              <div>
                <button type="button" className="button button-secondary" onClick={() => setConfirmingDelete(false)}>Cancel</button>
                <button type="button" className="button button-danger" onClick={onDelete}>Delete</button>
              </div>
            </div>
          ) : (
            <MenuRow
              icon={<Trash2 size={15} />}
              label="Delete"
              shortcut="Del"
              danger
              onClick={() => (isEmptyBlock(block) ? onDelete() : setConfirmingDelete(true))}
            />
          )}
        </div>
      )}

      {submenu === "turnInto" && (
        <div className={`workspace-context-submenu ${flipLeft ? "flip-left" : ""}`} role="menu" aria-label="Turn into">
          {BLOCK_DEFS.map((def) => (
            <button type="button" className="workspace-context-item" key={def.type} onClick={() => onTurnInto(def.type)} role="menuitem">
              <span><def.Icon size={15} /></span> {def.label}
              {def.type === block.type && <Check size={13} className="workspace-context-check" />}
            </button>
          ))}
        </div>
      )}

      {submenu === "color" && (
        <div className={`workspace-context-submenu ${flipLeft ? "flip-left" : ""}`} role="menu" aria-label="Color">
          <div className="workspace-context-submenu-label">TEXT COLOR</div>
          {COLOR_SWATCHES.map((swatch) => (
            <button type="button" className="workspace-context-item" key={`text-${swatch.value}`} onClick={() => onColor("textColor", swatch.value)} role="menuitem">
              <span className={`workspace-color-dot text-${swatch.value}`}>A</span> {swatch.label}
            </button>
          ))}
          <div className="workspace-context-submenu-label">BACKGROUND</div>
          {COLOR_SWATCHES.map((swatch) => (
            <button type="button" className="workspace-context-item" key={`bg-${swatch.value}`} onClick={() => onColor("backgroundColor", swatch.value)} role="menuitem">
              <span className={`workspace-color-dot bg-${swatch.value}`} /> {swatch.label}
            </button>
          ))}
        </div>
      )}

      {submenu === "moveTo" && (
        <div className={`workspace-context-submenu ${flipLeft ? "flip-left" : ""}`} role="menu" aria-label="Move to">
          <button type="button" className="workspace-context-item" onClick={() => onMove("top")} role="menuitem"><span><ArrowUpToLine size={15} /></span> Move to top</button>
          <button type="button" className="workspace-context-item" onClick={() => onMove("up")} role="menuitem"><span><ArrowUp size={15} /></span> Move up</button>
          <button type="button" className="workspace-context-item" onClick={() => onMove("down")} role="menuitem"><span><ArrowDown size={15} /></span> Move down</button>
          <button type="button" className="workspace-context-item" onClick={() => onMove("bottom")} role="menuitem"><span><ArrowDownToLine size={15} /></span> Move to bottom</button>
        </div>
      )}
    </div>
  );
}

function MenuRow({
  icon,
  label,
  shortcut,
  hasSubmenu,
  active,
  danger,
  onEnter,
  onClick,
  setRef,
}: {
  icon: React.ReactNode;
  label: string;
  shortcut?: string;
  hasSubmenu?: boolean;
  active?: boolean;
  danger?: boolean;
  onEnter?: () => void;
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  setRef?: (el: HTMLButtonElement | null) => void;
}) {
  return (
    <button
      type="button"
      ref={setRef}
      className={`workspace-context-item ${active ? "active" : ""} ${danger ? "danger" : ""}`}
      role="menuitem"
      onMouseEnter={onEnter}
      onClick={onClick}
    >
      <span>{icon}</span>
      <span className="workspace-context-item-label">{label}</span>
      {shortcut && <span className="workspace-context-shortcut">{shortcut}</span>}
      {hasSubmenu && <ArrowUp size={12} className="workspace-context-caret" />}
    </button>
  );
}

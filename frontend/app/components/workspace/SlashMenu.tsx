"use client";

import { KeyboardEvent as ReactKeyboardEvent, useEffect, useRef, useState } from "react";
import { searchBlockDefs } from "./blockDefs";
import { BlockType } from "./types";
import { usePopoverPosition } from "./usePopoverPosition";

type Props = {
  anchorRect: DOMRect | null;
  query: string;
  open: boolean;
  onSelect: (type: BlockType) => void;
  onClose: () => void;
  registerKeyDownHandler: (handler: (event: ReactKeyboardEvent) => boolean) => void;
};

export default function SlashMenu({ anchorRect, query, open, onSelect, onClose, registerKeyDownHandler }: Props) {
  const results = searchBlockDefs(query);
  const [activeIndex, setActiveIndex] = useState(0);
  const [prevQuery, setPrevQuery] = useState(query);
  const { popoverRef, style } = usePopoverPosition(anchorRect, open);
  const listRef = useRef<HTMLDivElement>(null);

  // Reset the highlighted item whenever the filter text changes -- computed
  // during render rather than in an effect, so it can't cascade an extra
  // render (React's "adjusting state when a prop changes" pattern).
  if (query !== prevQuery) {
    setPrevQuery(query);
    setActiveIndex(0);
  }

  useEffect(() => {
    registerKeyDownHandler((event) => {
      if (!open || !results.length) return false;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((index) => (index + 1) % results.length);
        return true;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((index) => (index - 1 + results.length) % results.length);
        return true;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        const picked = results[activeIndex];
        if (picked) onSelect(picked.type);
        return true;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return true;
      }
      return false;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, results, activeIndex]);

  useEffect(() => {
    const active = listRef.current?.querySelector<HTMLElement>('[data-active="true"]');
    active?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  if (!open) return null;

  return (
    <div
      ref={popoverRef}
      style={style}
      className="workspace-slash-menu"
      role="listbox"
      aria-label="Block type commands"
    >
      <div className="workspace-slash-menu-label">BASIC BLOCKS</div>
      <div className="workspace-slash-menu-list" ref={listRef}>
        {results.map((def, index) => (
          <button
            type="button"
            key={def.type}
            role="option"
            aria-selected={index === activeIndex}
            data-active={index === activeIndex}
            className={`workspace-slash-menu-item ${index === activeIndex ? "active" : ""}`}
            onMouseEnter={() => setActiveIndex(index)}
            onClick={() => onSelect(def.type)}
          >
            <span className="workspace-slash-menu-icon"><def.Icon size={16} /></span>
            <span className="workspace-slash-menu-text">
              <b>{def.label}</b>
              <small>{def.description}</small>
            </span>
          </button>
        ))}
        {!results.length && <div className="workspace-slash-menu-empty">No matching blocks</div>}
      </div>
    </div>
  );
}

import { CSSProperties, useLayoutEffect, useRef, useState } from "react";

/** Positions a floating panel at a fixed viewport coordinate near `anchorRect`,
 * clamped so it never overflows the viewport -- correct even inside a
 * scrollable ancestor, since `position:fixed` is relative to the viewport,
 * not the nearest positioned ancestor. Measures the panel itself after it
 * mounts (its size isn't known up front), so the panel starts hidden for
 * one layout pass. */
export function usePopoverPosition(anchorRect: DOMRect | null, open: boolean) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<CSSProperties>({ visibility: "hidden", position: "fixed", top: 0, left: 0 });

  useLayoutEffect(() => {
    if (!open || !anchorRect || !popoverRef.current) {
      setStyle({ visibility: "hidden", position: "fixed", top: 0, left: 0 });
      return;
    }

    const popover = popoverRef.current;
    const width = popover.offsetWidth;
    const height = popover.offsetHeight;
    const margin = 8;

    let top = anchorRect.bottom + margin;
    let left = anchorRect.left;

    if (left + width > window.innerWidth - margin) {
      left = Math.max(margin, window.innerWidth - width - margin);
    }
    if (left < margin) left = margin;

    if (top + height > window.innerHeight - margin) {
      const above = anchorRect.top - height - margin;
      top = above > margin ? above : Math.max(margin, window.innerHeight - height - margin);
    }

    setStyle({ position: "fixed", top, left, visibility: "visible" });
  }, [open, anchorRect]);

  return { popoverRef, style };
}

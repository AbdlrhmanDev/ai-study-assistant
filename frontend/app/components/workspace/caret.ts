/** Caret/selection helpers for plain-text contentEditable blocks. No rich
 * HTML is ever stored -- these all operate on `.textContent`. */

export function getPlainText(el: HTMLElement): string {
  return el.textContent ?? "";
}

export function getTextBeforeCaret(el: HTMLElement): string {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return "";
  const range = selection.getRangeAt(0).cloneRange();
  range.collapse(true);
  const preRange = document.createRange();
  preRange.selectNodeContents(el);
  try {
    preRange.setEnd(range.endContainer, range.endOffset);
  } catch {
    return "";
  }
  return preRange.toString();
}

export function getCaretOffset(el: HTMLElement): number {
  return getTextBeforeCaret(el).length;
}

export function getCaretRect(): DOMRect | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0).cloneRange();
  range.collapse(true);
  const rects = range.getClientRects();
  if (rects.length) return rects[0];

  const marker = document.createElement("span");
  marker.appendChild(document.createTextNode("​"));
  range.insertNode(marker);
  const rect = marker.getBoundingClientRect();
  marker.parentNode?.removeChild(marker);
  return rect;
}

export function placeCaret(el: HTMLElement, position: "start" | "end" | number) {
  el.focus();
  const selection = window.getSelection();
  if (!selection) return;
  const range = document.createRange();
  range.selectNodeContents(el);
  if (position === "start") {
    range.collapse(true);
  } else if (position === "end") {
    range.collapse(false);
  } else {
    const textNode = el.firstChild;
    if (textNode && textNode.nodeType === Node.TEXT_NODE) {
      const offset = Math.min(position, textNode.textContent?.length ?? 0);
      range.setStart(textNode, offset);
      range.setEnd(textNode, offset);
    } else {
      range.collapse(true);
    }
  }
  selection.removeAllRanges();
  selection.addRange(range);
}

/** True when the caret sits on the first visual line of `el` (used to decide
 * whether ArrowUp should move focus to the previous block). */
export function caretOnFirstLine(el: HTMLElement): boolean {
  const caretRect = getCaretRect();
  if (!caretRect) return true;
  const elRect = el.getBoundingClientRect();
  const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || 20;
  return caretRect.top - elRect.top < lineHeight * 0.6;
}

/** True when the caret sits on the last visual line of `el` (ArrowDown). */
export function caretOnLastLine(el: HTMLElement): boolean {
  const caretRect = getCaretRect();
  if (!caretRect) return true;
  const elRect = el.getBoundingClientRect();
  const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || 20;
  return elRect.bottom - caretRect.bottom < lineHeight * 0.6;
}

/** Detects an active `/query` slash command ending at the caret -- only
 * triggers when the "/" starts a token (block start or preceded by
 * whitespace), so URLs like `https://x.com` don't open the menu. */
export function activeSlashQuery(el: HTMLElement): string | null {
  const before = getTextBeforeCaret(el);
  const match = /(?:^|\s)\/(\S*)$/.exec(before);
  return match ? match[1] : null;
}

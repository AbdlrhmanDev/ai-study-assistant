"use client";

import { useEffect, useRef } from "react";

/**
 * Every dialog in this app already uses `role="dialog"`/`role="alertdialog"`
 * consistently (modals, the command palette, popovers) but none of them
 * actually constrained Tab order -- a keyboard user could tab straight out
 * into the page behind an open modal. Rather than wiring a focus trap into
 * each of the ~20+ call sites, this single always-mounted component watches
 * the DOM for any dialog appearing/disappearing and traps Tab/Shift+Tab
 * within whichever one is topmost, restoring focus to whatever opened it
 * once it closes.
 *
 * Escape also closes the topmost dialog, but *not* via a synthetic
 * dispatched mousedown on the backdrop -- an earlier version of this did
 * that and reproducibly froze the page. Instead it calls the real DOM
 * `.click()` method on the dialog's own `.modal-close` button (the same
 * element a mouse user would click), which goes through the normal event
 * pipeline instead of a hand-built MouseEvent and is a no-op on dialogs
 * with no such button (e.g. the command palette, which already closes
 * itself on Escape) or while that button is `disabled` (an in-flight
 * delete, matching the backdrop-click guard those dialogs already have).
 */
const DIALOG_SELECTOR = '[role="dialog"], [role="alertdialog"]';
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function GlobalDialogFocusTrap() {
  const lastTriggerRef = useRef<HTMLElement | null>(null);
  const openDialogsRef = useRef<Set<Element>>(new Set());
  // Tracks the focus change immediately preceding the current one. A dialog
  // opened via `autoFocus` moves focus into itself synchronously, before the
  // MutationObserver callback below (always async) gets a chance to read
  // `document.activeElement` -- by then it's already the dialog's own field,
  // not the button that opened it. `focusin` fires synchronously on every
  // focus change, so `previousFocusRef` reliably lags one step behind and
  // still holds the trigger at the moment the dialog's field steals focus.
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const currentFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    function onFocusIn(event: FocusEvent) {
      previousFocusRef.current = currentFocusRef.current;
      currentFocusRef.current = event.target as HTMLElement | null;
    }
    document.addEventListener("focusin", onFocusIn, true);

    function topmostDialog(): HTMLElement | null {
      const dialogs = document.querySelectorAll<HTMLElement>(DIALOG_SELECTOR);
      return dialogs.length ? dialogs[dialogs.length - 1] : null;
    }

    function focusFirst(dialog: HTMLElement) {
      const focusable = dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      (focusable[0] ?? dialog).focus();
    }

    const observer = new MutationObserver(() => {
      const current = new Set(Array.from(document.querySelectorAll(DIALOG_SELECTOR)));

      for (const node of current) {
        if (!openDialogsRef.current.has(node)) {
          // A dialog just appeared -- remember what had focus so it can be
          // restored on close, and move focus into the dialog. Deferred a
          // tick so the dialog's own content has actually painted.
          lastTriggerRef.current = previousFocusRef.current ?? (document.activeElement as HTMLElement | null);
          window.setTimeout(() => focusFirst(node as HTMLElement), 0);
        }
      }
      if (openDialogsRef.current.size > 0 && current.size === 0) {
        lastTriggerRef.current?.focus?.();
      }
      openDialogsRef.current = current;
    });
    observer.observe(document.body, { childList: true, subtree: true });

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        const dialog = topmostDialog();
        const closeButton = dialog?.querySelector<HTMLButtonElement>(".modal-close");
        closeButton?.click();
        return;
      }
      if (event.key !== "Tab") return;
      const dialog = topmostDialog();
      if (!dialog) return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (!active || !dialog.contains(active)) {
        event.preventDefault();
        first.focus();
        return;
      }
      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);

    return () => {
      observer.disconnect();
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return null;
}

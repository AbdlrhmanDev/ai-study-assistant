import { KeyboardEvent, useLayoutEffect, useRef } from "react";
import { getPlainText } from "./caret";

type Props = {
  id?: string;
  value: string;
  onChange: (text: string, element: HTMLDivElement) => void;
  onKeyDown?: (event: KeyboardEvent<HTMLDivElement>) => void;
  onPaste?: (event: React.ClipboardEvent<HTMLDivElement>) => void;
  onFocus?: () => void;
  className?: string;
  placeholder?: string;
  autoFocus?: boolean;
  dir?: "auto" | "ltr" | "rtl";
};

/** A plain-text contentEditable primitive shared by every text-bearing
 * block type. Only ever stores/produces plain text (no inline rich
 * formatting is required by this editor), which sidesteps HTML
 * sanitization entirely. Uses `dir="auto"` so RTL/LTR is detected
 * per-block from its own content, matching the browser's native bidi
 * algorithm rather than a custom Arabic-range heuristic. */
export default function EditableText({
  id,
  value,
  onChange,
  onKeyDown,
  onPaste,
  onFocus,
  className,
  placeholder,
  autoFocus,
  dir = "auto",
}: Props) {
  const ref = useRef<HTMLDivElement>(null);

  // Only touch the DOM when the controlled value actually diverges from
  // what's currently rendered -- on a normal keystroke, onInput already
  // pushed the same text up through onChange, so this is a no-op and the
  // live cursor position is never disturbed.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (getPlainText(el) !== value) {
      el.textContent = value;
    }
  }, [value]);

  useLayoutEffect(() => {
    if (autoFocus) ref.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      id={id}
      ref={ref}
      className={className}
      contentEditable
      suppressContentEditableWarning
      dir={dir}
      data-placeholder={placeholder}
      onInput={(event) => onChange(getPlainText(event.currentTarget), event.currentTarget)}
      onKeyDown={onKeyDown}
      onPaste={onPaste}
      onFocus={onFocus}
    />
  );
}

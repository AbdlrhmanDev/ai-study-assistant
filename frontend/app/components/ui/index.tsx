import Link from "next/link";
import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function Card({ className, interactive = false, children, ...props }: HTMLAttributes<HTMLElement> & { interactive?: boolean }) {
  return <section className={cx("ui-card", interactive && "ui-card-interactive", className)} {...props}>{children}</section>;
}

export function StatCard({ label, value, detail, Icon, tone = "neutral", className }: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  Icon?: LucideIcon;
  tone?: "neutral" | "accent" | "success" | "warning" | "danger" | "info";
  className?: string;
}) {
  return (
    <article className={cx("ui-card", "ui-stat-card", className)}>
      {Icon && <span className={cx("ui-stat-icon", `tone-${tone}`)}><Icon size={20} strokeWidth={1.8} aria-hidden="true" /></span>}
      <div><span className="ui-label">{label}</span><strong>{value}</strong>{detail && <p>{detail}</p>}</div>
    </article>
  );
}

export function Badge({ children, tone = "neutral", className }: { children: ReactNode; tone?: "neutral" | "accent" | "success" | "warning" | "danger" | "info"; className?: string }) {
  return <span className={cx("ui-badge", `tone-${tone}`, className)}>{children}</span>;
}

export function ActionTile({ Icon, title, description, selected = false, onClick, onIntent }: {
  Icon: LucideIcon;
  title: string;
  description: string;
  selected?: boolean;
  onClick: () => void;
  onIntent?: () => void;
}) {
  return (
    <button type="button" role="tab" aria-selected={selected} className={cx("ui-action-tile", selected && "selected")} onClick={onClick} onPointerEnter={onIntent} onFocus={onIntent}>
      <span className="ui-action-icon"><Icon size={20} strokeWidth={1.8} aria-hidden="true" /></span>
      <span><strong>{title}</strong><small>{description}</small></span>
    </button>
  );
}

export function ListRow({ leading, title, description, meta, actions, className }: {
  leading?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <article className={cx("ui-list-row", className)}>
      {leading && <span className="ui-list-leading">{leading}</span>}
      <div className="ui-list-content"><h3>{title}</h3>{description && <div className="ui-list-description">{description}</div>}{meta && <div className="ui-list-meta">{meta}</div>}</div>
      {actions && <div className="ui-list-actions">{actions}</div>}
    </article>
  );
}

export function ProgressBar({ value, label, detail }: { value: number; label: string; detail?: ReactNode }) {
  const safeValue = Math.max(0, Math.min(100, value));
  return (
    <div className="ui-progress">
      <div className="ui-progress-label"><strong>{label}</strong><span>{safeValue}%</span></div>
      <div className="ui-progress-track" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={safeValue}><span style={{ width: `${safeValue}%` }} /></div>
      {detail && <div className="ui-progress-detail">{detail}</div>}
    </div>
  );
}

export function MasteryBar({ label, value }: { label: string; value: number }) {
  const percent = Math.max(0, Math.min(100, Math.round(value)));
  const level = percent <= 33 ? "low" : percent <= 66 ? "medium" : "high";
  return (
    <div className="ui-mastery-row">
      <span title={label}>{label}</span>
      <div className={`ui-mastery-track ${level}`} role="progressbar" aria-label={`${label} mastery`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}><i style={{ width: `${percent}%` }} /></div>
      <strong>{percent}%</strong>
    </div>
  );
}

export function Button({ href, variant = "secondary", className, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & {
  href?: string;
  variant?: "primary" | "secondary" | "ghost" | "danger";
}) {
  const classes = cx("ui-button", `ui-button-${variant}`, className);
  if (href) return <Link className={classes} href={href}>{children}</Link>;
  return <button className={classes} {...props}>{children}</button>;
}

export function EmptyState({ Icon, title, description, action, compact = false }: {
  Icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={cx("ui-empty-state", compact && "compact")} role="status">
      {Icon && <span className="ui-empty-icon"><Icon size={22} strokeWidth={1.7} aria-hidden="true" /></span>}
      <div><h3>{title}</h3>{description && <p>{description}</p>}</div>
      {action && <div className="ui-empty-action">{action}</div>}
    </div>
  );
}

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="ui-loading-state" role="status" aria-label={label}>
      <div className="ui-loading-copy"><i aria-hidden="true" />{label}</div>
      <div className="ui-loading-skeleton" aria-hidden="true">
        {[0, 1, 2].map((index) => (
          <i key={index}>
            <span className="ui-skeleton-icon" />
            <span className="ui-skeleton-line ui-skeleton-line-title" />
            <span className="ui-skeleton-line ui-skeleton-line-sub" />
          </i>
        ))}
      </div>
    </div>
  );
}

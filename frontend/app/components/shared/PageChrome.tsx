"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ReactNode, useCallback, useEffect, useState } from "react";
import { PartyPopper, Sparkles } from "lucide-react";
import AppSidebar from "../AppSidebar";
import { ApiError } from "../../lib/api";

export function PageShell({
  children,
  title,
  subtitle,
  action,
  className,
}: {
  children: ReactNode;
  title: string;
  subtitle: string;
  action?: ReactNode;
  className?: string;
}) {
  const params = useSearchParams();
  const [isFramed, setIsFramed] = useState(false);
  const embedded = params.get("embedded") === "1" || isFramed;

  useEffect(() => {
    setIsFramed(window.self !== window.top);
  }, []);

  if (embedded) {
    return (
      <main className={`embedded-tool-page${className ? ` ${className}` : ""}`}>
        <div className="embedded-tool-heading"><div className="section-kicker">TOPIC TOOL</div><h1>{title}</h1><p>{subtitle}</p>{action}</div>
        {children}
      </main>
    );
  }

  return (
    <main className={`dashboard-shell${className ? ` ${className}` : ""}`}>
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <AppSidebar />
      <section className="dashboard-main" id="main-content" tabIndex={-1}>
        <header className="dash-top">
          <div className="page-breadcrumb"><span>Studia</span> / {title}</div>
        </header>
        <div className="subpage-content">
          <div className="subpage-title">
            <div><div className="section-kicker">YOUR LEARNING SPACE</div><h1>{title}</h1><p>{subtitle}</p></div>
            {action}
          </div>
          {children}
        </div>
      </section>
    </main>
  );
}

export type XpAward = { xpEarned: number; leveledUp: boolean; newLevelName: string | null };

export function XpToast({ award, onDismiss }: { award: XpAward; onDismiss: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(onDismiss, 3400);
    return () => window.clearTimeout(timer);
  }, [onDismiss]);

  if (award.xpEarned <= 0) return null;

  return (
    <div className={`xp-toast${award.leveledUp ? " level-up" : ""}`} role="status">
      {award.leveledUp ? (
        <>
          <span className="xp-toast-icon"><PartyPopper size={18} /></span>
          <div><strong>Level up!</strong><p>Now {award.newLevelName}</p></div>
        </>
      ) : (
        <>
          <span className="xp-toast-icon"><Sparkles size={18} /></span>
          <div><strong>+{award.xpEarned} XP</strong></div>
        </>
      )}
    </div>
  );
}

export function useAuthFailure() {
  const router = useRouter();
  return useCallback((error: unknown) => {
    if (error instanceof ApiError && error.status === 401) {
      router.replace("/login");
    }
  }, [router]);
}

export type DocumentStatus = "pending" | "processing" | "completed" | "failed";

export type StudyDocument = {
  id: number;
  topic_id: number;
  title: string;
  original_filename: string;
  content_type: string;
  status: DocumentStatus;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

export const DOCUMENT_STATUS_LABELS: Record<DocumentStatus, string> = {
  pending: "Pending",
  processing: "Processing…",
  completed: "Ready",
  failed: "Failed",
};

export function documentTypeBadge(contentType: string): string {
  if (contentType === "application/pdf") return "PDF";
  if (contentType === "text/plain") return "TXT";
  return "FILE";
}

export function humanizeFilename(filename: string): { label: string; ext: string } {
  const dot = filename.lastIndexOf(".");
  const base = dot > -1 ? filename.slice(0, dot) : filename;
  const ext = dot > -1 ? filename.slice(dot + 1).toUpperCase() : "";
  return { label: base.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim(), ext };
}

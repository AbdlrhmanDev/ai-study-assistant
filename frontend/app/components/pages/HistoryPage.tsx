"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BookOpen,
  Check,
  Download,
  FolderInput,
  Pencil,
  Sparkles,
  StickyNote,
} from "lucide-react";
import {
  api,
  downloadFile,
  messageFromError,
  Pagination,
} from "../../lib/api";
import { PageShell, useAuthFailure } from "../shared/PageChrome";
import { Button, EmptyState, LoadingState, StatCard } from "../ui";

type StudyActivity = {
  id: number;
  topic_id: number | null;
  topic_title: string | null;
  activity_type:
    | "topic_created"
    | "topic_updated"
    | "note_created"
    | "note_updated"
    | "note_moved"
    | "ai_chat";
  description: string;
  created_at: string;
};

type StudyStats = {
  total_activities: number;
  activities_this_week: number;
  ai_interactions: number;
  topics_studied: number;
};

export function HistoryPage() {
  const handleAuthFailure = useAuthFailure();
  const [activities, setActivities] = useState<StudyActivity[]>([]);
  const [stats, setStats] = useState<StudyStats | null>(null);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [page, setPage] = useState(1);
  const [type, setType] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const typeQuery = type ? `&type=${type}` : "";

    try {
      const [historyResult, statsResult] = await Promise.all([
        api<{ activities: StudyActivity[]; pagination: Pagination }>(
          `/study-history?page=${page}&limit=20${typeQuery}`,
        ),
        api<{ stats: StudyStats }>("/study-history/stats"),
      ]);
      setActivities(historyResult.activities);
      setPagination(historyResult.pagination);
      setStats(statsResult.stats);
    } catch (requestError) {
      handleAuthFailure(requestError);
      setError(messageFromError(requestError));
    } finally {
      setLoading(false);
    }
  }, [handleAuthFailure, page, type]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const groupedActivities = activities.reduce<Record<string, StudyActivity[]>>(
    (groups, activity) => {
      const date = new Date(activity.created_at);
      const today = new Date();
      const yesterday = new Date();
      yesterday.setDate(today.getDate() - 1);
      let label = date.toLocaleDateString(undefined, {
        month: "long",
        day: "numeric",
        year: date.getFullYear() !== today.getFullYear()
          ? "numeric"
          : undefined,
      });

      if (date.toDateString() === today.toDateString()) label = "Today";
      if (date.toDateString() === yesterday.toDateString()) label = "Yesterday";
      (groups[label] ??= []).push(activity);
      return groups;
    },
    {},
  );

  const icons: Partial<Record<StudyActivity["activity_type"], typeof BookOpen>> = {
    topic_created: BookOpen,
    topic_updated: Pencil,
    note_created: StickyNote,
    note_updated: Check,
    note_moved: FolderInput,
    ai_chat: Sparkles,
  };

  async function downloadProgressReport() {
    try {
      await downloadFile("/reports/progress?format=pdf", "progress-report.pdf");
    } catch (requestError) {
      setError(messageFromError(requestError));
    }
  }

  return (
    <PageShell
      className="study-history-page"
      title="Study history"
      subtitle="A real record of your learning activity."
      action={<Button variant="primary" onClick={() => void downloadProgressReport()}><Download size={15} /> Download progress report</Button>}
    >
      {error && <p className="page-error" role="alert">{error}</p>}
      <div className="history-stats">
        <StatCard label="This week" value={stats?.activities_this_week ?? 0} detail="learning activities" />
        <StatCard label="All activity" value={stats?.total_activities ?? 0} detail="recorded actions" />
        <StatCard label="Topics studied" value={stats?.topics_studied ?? 0} detail={`${stats?.ai_interactions ?? 0} AI interactions`} />
      </div>
      <div className="history-filters filter-pills">
        {[
          ["", "All activity"],
          ["ai_chat", "AI tutor"],
          ["note_created", "New notes"],
          ["note_updated", "Updated notes"],
          ["topic_created", "Topics"],
        ].map(([value, label]) => (
          <button
            className={type === value ? "active" : ""}
            aria-pressed={type === value}
            onClick={() => { setType(value); setPage(1); }}
            key={value}
          >
            {label}
          </button>
        ))}
      </div>
      <section className="history-timeline">
        {loading ? <LoadingState label="Loading your study history…" /> : (
          <>
            {Object.entries(groupedActivities).map(([day, dayActivities]) => (
              <div className="history-day" key={day}>
                <h2>{day}</h2>
                {dayActivities.map((activity) => {
                  const ActivityIcon = icons[activity.activity_type] ?? BookOpen;
                  return (
                  <article key={activity.id}>
                    <span className={`history-icon ${activity.activity_type}`}>
                      <ActivityIcon size={16} strokeWidth={1.8} />
                    </span>
                    <div>
                      <h3>{activity.topic_title || "Deleted topic"}</h3>
                      <p>{activity.description}</p>
                    </div>
                    <time dateTime={activity.created_at}>{new Date(activity.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time>
                  </article>
                  );
                })}
              </div>
            ))}
            {!activities.length && <EmptyState Icon={BookOpen} title="No study activity yet" description="Your notes, topic updates, and tutor sessions will appear here as you study." />}
          </>
        )}
        {pagination && pagination.totalPages > 1 && (
          <div className="pagination">
            <button disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Previous</button>
            <span>Page {page} of {pagination.totalPages}</span>
            <button disabled={page >= pagination.totalPages} onClick={() => setPage((current) => current + 1)}>Next</button>
          </div>
        )}
      </section>
    </PageShell>
  );
}

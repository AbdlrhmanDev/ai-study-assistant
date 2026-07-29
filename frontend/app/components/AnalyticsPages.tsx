"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Clock, Flame, Layers, Target } from "lucide-react";
import { PageShell, useAuthFailure } from "./BackendPages";
import { api, messageFromError } from "../lib/api";

type ActivityTrendPoint = { date: string; count: number };

type MasterySummary = {
  totalConcepts: number;
  averageMastery: number | null;
  weakCount: number;
  strongCount: number;
};

type WeakestConcept = {
  conceptId: number;
  conceptName: string;
  topicId: number;
  topicTitle: string;
  masteryScore: number;
};

type TopicBreakdownRow = {
  topicId: number;
  title: string;
  conceptCount: number;
  averageMastery: number | null;
  levelName: string;
  totalXp: number;
};

type AnalyticsOverview = {
  totalActivities: number;
  activitiesThisWeek: number;
  aiInteractions: number;
  topicsStudied: number;
  currentStreak: number;
  longestStreak: number;
  totalXp: number;
  overallLevelName: string;
  activityTrend: ActivityTrendPoint[];
  mastery: MasterySummary;
  weakestConcepts: WeakestConcept[];
  topics: TopicBreakdownRow[];
};

const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

export function AnalyticsPage() {
  const handleAuthFailure = useAuthFailure();
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<AnalyticsOverview>("/analytics/overview")
      .then(setOverview)
      .catch((requestError) => {
        handleAuthFailure(requestError);
        setError(messageFromError(requestError));
      })
      .finally(() => setLoading(false));
  }, [handleAuthFailure]);

  const maxTrendCount = overview ? Math.max(1, ...overview.activityTrend.map((point) => point.count)) : 1;

  return (
    <PageShell title="Analytics" subtitle="A platform-wide view of your progress and habits.">
      {error && <p className="page-error" role="alert">{error}</p>}
      {loading || !overview ? (
        <div className="empty">Loading your analytics…</div>
      ) : (
        <>
          <div className="stats">
            <article>
              <span className="stat-icon violet"><Clock size={18} strokeWidth={1.8} /></span>
              <div>
                <small>THIS WEEK</small>
                <strong>{overview.activitiesThisWeek}</strong>
                <p>activities logged</p>
              </div>
            </article>
            <article>
              <span className="stat-icon fire"><Flame size={18} strokeWidth={1.8} /></span>
              <div>
                <small>STREAK</small>
                <strong>{overview.currentStreak}</strong>
                <p>day{overview.currentStreak === 1 ? "" : "s"} · best {overview.longestStreak}</p>
              </div>
            </article>
            <article>
              <span className="stat-icon mint"><Layers size={18} strokeWidth={1.8} /></span>
              <div>
                <small>TOTAL XP</small>
                <strong>{overview.totalXp}</strong>
                <p>{overview.overallLevelName}</p>
              </div>
            </article>
            <article>
              <span className="stat-icon coral"><Target size={18} strokeWidth={1.8} /></span>
              <div>
                <small>AVG MASTERY</small>
                <strong>
                  {overview.mastery.averageMastery === null ? "—" : `${Math.round(overview.mastery.averageMastery * 100)}%`}
                </strong>
                <p>{overview.mastery.totalConcepts} concept{overview.mastery.totalConcepts === 1 ? "" : "s"} tracked</p>
              </div>
            </article>
          </div>

          <div className="dashboard-grid analytics-grid">
            <section className="topics-section">
              <div className="section-head">
                <div><h2>Topic breakdown</h2><p>Mastery and XP per topic.</p></div>
              </div>
              {overview.topics.length === 0 ? (
                <div className="empty">Create a topic and start studying to see a breakdown here.</div>
              ) : (
                <div className="analytics-topic-table">
                  {overview.topics.map((topic) => (
                    <Link className="analytics-topic-row" href={`/topic?id=${topic.topicId}`} key={topic.topicId}>
                      <div className="analytics-topic-name">
                        <h3>{topic.title}</h3>
                        <small>{topic.conceptCount} concept{topic.conceptCount === 1 ? "" : "s"} · {topic.levelName} · {topic.totalXp} XP</small>
                      </div>
                      <div className="weak-concept-bar-track">
                        <div
                          className="weak-concept-bar-fill"
                          style={{ width: `${topic.averageMastery === null ? 0 : Math.round(topic.averageMastery * 100)}%` }}
                        />
                      </div>
                      <span className="weak-concept-value">
                        {topic.averageMastery === null ? "—" : `${Math.round(topic.averageMastery * 100)}%`}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </section>

            <aside className="weekly-card">
              <div className="section-head"><div><h3>Activity trend</h3><p>Last 7 days</p></div></div>
              <div className="large-week-bars">
                {overview.activityTrend.map((point) => {
                  const dayIndex = new Date(point.date).getDay();
                  const isToday = point.date === overview.activityTrend[overview.activityTrend.length - 1].date;
                  const height = Math.max(6, Math.round((point.count / maxTrendCount) * 100));
                  return (
                    <div key={point.date} title={`${point.date}: ${point.count}`}>
                      <i style={{ height: `${height}%` }} className={isToday ? "today" : ""} />
                      <span>{DAY_LABELS[dayIndex]}</span>
                    </div>
                  );
                })}
              </div>
            </aside>
          </div>

          <section className="weak-concepts-panel topics-section">
            <div className="section-head">
              <div><h2>Needs the most attention</h2><p>Your lowest-mastery concepts across every topic.</p></div>
            </div>
            {overview.weakestConcepts.length === 0 ? (
              <div className="empty">No weak spots detected yet — keep studying to build a mastery picture.</div>
            ) : (
              <div className="weak-concept-list">
                {overview.weakestConcepts.map((concept) => (
                  <div className="weak-concept-row" key={concept.conceptId}>
                    <span className="weak-concept-name" title={concept.conceptName}>{concept.conceptName}</span>
                    <div className="weak-concept-bar-track">
                      <div
                        className={`weak-concept-bar-fill${concept.masteryScore < 0.4 ? " weak" : ""}`}
                        style={{ width: `${Math.round(concept.masteryScore * 100)}%` }}
                      />
                    </div>
                    <span className="weak-concept-value">{Math.round(concept.masteryScore * 100)}%</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </PageShell>
  );
}

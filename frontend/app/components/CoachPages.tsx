"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { Check, RefreshCw } from "lucide-react";
import { PageShell, useAuthFailure } from "./BackendPages";
import { api, Topic, messageFromError } from "../lib/api";

export type PlanTaskStatus = "pending" | "completed" | "skipped";

export type PlanTask = {
  id: number;
  topicId: number;
  conceptId: number | null;
  title: string;
  estimatedMinutes: number;
  orderIndex: number;
  status: PlanTaskStatus;
};

export type StudyPlan = {
  id: number;
  planDate: string;
  narrative: string;
  tasks: PlanTask[];
};

type StudyGoal = { topicId: number; examDate: string | null; availableMinutesPerDay: number | null };

type PredictionStatus = "no_data" | "no_deadline" | "on_track" | "at_risk" | "behind";

type GoalPrediction = {
  topicId: number;
  topicTitle: string;
  examDate: string | null;
  conceptCount: number;
  status: PredictionStatus;
  readiness: number | null;
  predictedMastery: number | null;
  requiredDailyGain: number | null;
  daysRemaining: number | null;
  narrative: string;
};

const STATUS_LABELS: Record<PredictionStatus, string> = {
  no_data: "Not enough data",
  no_deadline: "No exam date",
  on_track: "On track",
  at_risk: "At risk",
  behind: "Behind",
};

export function CoachPage() {
  const handleAuthFailure = useAuthFailure();
  const [plan, setPlan] = useState<StudyPlan | null>(null);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [goals, setGoals] = useState<Record<number, StudyGoal>>({});
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [reflection, setReflection] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [savingGoalFor, setSavingGoalFor] = useState<number | null>(null);
  const [predictions, setPredictions] = useState<GoalPrediction[]>([]);

  const loadPredictions = useCallback(async () => {
    try {
      const result = await api<{ predictions: GoalPrediction[] }>("/goal-predictions");
      setPredictions(result.predictions);
    } catch {
      setPredictions([]);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [planResult, topicsResult] = await Promise.all([
        api<StudyPlan>("/coach/plan/today"),
        api<{ topics: Topic[] }>("/topics"),
      ]);
      setPlan(planResult);
      setTopics(topicsResult.topics);
      const goalEntries = await Promise.all(
        topicsResult.topics.map((topic) =>
          api<StudyGoal>(`/topics/${topic.id}/study-goal`).catch(() => null),
        ),
      );
      const goalMap: Record<number, StudyGoal> = {};
      goalEntries.forEach((goal, index) => {
        if (goal) goalMap[topicsResult.topics[index].id] = goal;
      });
      setGoals(goalMap);
      await loadPredictions();
    } catch (requestError) {
      handleAuthFailure(requestError);
      setError(messageFromError(requestError));
    } finally {
      setLoading(false);
    }
  }, [handleAuthFailure, loadPredictions]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    if (!plan) return;
    api<{ reflection: string | null }>(`/coach/reflection/${plan.planDate}`)
      .then((result) => setReflection(result.reflection))
      .catch(() => setReflection(null));
  }, [plan]);

  async function regenerate() {
    setRegenerating(true);
    setError("");
    try {
      const result = await api<StudyPlan>("/coach/plan/regenerate", { method: "POST" });
      setPlan(result);
    } catch (requestError) {
      setError(messageFromError(requestError));
    } finally {
      setRegenerating(false);
    }
  }

  async function setTaskStatus(taskId: number, status: PlanTaskStatus) {
    if (!plan) return;
    const previous = plan;
    setPlan({ ...plan, tasks: plan.tasks.map((task) => (task.id === taskId ? { ...task, status } : task)) });
    try {
      await api(`/study-plan-tasks/${taskId}`, { method: "PATCH", body: JSON.stringify({ status }) });
      const result = await api<{ reflection: string | null }>(`/coach/reflection/${plan.planDate}`);
      setReflection(result.reflection);
    } catch (requestError) {
      setPlan(previous);
      setError(messageFromError(requestError));
    }
  }

  async function saveGoal(topicId: number, event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const examDate = (data.get("examDate") as string) || null;
    const minutesRaw = data.get("availableMinutesPerDay") as string;
    const minutes = minutesRaw ? Number(minutesRaw) : null;
    setSavingGoalFor(topicId);
    setError("");
    try {
      const result = await api<StudyGoal>(`/topics/${topicId}/study-goal`, {
        method: "PUT",
        body: JSON.stringify({ examDate, availableMinutesPerDay: minutes }),
      });
      setGoals((current) => ({ ...current, [topicId]: result }));
      await loadPredictions();
    } catch (requestError) {
      setError(messageFromError(requestError));
    } finally {
      setSavingGoalFor(null);
    }
  }

  const topicTitle = (topicId: number) => topics.find((topic) => topic.id === topicId)?.title ?? "Topic";
  const completedCount = plan?.tasks.filter((task) => task.status === "completed").length ?? 0;
  const totalCount = plan?.tasks.length ?? 0;
  const progressPercent = totalCount ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <PageShell
      title="Study coach"
      subtitle="A ranked, time-boxed plan built from your weakest concepts and upcoming exams."
      action={
        <button className="button button-secondary" disabled={regenerating} onClick={() => void regenerate()}>
          {regenerating ? "Regenerating…" : <><RefreshCw size={14} /> Regenerate plan</>}
        </button>
      }
    >
      {error && <p className="page-error" role="alert">{error}</p>}
      {loading ? <div className="empty">Loading your plan…</div> : (
        <>
          <section className="notes-panel coach-plan-panel">
            <div className="section-head">
              <div>
                <h2>Today&apos;s plan</h2>
                <p>{plan?.narrative}</p>
              </div>
              {!!totalCount && (
                <div className="progress-ring" style={{ ["--progress" as string]: `${progressPercent * 3.6}deg` }}>
                  <span>{progressPercent}%</span>
                </div>
              )}
            </div>
            {reflection && <p className="coach-reflection">{reflection}</p>}
            <div className="coach-task-list">
              {plan?.tasks.map((task) => (
                <div className={`coach-task-row${task.status !== "pending" ? ` ${task.status}` : ""}`} key={task.id}>
                  <button
                    type="button"
                    className="coach-task-check"
                    aria-label={task.status === "completed" ? "Mark as not done" : "Mark as done"}
                    onClick={() => void setTaskStatus(task.id, task.status === "completed" ? "pending" : "completed")}
                  >
                    {task.status === "completed" ? <Check size={13} strokeWidth={3} /> : ""}
                  </button>
                  <Link href={`/topic?id=${task.topicId}`} className="coach-task-title">
                    <strong>{task.title}</strong>
                    <small>{topicTitle(task.topicId)} · {task.estimatedMinutes} min</small>
                  </Link>
                  {task.status === "pending" && (
                    <button type="button" className="coach-task-skip" onClick={() => void setTaskStatus(task.id, "skipped")}>
                      Skip
                    </button>
                  )}
                  {task.status === "skipped" && <span className="coach-task-skipped-label">Skipped</span>}
                </div>
              ))}
              {!totalCount && (
                <div className="empty">Nothing scheduled -- try a quiz or flashcard review to give the coach something to work with.</div>
              )}
            </div>
          </section>

          <section className="notes-panel coach-goals-panel">
            <div className="section-head">
              <div><h2>Exam dates &amp; study time</h2><p>Set these once per topic -- the coach uses them to prioritize your plan</p></div>
            </div>
            <div className="coach-goals-list">
              {topics.map((topic) => (
                <form className="coach-goal-row" key={topic.id} onSubmit={(event) => void saveGoal(topic.id, event)}>
                  <span className="coach-goal-title">{topic.title}</span>
                  <label>Exam date<input type="date" name="examDate" defaultValue={goals[topic.id]?.examDate ?? ""} /></label>
                  <label>Minutes/day<input type="number" name="availableMinutesPerDay" min={5} max={600} defaultValue={goals[topic.id]?.availableMinutesPerDay ?? ""} placeholder="30" /></label>
                  <button className="button button-secondary" type="submit" disabled={savingGoalFor === topic.id}>
                    {savingGoalFor === topic.id ? "Saving…" : "Save"}
                  </button>
                </form>
              ))}
              {!topics.length && <div className="empty">Create a topic first to set exam dates.</div>}
            </div>
          </section>

          {!!predictions.length && (
            <section className="notes-panel goal-prediction-panel">
              <div className="section-head">
                <div><h2>Exam readiness</h2><p>A forecast based on your mastery trend and days remaining.</p></div>
              </div>
              <div className="goal-prediction-list">
                {predictions.map((prediction) => (
                  <div className="goal-prediction-row" key={prediction.topicId}>
                    <div className="goal-prediction-head">
                      <Link href={`/topic?id=${prediction.topicId}`}>{prediction.topicTitle}</Link>
                      <span className={`goal-prediction-badge ${prediction.status}`}>{STATUS_LABELS[prediction.status]}</span>
                    </div>
                    {prediction.readiness !== null && (
                      <div className="weak-concept-bar-track">
                        <div
                          className={`weak-concept-bar-fill${prediction.status === "behind" ? " weak" : ""}`}
                          style={{ width: `${Math.round(prediction.readiness * 100)}%` }}
                        />
                      </div>
                    )}
                    <p className="goal-prediction-narrative">{prediction.narrative}</p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </PageShell>
  );
}

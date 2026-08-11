"use client";

import { useCallback, useEffect, useState } from "react";
import { ShieldAlert } from "lucide-react";
import { PageShell, useAuthFailure } from "../shared/PageChrome";
import { api, ApiError, messageFromError } from "../../lib/api";
import { Card, LoadingState, StatCard } from "../ui";

type UsageRow = {
  groupKey: string | number | null;
  provider: string;
  feature: string;
  requests: number;
  tokens: number;
  averageLatencyMs: number;
  estimatedCostUsd: number;
  retries: number;
  fallbacks: number;
};

type FailureRow = { feature: string; success: number; failed: number; failureRate: number };
type TopCost = { topUsers: { userId: number; estimatedCostUsd: number }[]; topFeatures: { feature: string; estimatedCostUsd: number }[] };

type GroupBy = "feature" | "provider" | "user";

export function AdminUsagePage() {
  const handleAuthFailure = useAuthFailure();
  const [notAuthorized, setNotAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [groupBy, setGroupBy] = useState<GroupBy>("feature");
  const [usage, setUsage] = useState<UsageRow[]>([]);
  const [failures, setFailures] = useState<FailureRow[]>([]);
  const [topCost, setTopCost] = useState<TopCost | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    setNotAuthorized(false);
    const params = new URLSearchParams();
    if (fromDate) params.set("from", fromDate);
    if (toDate) params.set("to", toDate);
    params.set("groupBy", groupBy);
    try {
      const [summary, failureResult, topCostResult] = await Promise.all([
        api<{ usage: UsageRow[] }>(`/usage/admin/summary?${params.toString()}`),
        api<{ failures: FailureRow[] }>(
          `/usage/admin/failures?${fromDate ? `from=${fromDate}&` : ""}${toDate ? `to=${toDate}` : ""}`,
        ),
        api<TopCost>(`/usage/admin/top-cost?${fromDate ? `from=${fromDate}&` : ""}${toDate ? `to=${toDate}` : ""}`),
      ]);
      setUsage(summary.usage);
      setFailures(failureResult.failures);
      setTopCost(topCostResult);
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.status === 404) {
        setNotAuthorized(true);
      } else {
        handleAuthFailure(requestError);
        setError(messageFromError(requestError));
      }
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, groupBy, handleAuthFailure]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const totalRequests = usage.reduce((sum, row) => sum + row.requests, 0);
  const totalCost = usage.reduce((sum, row) => sum + row.estimatedCostUsd, 0);
  const totalRetries = usage.reduce((sum, row) => sum + row.retries, 0);
  const totalFallbacks = usage.reduce((sum, row) => sum + row.fallbacks, 0);

  if (notAuthorized) {
    return (
      <PageShell title="Admin usage" subtitle="Internal AI usage and cost dashboard.">
        <Card className="admin-not-authorized">
          <ShieldAlert size={22} />
          <p>This page is only available to administrators.</p>
        </Card>
      </PageShell>
    );
  }

  return (
    <PageShell title="Admin usage" subtitle="AI usage, cost, and failure visibility across all users.">
      <div className="admin-filters">
        <label>From<input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} /></label>
        <label>To<input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} /></label>
        <label>Group by
          <select value={groupBy} onChange={(event) => setGroupBy(event.target.value as GroupBy)}>
            <option value="feature">Feature</option>
            <option value="provider">Provider</option>
            <option value="user">User</option>
          </select>
        </label>
      </div>

      {error && <p className="page-error" role="alert">{error}</p>}

      {loading ? (
        <LoadingState label="Loading usage data…" />
      ) : usage.length === 0 && failures.length === 0 ? (
        <Card className="admin-empty">No AI usage recorded for this date range yet.</Card>
      ) : (
        <>
          <div className="stats admin-stat-grid">
            <StatCard label="Requests" value={totalRequests} />
            <StatCard label="Estimated cost" value={`$${totalCost.toFixed(2)}`} />
            <StatCard label="Retries" value={totalRetries} />
            <StatCard label="Fallbacks" value={totalFallbacks} />
          </div>

          <Card className="admin-table-card">
            <h2>Usage by {groupBy}</h2>
            <div className="admin-table-scroll">
              <table className="admin-table">
                <thead>
                  <tr><th>Group</th><th>Provider</th><th>Feature</th><th>Requests</th><th>Tokens</th><th>Avg latency</th><th>Cost (USD)</th><th>Retries</th><th>Fallbacks</th></tr>
                </thead>
                <tbody>
                  {usage.map((row, index) => (
                    <tr key={index}>
                      <td>{row.groupKey ?? "—"}</td>
                      <td>{row.provider}</td>
                      <td>{row.feature}</td>
                      <td>{row.requests}</td>
                      <td>{row.tokens.toLocaleString()}</td>
                      <td>{Math.round(row.averageLatencyMs)}ms</td>
                      <td>${row.estimatedCostUsd.toFixed(4)}</td>
                      <td>{row.retries}</td>
                      <td>{row.fallbacks}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="admin-table-card">
            <h2>Failure rate by feature</h2>
            <div className="admin-table-scroll">
              <table className="admin-table">
                <thead><tr><th>Feature</th><th>Success</th><th>Failed</th><th>Failure rate</th></tr></thead>
                <tbody>
                  {failures.map((row) => (
                    <tr key={row.feature}>
                      <td>{row.feature}</td>
                      <td>{row.success}</td>
                      <td>{row.failed}</td>
                      <td>{(row.failureRate * 100).toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {topCost && (
            <Card className="admin-table-card">
              <h2>Highest cost</h2>
              <div className="admin-top-cost-columns">
                <div>
                  <h3>By user</h3>
                  <ul>{topCost.topUsers.map((row) => <li key={row.userId}>User #{row.userId} — ${row.estimatedCostUsd.toFixed(2)}</li>)}</ul>
                </div>
                <div>
                  <h3>By feature</h3>
                  <ul>{topCost.topFeatures.map((row) => <li key={row.feature}>{row.feature} — ${row.estimatedCostUsd.toFixed(2)}</li>)}</ul>
                </div>
              </div>
            </Card>
          )}
        </>
      )}
    </PageShell>
  );
}

"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { ChangeEvent, FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { Check, Laptop, LogOut, Trash2, X } from "lucide-react";
import {
  api,
  apiAssetUrl,
  downloadFile,
  messageFromError,
  uploadWithProgress,
  User,
} from "../../lib/api";
import { PageShell, useAuthFailure } from "../shared/PageChrome";
import { useTheme } from "../theme-context";
import { ProgressBar } from "../ui";

type AccountSession = {
  id: string;
  device: string;
  ipAddress: string | null;
  createdAt: string;
  lastSeenAt: string | null;
  isCurrent: boolean;
};

function AccountSecurityPanel() {
  const router = useRouter();
  const [sessions, setSessions] = useState<AccountSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionsError, setSessionsError] = useState("");
  const [busySessionId, setBusySessionId] = useState<string | null>(null);
  const [revokingOthers, setRevokingOthers] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSaved, setPasswordSaved] = useState(false);

  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const [loggingOut, setLoggingOut] = useState(false);

  const loadSessions = useCallback(async () => {
    setSessionsLoading(true);
    setSessionsError("");
    try {
      const result = await api<{ sessions: AccountSession[] }>("/users/me/sessions");
      setSessions(result.sessions);
    } catch (requestError) {
      setSessionsError(messageFromError(requestError));
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  async function revokeSession(sessionId: string) {
    setBusySessionId(sessionId);
    setSessionsError("");
    try {
      await api<null>(`/users/me/sessions/${sessionId}`, { method: "DELETE" });
      setSessions((current) => current.filter((session) => session.id !== sessionId));
    } catch (requestError) {
      setSessionsError(messageFromError(requestError));
    } finally {
      setBusySessionId(null);
    }
  }

  async function revokeOtherSessions() {
    setRevokingOthers(true);
    setSessionsError("");
    try {
      await api<{ revokedCount: number }>("/users/me/sessions", { method: "DELETE" });
      await loadSessions();
    } catch (requestError) {
      setSessionsError(messageFromError(requestError));
    } finally {
      setRevokingOthers(false);
    }
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordSaving(true);
    setPasswordError("");
    setPasswordSaved(false);
    try {
      await api<{ otherSessionsRevoked: number }>("/users/me/password", {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setCurrentPassword("");
      setNewPassword("");
      setPasswordSaved(true);
      window.setTimeout(() => setPasswordSaved(false), 3000);
      await loadSessions();
    } catch (requestError) {
      setPasswordError(messageFromError(requestError));
    } finally {
      setPasswordSaving(false);
    }
  }

  async function exportData() {
    setExporting(true);
    setExportError("");
    try {
      await downloadFile("/users/me/export", "studia-account-export.json");
    } catch (requestError) {
      setExportError(messageFromError(requestError));
    } finally {
      setExporting(false);
    }
  }

  async function logout() {
    setLoggingOut(true);
    await api<null>("/auth/logout", { method: "POST" }).catch(() => null);
    router.replace("/login");
  }

  async function confirmDeleteAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setDeleting(true);
    setDeleteError("");
    try {
      await api<{ deleted: boolean }>("/users/me/delete", {
        method: "POST",
        body: JSON.stringify({ password: deletePassword }),
      });
      router.replace("/login");
    } catch (requestError) {
      setDeleteError(messageFromError(requestError));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <section className="settings-panel">
        <div className="settings-section">
          <div><h2>Change password</h2><p>Use a password you don&apos;t use anywhere else.</p></div>
          <form className="settings-form" onSubmit={changePassword}>
            <label>Current password
              <input
                type="password" required minLength={1} maxLength={128} autoComplete="current-password"
                value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)}
              />
            </label>
            <label>New password
              <input
                type="password" required minLength={8} maxLength={128} autoComplete="new-password"
                value={newPassword} onChange={(event) => setNewPassword(event.target.value)}
              />
            </label>
            {passwordError && <p className="page-error" role="alert">{passwordError}</p>}
            {passwordSaved && (
              <p className="save-toast" role="status"><Check size={14} strokeWidth={2.5} /> Password changed. Other sessions were signed out.</p>
            )}
            <div className="settings-actions full">
              <button className="button button-primary" type="submit" disabled={passwordSaving}>
                {passwordSaving ? "Saving…" : "Change password"}
              </button>
            </div>
          </form>
        </div>
        <div className="settings-section">
          <div className="section-head">
            <div><h2>Active sessions</h2><p>Devices currently signed in to your account.</p></div>
            {sessions.length > 1 && (
              <button type="button" className="button button-secondary" disabled={revokingOthers} onClick={() => void revokeOtherSessions()}>
                {revokingOthers ? "Signing out…" : "Sign out other sessions"}
              </button>
            )}
          </div>
          {sessionsError && <p className="page-error" role="alert">{sessionsError}</p>}
          {sessionsLoading ? (
            <div className="empty">Loading sessions…</div>
          ) : (
            <ul className="session-list">
              {sessions.map((session) => (
                <li key={session.id} className="session-row">
                  <Laptop size={18} strokeWidth={1.8} aria-hidden="true" />
                  <div className="session-row-detail">
                    <span>{session.device}{session.isCurrent && <span className="session-current-badge">This device</span>}</span>
                    <small>
                      {session.ipAddress ? `${session.ipAddress} · ` : ""}
                      Last active {session.lastSeenAt ? new Date(session.lastSeenAt).toLocaleString() : "unknown"}
                    </small>
                  </div>
                  {!session.isCurrent && (
                    <button
                      type="button" className="ui-icon-action danger" aria-label={`Sign out ${session.device}`}
                      disabled={busySessionId === session.id} onClick={() => void revokeSession(session.id)}
                    >
                      <X size={16} />
                    </button>
                  )}
                </li>
              ))}
              {!sessions.length && <div className="empty">No active sessions found.</div>}
            </ul>
          )}
        </div>
        <div className="settings-section">
          <div><h2>Log out</h2><p>Sign out of Studia on this device.</p></div>
          <div className="settings-actions full">
            <button type="button" className="button button-secondary" disabled={loggingOut} onClick={() => void logout()}>
              <LogOut size={14} /> {loggingOut ? "Logging out…" : "Log out"}
            </button>
          </div>
        </div>
      </section>

      <section className="settings-panel danger-zone">
        <div className="settings-section">
          <div><h2>Export your data</h2><p>Download a complete copy of your topics, notes, documents, quizzes, and study activity.</p></div>
          {exportError && <p className="page-error" role="alert">{exportError}</p>}
          <div className="settings-actions full">
            <button type="button" className="button button-secondary" disabled={exporting} onClick={() => void exportData()}>
              {exporting ? "Preparing export…" : "Download my data"}
            </button>
          </div>
        </div>
        <div className="settings-section">
          <div><h2>Delete account</h2><p>Permanently deletes your account and everything in it. This cannot be undone.</p></div>
          <div className="settings-actions full">
            <button type="button" className="button button-danger" onClick={() => setShowDeleteConfirm(true)}>
              <Trash2 size={14} /> Delete my account
            </button>
          </div>
        </div>
      </section>

      {showDeleteConfirm && (
        <div className="modal-backdrop" onMouseDown={() => (deleting ? null : setShowDeleteConfirm(false))}>
          <form
            role="alertdialog" aria-modal="true" aria-labelledby="delete-account-title"
            className="topic-modal action-modal delete-modal" onSubmit={confirmDeleteAccount}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button type="button" className="modal-close" aria-label="Close" disabled={deleting} onClick={() => setShowDeleteConfirm(false)}><X size={22} /></button>
            <div className="modal-icon delete-icon"><Trash2 size={22} /></div>
            <div className="eyebrow">THIS CANNOT BE UNDONE</div>
            <h2 id="delete-account-title">Delete your account?</h2>
            <p>All topics, notes, documents, quizzes, flashcards, and study history will be permanently deleted. Enter your password to confirm.</p>
            <label>Password
              <input
                type="password" required minLength={1} maxLength={128} autoComplete="current-password" autoFocus
                value={deletePassword} onChange={(event) => setDeletePassword(event.target.value)}
              />
            </label>
            {deleteError && <p className="form-error">{deleteError}</p>}
            <div className="modal-actions">
              <button type="button" className="button button-secondary" disabled={deleting} onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
              <button type="submit" className="button button-danger" disabled={deleting}>
                {deleting ? "Deleting…" : "Permanently delete account"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

type UsageSummary = {
  used: number;
  limit: number;
  remaining: number;
  softLimitHit: boolean;
};

type LearningStyleWeights = {
  visual: number;
  reading: number;
  practice: number;
  flashcards: number;
  examples: number;
  conversation: number;
};

type LearningStyleProfile = {
  weights: LearningStyleWeights;
  dominantAxes: string[];
  eventCount: number;
  overridden: boolean;
  rationale: string | null;
  computedAt: string | null;
};

const LEARNING_STYLE_AXES: { key: keyof LearningStyleWeights; label: string }[] = [
  { key: "visual", label: "Visual" },
  { key: "reading", label: "Reading" },
  { key: "practice", label: "Practice" },
  { key: "flashcards", label: "Flashcards" },
  { key: "examples", label: "Examples" },
  { key: "conversation", label: "Conversation" },
];

const RADAR_SIZE = 320;
const RADAR_CENTER = RADAR_SIZE / 2;
const RADAR_RADIUS = 92;

function radarAxisPoint(index: number, fraction: number) {
  const angle = (Math.PI * 2 * index) / LEARNING_STYLE_AXES.length - Math.PI / 2;
  const r = fraction * RADAR_RADIUS;
  return { x: RADAR_CENTER + r * Math.cos(angle), y: RADAR_CENTER + r * Math.sin(angle) };
}

function radarPolygon(weights: LearningStyleWeights): string {
  return LEARNING_STYLE_AXES.map((axis, i) => {
    const scaled = Math.min(Math.sqrt(weights[axis.key]), 1);
    const { x, y } = radarAxisPoint(i, scaled);
    return `${x},${y}`;
  }).join(" ");
}

function LearningStyleRadar({ weights }: { weights: LearningStyleWeights }) {
  const rings = [0.33, 0.66, 1];
  return (
    <svg viewBox={`0 0 ${RADAR_SIZE} ${RADAR_SIZE}`} className="radar-chart" role="img" aria-label="Learning style radar chart">
      {rings.map((fraction) => (
        <polygon
          key={fraction}
          className="radar-grid-ring"
          points={LEARNING_STYLE_AXES.map((_, i) => {
            const { x, y } = radarAxisPoint(i, fraction);
            return `${x},${y}`;
          }).join(" ")}
        />
      ))}
      {LEARNING_STYLE_AXES.map((axis, i) => {
        const { x, y } = radarAxisPoint(i, 1);
        const label = radarAxisPoint(i, 1.24);
        return (
          <g key={axis.key}>
            <line className="radar-axis-line" x1={RADAR_CENTER} y1={RADAR_CENTER} x2={x} y2={y} />
            <text className="radar-axis-label" x={label.x} y={label.y} textAnchor="middle" dominantBaseline="middle">
              {axis.label}
            </text>
          </g>
        );
      })}
      <polygon className="radar-data-shape" points={radarPolygon(weights)} />
      {LEARNING_STYLE_AXES.map((axis, i) => {
        const scaled = Math.min(Math.sqrt(weights[axis.key]), 1);
        const { x, y } = radarAxisPoint(i, scaled);
        return <circle key={axis.key} className="radar-data-point" cx={x} cy={y} r={3.5} />;
      })}
    </svg>
  );
}

function LearningStylePanel() {
  const [profile, setProfile] = useState<LearningStyleProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<LearningStyleWeights | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api<LearningStyleProfile>("/learning-style");
      setProfile(result);
    } catch (requestError) {
      setError(messageFromError(requestError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function startEditing() {
    if (!profile) return;
    setDraft({ ...profile.weights });
    setEditing(true);
  }

  async function saveDraft() {
    if (!draft) return;
    setSaving(true);
    setError("");
    try {
      const result = await api<LearningStyleProfile>("/learning-style", {
        method: "PATCH",
        body: JSON.stringify(draft),
      });
      setProfile(result);
      setEditing(false);
    } catch (requestError) {
      setError(messageFromError(requestError));
    } finally {
      setSaving(false);
    }
  }

  async function resetToAuto() {
    setSaving(true);
    setError("");
    try {
      const result = await api<LearningStyleProfile>("/learning-style/reset", { method: "POST" });
      setProfile(result);
      setEditing(false);
    } catch (requestError) {
      setError(messageFromError(requestError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="settings-panel">
      <div className="settings-section learning-style-section">
        <div>
          <h2>How you learn</h2>
          <p>Inferred from how you actually study — no survey, just your engagement patterns.</p>
        </div>
        {error && <p className="page-error" role="alert">{error}</p>}
        {loading || !profile ? (
          <div className="empty">Loading your learning style…</div>
        ) : (
          <div className="learning-style-layout">
            <LearningStyleRadar weights={editing && draft ? draft : profile.weights} />
            <div className="learning-style-detail">
              {profile.overridden && <span className="learning-style-badge">Manually set</span>}
              <p className="learning-style-rationale">
                {profile.rationale ?? "Not enough activity yet to detect a preference."}
              </p>
              {!editing ? (
                <div className="learning-style-actions">
                  <button type="button" className="button button-secondary" onClick={startEditing}>
                    Adjust manually
                  </button>
                  {profile.overridden && (
                    <button type="button" className="button button-secondary" disabled={saving} onClick={() => void resetToAuto()}>
                      {saving ? "Resetting…" : "Reset to auto-detected"}
                    </button>
                  )}
                </div>
              ) : (
                <div className="learning-style-editor">
                  {LEARNING_STYLE_AXES.map((axis) => (
                    <label key={axis.key} className="learning-style-slider">
                      <span>{axis.label}</span>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={Math.round((draft?.[axis.key] ?? 0) * 100)}
                        onChange={(event) =>
                          setDraft((current) =>
                            current ? { ...current, [axis.key]: Number(event.target.value) / 100 } : current
                          )
                        }
                      />
                    </label>
                  ))}
                  <div className="learning-style-actions">
                    <button type="button" className="button button-secondary" onClick={() => setEditing(false)}>
                      Cancel
                    </button>
                    <button type="button" className="button button-primary" disabled={saving} onClick={() => void saveDraft()}>
                      {saving ? "Saving…" : "Save weights"}
                    </button>
                  </div>
                </div>
              )}
              <small className="learning-style-meta">
                Based on {profile.eventCount} tracked {profile.eventCount === 1 ? "activity" : "activities"}
              </small>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export function SettingsPage() {
  const handleAuthFailure = useAuthFailure();
  const { theme, toggleTheme } = useTheme();
  const [user, setUser] = useState<User | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const photoInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api<{ user: User | null }>("/auth/me")
      .then((result) => setUser(result.user))
      .catch(handleAuthFailure);
  }, [handleAuthFailure]);

  useEffect(() => {
    api<UsageSummary>("/usage/me").then(setUsage).catch(() => setUsage(null));
  }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setError("");

    try {
      const result = await api<{ user: User }>("/auth/me", {
        method: "PATCH",
        body: JSON.stringify({
          name: data.get("name"),
          email: data.get("email"),
        }),
      });
      setUser(result.user);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2500);
    } catch (requestError) {
      setError(messageFromError(requestError));
    }
  }

  async function uploadPhoto(event: ChangeEvent<HTMLInputElement>) {
    const image = event.target.files?.[0];
    if (!image) return;
    setError("");
    setPhotoUploading(true);
    try {
      const formData = new FormData();
      formData.append("image", image);
      const result = await uploadWithProgress<{ user: User }>("/users/me/profile-image", formData);
      setUser(result.user);
      setSaved(true);
      window.dispatchEvent(new Event("studia:profile-updated"));
      window.setTimeout(() => setSaved(false), 2500);
    } catch (requestError) {
      setError(messageFromError(requestError));
    } finally {
      setPhotoUploading(false);
      event.target.value = "";
    }
  }

  return (
    <PageShell className="settings-page" title="Settings" subtitle="Manage your profile information.">
      {saved && <div className="save-toast"><Check size={14} strokeWidth={2.5} /> Your profile has been saved.</div>}
      {error && <p className="page-error" role="alert">{error}</p>}
      <section className="settings-panel">
        <div className="settings-section">
          <div><h2>Profile information</h2><p>Update the details shown in your Studia account.</p></div>
          {user ? (
            <>
            <div className="profile-photo">
              <span className="avatar large profile-avatar">{apiAssetUrl(user.profileImageUrl) ? <Image src={apiAssetUrl(user.profileImageUrl) ?? ""} alt={`${user.name}'s profile`} width={54} height={54} unoptimized /> : user.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase()}</span>
              <div><button type="button" disabled={photoUploading} onClick={() => photoInput.current?.click()}>{photoUploading ? "Uploading…" : "Change photo"}</button><small>PNG, JPEG, or WebP · up to 5 MB</small></div>
              <input ref={photoInput} className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => void uploadPhoto(event)} />
            </div>
            <form className="settings-form" onSubmit={save}>
              <label>Full name<input name="name" minLength={2} maxLength={100} defaultValue={user.name} /></label>
              <label>Email address<input name="email" type="email" maxLength={255} defaultValue={user.email} /></label>
              <div className="settings-actions full"><button className="button button-primary" type="submit">Save changes</button></div>
            </form>
            </>
          ) : <div className="empty">Loading your profile…</div>}
        </div>
        <div className="settings-section">
          <div className="toggle-row">
            <span><b>Dark mode</b><small>Switch the whole app between light and dark themes.</small></span>
            <input
              type="checkbox"
              role="switch"
              checked={theme === "dark"}
              onChange={toggleTheme}
              aria-label="Toggle dark mode"
            />
          </div>
        </div>
        {usage && (
          <div className="settings-section">
            <div><h2>AI usage this month</h2><p>Your beta usage limit resets on the 1st of each month.</p></div>
            <ProgressBar
              value={usage.limit > 0 ? Math.round((usage.used / usage.limit) * 100) : 0}
              label={`${usage.used} of ${usage.limit} AI requests used`}
              detail={
                usage.softLimitHit
                  ? <span className="page-error" role="status">You&apos;re approaching your monthly AI limit ({usage.remaining} left).</span>
                  : `${usage.remaining} remaining`
              }
            />
          </div>
        )}
      </section>
      <LearningStylePanel />
      <AccountSecurityPanel />
    </PageShell>
  );
}

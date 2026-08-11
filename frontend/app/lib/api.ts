const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000/api/v1";

export type User = { id: string; name: string; email: string; profileImageUrl: string | null };
export type Topic = {
  id: number;
  title: string;
  description: string | null;
  created_at: string;
  updated_at: string;
};
export type Note = {
  id: number;
  topic_id: number;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
};
export type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};


export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: unknown,
  ) {
    super(message);
  }
}

// React's development checks and sibling client components can request the
// same resource during the same render window. Share only in-flight GETs: this
// removes duplicate network work without serving stale data after a mutation.
const inFlightGets = new Map<string, Promise<unknown>>();
const completedGets = new Map<string, { value: unknown; expiresAt: number }>();
let cacheGeneration = 0;
const SESSION_CACHE_KEY = "studia:api-cache:v1";

type StoredCache = Record<string, { value: unknown; expiresAt: number }>;

function canPersist(path: string): boolean {
  return path === "/auth/me"
    || path === "/topics"
    || path === "/dashboard"
    || path === "/workspace-pages"
    || path === "/flashcards/stats-summary"
    || path.includes("counts-by-topic")
    || path.includes("stats-by-topic");
}

function readSessionCache(path: string): { value: unknown; expiresAt: number } | null {
  if (typeof window === "undefined" || !canPersist(path)) return null;
  try {
    const stored = JSON.parse(window.sessionStorage.getItem(SESSION_CACHE_KEY) ?? "{}") as StoredCache;
    const entry = stored[path];
    if (!entry || entry.expiresAt <= Date.now()) {
      if (entry) {
        delete stored[path];
        window.sessionStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(stored));
      }
      return null;
    }
    return entry;
  } catch {
    return null;
  }
}

function writeSessionCache(path: string, entry: { value: unknown; expiresAt: number }) {
  if (typeof window === "undefined" || !canPersist(path)) return;
  try {
    const stored = JSON.parse(window.sessionStorage.getItem(SESSION_CACHE_KEY) ?? "{}") as StoredCache;
    stored[path] = entry;
    window.sessionStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(stored));
  } catch {
    // A full or disabled sessionStorage must never block the actual request.
  }
}

function getCacheTtl(path: string): number {
  if (path === "/auth/me") return 5 * 60_000;
  if (path === "/topics") return 2 * 60_000;
  if (path === "/workspace-pages") return 60_000;
  if (path.includes("counts-by-topic") || path.includes("stats-by-topic") || path === "/flashcards/stats-summary") return 60_000;
  return 30_000;
}

function clearGetCache() {
  cacheGeneration += 1;
  completedGets.clear();
  if (typeof window !== "undefined") window.sessionStorage.removeItem(SESSION_CACHE_KEY);
}

// One ID per outbound request, echoed back by the backend and threaded
// through job/worker logs -- lets a single request be grepped across
// frontend console, backend request log, and (if it enqueued one) job log.
function requestIdHeader(): { "X-Request-Id": string } {
  return { "X-Request-Id": crypto.randomUUID() };
}

async function requestJson<T>(path: string, options: RequestInit): Promise<T> {
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      ...(options.body && !isFormData ? { "Content-Type": "application/json" } : {}),
      ...requestIdHeader(),
      ...options.headers,
    },
  });
  const payload = response.status === 204
    ? null
    : await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(
      payload?.message ?? "Something went wrong",
      response.status,
      payload?.details,
    );
  }

  return payload as T;
}

export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const method = (options.method ?? "GET").toUpperCase();
  const canDedupe = method === "GET" && !options.body && !options.signal && !options.headers && options.cache !== "no-store";
  if (!canDedupe) {
    if (method !== "GET") clearGetCache();
    return requestJson<T>(path, options);
  }

  if (typeof window !== "undefined") {
    const cached = completedGets.get(path);
    if (cached && cached.expiresAt > Date.now()) return cached.value as T;
    if (cached) completedGets.delete(path);
    const stored = readSessionCache(path);
    if (stored) {
      completedGets.set(path, stored);
      return stored.value as T;
    }
  }

  const existing = inFlightGets.get(path);
  if (existing) return existing as Promise<T>;

  const generation = cacheGeneration;
  const request = requestJson<T>(path, options);
  inFlightGets.set(path, request);
  try {
    const result = await request;
    if (typeof window !== "undefined" && generation === cacheGeneration) {
      const entry = { value: result, expiresAt: Date.now() + getCacheTtl(path) };
      completedGets.set(path, entry);
      writeSessionCache(path, entry);
    }
    return result;
  } finally {
    if (inFlightGets.get(path) === request) inFlightGets.delete(path);
  }
}

export async function warmApi(path: string): Promise<void> {
  await api<unknown>(path).then(() => undefined);
}

export function messageFromError(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong";
}

export function apiAssetUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  const api = new URL(API_URL);
  return new URL(path, `${api.origin}/`).toString();
}

// Attach to expensive generate-once actions (quiz/exam/flashcard
// generation) so a double-click or a retried request after a slow response
// returns the already-generated result instead of paying for a second AI
// call. A fresh key per user action is intentional -- an intentional
// "generate again" click should always produce new content.
export function idempotencyHeader(): { "Idempotency-Key": string } {
  return { "Idempotency-Key": crypto.randomUUID() };
}

// `fetch` exposes no upload-progress signal, so a real progress bar needs
// XMLHttpRequest instead of the `api()` fetch wrapper above.
export function uploadWithProgress<T>(
  path: string,
  formData: FormData,
  onProgress?: (percent: number) => void,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_URL}${path}`);
    xhr.withCredentials = true;
    xhr.setRequestHeader("X-Request-Id", crypto.randomUUID());
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    xhr.onload = () => {
      let payload: { message?: string; details?: unknown } | null = null;
      try {
        payload = xhr.responseText ? JSON.parse(xhr.responseText) : null;
      } catch {
        payload = null;
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        clearGetCache();
        resolve(payload as T);
      } else {
        reject(new ApiError(payload?.message ?? "Something went wrong", xhr.status, payload?.details));
      }
    };
    xhr.onerror = () => reject(new ApiError("Network error during upload", 0));
    xhr.send(formData);
  });
}

function filenameFromContentDisposition(header: string | null): string | null {
  const match = header?.match(/filename="?([^"]+)"?/);
  return match ? match[1] : null;
}

// Downloads use a raw fetch instead of api<T>() because the response body is
// a file blob, not JSON.
export async function downloadFile(path: string, fallbackFilename: string): Promise<void> {
  const response = await fetch(`${API_URL}${path}`, { credentials: "include", headers: requestIdHeader() });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new ApiError(payload?.message ?? "Something went wrong", response.status, payload?.details);
  }

  const filename =
    filenameFromContentDisposition(response.headers.get("Content-Disposition")) ?? fallbackFilename;
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}

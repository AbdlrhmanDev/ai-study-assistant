const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000/api/v1";

export type User = { id: string; name: string; email: string };
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

export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  // FormData bodies (file uploads) must NOT get a manual Content-Type --
  // the browser sets multipart/form-data with the correct boundary itself.
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      ...(options.body && !isFormData ? { "Content-Type": "application/json" } : {}),
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

export function messageFromError(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong";
}

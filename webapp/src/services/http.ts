// Prefer Vite's import.meta.env in browser builds, fallback to process.env for SSR
const API_BASE =
  (typeof import.meta !== 'undefined' &&
    (import.meta as any).env?.VITE_API_URL) ||
  process.env.VITE_API_URL ||
  'http://localhost:3000';

export async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    signal,
    credentials: 'omit', // change to 'include' if you need cookies
    headers: {
      'Content-Type': 'application/json'
    }
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }

  return res.json() as Promise<T>;
}

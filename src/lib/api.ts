// Production always calls /api/v1 on its own address; the host proxies it to
// the backend (functions/api/[[path]].ts on Cloudflare Pages). That keeps the
// sign-in cookie first-party: calling the backend's own domain makes it a
// cross-site cookie the browser never sends back, so every request after
// sign-in fails with 401 missing_credentials. Development uses VITE_API_URL.
const API_URL = import.meta.env.DEV ? (import.meta.env.VITE_API_URL ?? 'http://localhost:3001/api/v1') : '/api/v1'

export class ApiError extends Error {
  status: number
  code?: string

  constructor(status: number, message: string, code?: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

/** Calls the Infynix API. Sends the session cookie on every request. */
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      credentials: 'include',
      // Only label a body that exists: Fastify answers 400 to an empty JSON
      // body, which silently broke sign-out and DELETE.
      headers: init.body ? { 'Content-Type': 'application/json', ...init.headers } : init.headers,
    })
  } catch {
    throw new ApiError(0, "Can't reach the Infynix server. Check your connection and try again.")
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    // Validation errors arrive as an array of messages.
    const message = Array.isArray(body.message) ? body.message[0] : body.message
    throw new ApiError(res.status, message ?? res.statusText, body.errorCode)
  }
  return res.status === 204 ? (undefined as T) : res.json()
}

/**
 * Uploads one file as multipart form data (field `file`) and reports
 * progress (0–1). XHR, because fetch can't report upload progress. Errors
 * come back as ApiError, like `api()`.
 */
export function apiUpload<T>(
  path: string,
  file: File,
  options: { onProgress?: (fraction: number) => void; signal?: AbortSignal } = {},
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${API_URL}${path}`)
    xhr.withCredentials = true
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) options.onProgress?.(event.loaded / event.total)
    }
    xhr.onload = () => {
      let body: { message?: string | string[]; errorCode?: string } = {}
      try {
        body = JSON.parse(xhr.responseText)
      } catch {
        // Not JSON (e.g. a proxy error page): fall back to the status text.
      }
      if (xhr.status >= 200 && xhr.status < 300) return resolve(body as T)
      const message = Array.isArray(body.message) ? body.message[0] : body.message
      reject(new ApiError(xhr.status, message ?? xhr.statusText, body.errorCode))
    }
    xhr.onerror = () =>
      reject(new ApiError(0, "Can't reach the Infynix server. Check your connection and try again."))
    xhr.onabort = () => reject(new ApiError(0, 'Upload cancelled.'))
    options.signal?.addEventListener('abort', () => xhr.abort())
    const form = new FormData()
    form.append('file', file)
    xhr.send(form)
  })
}

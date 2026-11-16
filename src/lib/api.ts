const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001/api/v1'

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

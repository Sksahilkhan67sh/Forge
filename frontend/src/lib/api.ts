import Cookies from 'js-cookie'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const BASE = `${API_URL}/api/v1`

// ── Types ───────────────────────────────────────────────────────────────────

export interface User {
  id: string
  email: string
  full_name: string | null
  created_at: string
}

export interface Project {
  id: string
  name: string
  description: string | null
  repo_url: string | null
  language: string | null
  indexed: boolean
  created_at: string
}

export interface ChatSession {
  id: string
  project_id: string | null
  title: string | null
  model: string
  created_at: string
}

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'tool'
  content: { text?: string; [key: string]: unknown }
  model_used: string | null
  tokens_in: number | null
  tokens_out: number | null
  created_at: string
}

export interface ExecuteResult {
  stdout: string
  stderr: string
  exit_code: number
  error: string | null
  duration_ms: number
  success: boolean
}

// ── HTTP client ──────────────────────────────────────────────────────────────

class APIError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return Cookies.get('forge_token') || localStorage.getItem('forge_token')
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string> || {}),
  }

  const res = await fetch(`${BASE}${path}`, { ...options, headers })

  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }))
    throw new APIError(res.status, body.detail || 'Request failed')
  }

  if (res.status === 204) return undefined as T
  return res.json()
}

// ── Auth ─────────────────────────────────────────────────────────────────────

export const auth = {
  register: (email: string, password: string, full_name?: string) =>
    request<{ access_token: string; user_id: string; email: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, full_name }),
    }),

  login: (email: string, password: string) =>
    request<{ access_token: string; user_id: string; email: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  me: () => request<User>('/auth/me'),
}

// ── Projects ─────────────────────────────────────────────────────────────────

export const projects = {
  list: () => request<Project[]>('/projects/'),
  create: (name: string, description?: string, repo_url?: string) =>
    request<Project>('/projects/', {
      method: 'POST',
      body: JSON.stringify({ name, description, repo_url }),
    }),
  get: (id: string) => request<Project>(`/projects/${id}`),
  delete: (id: string) => request<void>(`/projects/${id}`, { method: 'DELETE' }),
  index: (id: string, directory: string, force_reindex = false) =>
    request<{ files: number; chunks: number; project_id: string }>(
      `/projects/${id}/index`,
      { method: 'POST', body: JSON.stringify({ directory, force_reindex }) },
    ),
}

// ── Chat sessions ─────────────────────────────────────────────────────────────

export const sessions = {
  list: () => request<ChatSession[]>('/chat/sessions'),
  create: (project_id?: string, title?: string) =>
    request<ChatSession>('/chat/sessions', {
      method: 'POST',
      body: JSON.stringify({ project_id, title }),
    }),
  messages: (id: string) => request<Message[]>(`/chat/sessions/${id}/messages`),
}

// ── Streaming chat ────────────────────────────────────────────────────────────

export interface StreamEvent {
  type: 'session_id' | 'chunk' | 'done' | 'error'
  data: string
}

export async function* streamChat(params: {
  message: string
  session_id?: string
  project_id?: string
  use_agent?: boolean
  max_iterations?: number
}): AsyncGenerator<StreamEvent> {
  const token = getToken()
  const res = await fetch(`${BASE}/chat/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ use_agent: true, max_iterations: 6, ...params }),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: 'Stream failed' }))
    throw new APIError(res.status, body.detail)
  }

  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const parts = buffer.split('\n\n')
    buffer = parts.pop() || ''

    for (const part of parts) {
      const eventMatch = part.match(/^event: (\w+)/)
      const dataMatch = part.match(/^data: (.+)$/m)
      if (eventMatch && dataMatch) {
        yield { type: eventMatch[1] as StreamEvent['type'], data: dataMatch[1] }
      }
    }
  }
}

// ── Code execution ────────────────────────────────────────────────────────────

export const execute = {
  run: (code: string, language = 'python', timeout = 30, files?: Record<string, string>) =>
    request<ExecuteResult>('/execute', {
      method: 'POST',
      body: JSON.stringify({ code, language, timeout, files }),
    }),
}

// ── Code search ───────────────────────────────────────────────────────────────

export const search = {
  code: (query: string, project_id?: string, k = 8) =>
    request<Array<{
      file_path: string; language: string | null; symbol_name: string | null
      content: string; start_line: number | null; score: number
    }>>('/search/code', {
      method: 'POST',
      body: JSON.stringify({ query, project_id, k }),
    }),
}

// ── Token storage helpers ─────────────────────────────────────────────────────

export function saveToken(token: string): void {
  Cookies.set('forge_token', token, { expires: 7, sameSite: 'lax' })
  localStorage.setItem('forge_token', token)
}

export function clearToken(): void {
  Cookies.remove('forge_token')
  localStorage.removeItem('forge_token')
}

export { APIError }

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { type User, type ChatSession, type Message, clearToken, saveToken } from '@/lib/api'

// ── Auth store ───────────────────────────────────────────────────────────────

interface AuthState {
  user: User | null
  token: string | null
  setAuth: (user: User, token: string) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      setAuth: (user, token) => {
        saveToken(token)
        set({ user, token })
      },
      logout: () => {
        clearToken()
        set({ user: null, token: null })
      },
    }),
    { name: 'forge-auth', partialize: (s) => ({ token: s.token, user: s.user }) },
  ),
)

// ── Chat store ───────────────────────────────────────────────────────────────

interface ChatState {
  sessions: ChatSession[]
  activeSessionId: string | null
  messages: Record<string, Message[]>   // session_id → messages
  streaming: boolean
  streamingText: string

  setSessions: (sessions: ChatSession[]) => void
  addSession: (session: ChatSession) => void
  setActiveSession: (id: string | null) => void
  setMessages: (sessionId: string, messages: Message[]) => void
  appendMessage: (sessionId: string, message: Message) => void
  updateLastMessage: (sessionId: string, text: string) => void
  setStreaming: (streaming: boolean) => void
  setStreamingText: (text: string) => void
  appendStreamingText: (chunk: string) => void
  clearStreamingText: () => void
}

export const useChatStore = create<ChatState>()((set, get) => ({
  sessions: [],
  activeSessionId: null,
  messages: {},
  streaming: false,
  streamingText: '',

  setSessions: (sessions) => set({ sessions }),
  addSession: (session) => set((s) => ({ sessions: [session, ...s.sessions] })),
  setActiveSession: (id) => set({ activeSessionId: id }),
  setMessages: (sessionId, messages) =>
    set((s) => ({ messages: { ...s.messages, [sessionId]: messages } })),
  appendMessage: (sessionId, message) =>
    set((s) => ({
      messages: {
        ...s.messages,
        [sessionId]: [...(s.messages[sessionId] || []), message],
      },
    })),
  updateLastMessage: (sessionId, text) =>
    set((s) => {
      const msgs = [...(s.messages[sessionId] || [])]
      if (msgs.length > 0) {
        msgs[msgs.length - 1] = {
          ...msgs[msgs.length - 1],
          content: { text },
        }
      }
      return { messages: { ...s.messages, [sessionId]: msgs } }
    }),
  setStreaming: (streaming) => set({ streaming }),
  setStreamingText: (text) => set({ streamingText: text }),
  appendStreamingText: (chunk) =>
    set((s) => ({ streamingText: s.streamingText + chunk })),
  clearStreamingText: () => set({ streamingText: '' }),
}))

// ── Project store ─────────────────────────────────────────────────────────────

import type { Project } from '@/lib/api'

interface ProjectState {
  projects: Project[]
  activeProjectId: string | null
  setProjects: (projects: Project[]) => void
  addProject: (project: Project) => void
  setActiveProject: (id: string | null) => void
  updateProject: (id: string, updates: Partial<Project>) => void
}

export const useProjectStore = create<ProjectState>()((set) => ({
  projects: [],
  activeProjectId: null,
  setProjects: (projects) => set({ projects }),
  addProject: (project) => set((s) => ({ projects: [project, ...s.projects] })),
  setActiveProject: (id) => set({ activeProjectId: id }),
  updateProject: (id, updates) =>
    set((s) => ({
      projects: s.projects.map((p) => (p.id === id ? { ...p, ...updates } : p)),
    })),
}))

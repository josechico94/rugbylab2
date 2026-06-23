import { create } from 'zustand'
export type Role = 'admin' | 'cuerpo_tecnico' | 'jugador'
export interface UserProfile {
  uid: string; email: string; name: string; role: Role; clubId: string; avatarUrl?: string
}
interface S {
  user: UserProfile | null; loading: boolean
  setUser: (u: UserProfile | null) => void
  setLoading: (v: boolean) => void
}
export const useAuthStore = create<S>(set => ({
  user: null, loading: true,
  setUser: user => set({ user }),
  setLoading: loading => set({ loading }),
}))

import { useEffect } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { auth, db } from '../firebase/config'
import { useAuthStore, type UserProfile, type Role } from '../store/authStore'

export function useAuth() {
  const { setUser, setLoading } = useAuthStore()
  useEffect(() => {
    return onAuthStateChanged(auth, async fbUser => {
      if (fbUser) {
        try {
          const snap = await getDoc(doc(db, 'users', fbUser.uid))
          if (snap.exists()) {
            const d = snap.data() as any
            const rawRole = String(d.role || 'jugador')
            const role = (rawRole === 'super_admin' ? 'admin' : rawRole) as Role
            setUser({
              uid: fbUser.uid, email: fbUser.email || '',
              name: d.name || fbUser.email?.split('@')[0] || 'Usuario',
              role, clubId: d.clubId || 'rugbylab', avatarUrl: d.avatarUrl,
            })
          } else {
            const p: UserProfile = {
              uid: fbUser.uid, email: fbUser.email || '',
              name: fbUser.email?.split('@')[0] || 'Usuario',
              role: 'jugador', clubId: 'rugbylab',
            }
            await setDoc(doc(db, 'users', fbUser.uid), { ...p, createdAt: new Date() })
            setUser(p)
          }
        } catch { setUser(null) }
      } else { setUser(null) }
      setLoading(false)
    })
  }, [setUser, setLoading])
}

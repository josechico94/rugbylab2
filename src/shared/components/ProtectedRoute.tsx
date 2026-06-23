import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
export default function ProtectedRoute({children,roles}:{children:React.ReactNode;roles?:string[]}) {
  const {user,loading}=useAuthStore()
  if (loading) return (
    <div style={{height:'100dvh',display:'flex',alignItems:'center',justifyContent:'center',background:'#0A1628',flexDirection:'column',gap:14}}>
      <div style={{width:50,height:50,borderRadius:13,background:'#C8102E',display:'flex',alignItems:'center',justifyContent:'center',fontSize:24,boxShadow:'0 4px 20px rgba(200,16,46,.4)'}}>🏉</div>
      <div style={{color:'rgba(255,255,255,.35)',fontSize:12,letterSpacing:'.08em',textTransform:'uppercase'}}>Caricamento...</div>
    </div>
  )
  if (!user) return <Navigate to="/login" replace />
  if (roles&&!roles.includes(user.role)) return <Navigate to="/" replace />
  return <>{children}</>
}

import { useEffect, useState } from 'react'
export function useIsMobile(breakpoint = 768) {
  const [v, set] = useState(() => typeof window !== 'undefined' && window.innerWidth <= breakpoint)
  useEffect(() => {
    const mq = window.matchMedia(`(max-width:${breakpoint}px)`)
    const h = (e: MediaQueryListEvent) => set(e.matches)
    mq.addEventListener('change', h)
    return () => mq.removeEventListener('change', h)
  }, [breakpoint])
  return v
}

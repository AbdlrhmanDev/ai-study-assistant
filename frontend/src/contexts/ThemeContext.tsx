import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'

interface ThemeCtx {
  isDark: boolean
  toggle: () => void
  theme: 'light' | 'dark'
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeCtx>({ isDark: false, toggle: () => {}, theme: 'light', toggleTheme: () => {} })

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [isDark, setIsDark] = useState(() => {
    try { return localStorage.getItem('studia-theme') === 'dark' } catch { return false }
  })

  useEffect(() => {
    const root = document.documentElement
    if (isDark) {
      root.setAttribute('data-theme', 'dark')
      root.style.colorScheme = 'dark'
    } else {
      root.removeAttribute('data-theme')
      root.style.colorScheme = 'light'
    }
    try { localStorage.setItem('studia-theme', isDark ? 'dark' : 'light') } catch {}
  }, [isDark])

  const toggle = () => setIsDark(d => !d)
  return (
    <ThemeContext.Provider value={{ isDark, toggle, theme: isDark ? 'dark' : 'light', toggleTheme: toggle }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)

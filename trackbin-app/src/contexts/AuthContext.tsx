import React, { createContext, useContext, useState, useEffect } from 'react'
import { authService } from '../services/authService'
import type { User, Role, UserSession } from '../types/database'

export interface AuthUser extends User {
  role: Role
}

interface AuthContextType {
  user: AuthUser | null
  session: UserSession | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  getCurrentUserId: () => string | null
  hasPermission: (module: string, action: string) => Promise<boolean>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

interface AuthProviderProps {
  children: React.ReactNode
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [session, setSession] = useState<UserSession | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Check for existing session on mount
  useEffect(() => {
    checkSession()
  }, [])

  const checkSession = async () => {
    setIsLoading(true)
    try {
      const stored = authService.getStoredSession()
      if (stored) {
        const response = await authService.verifySession(stored.sessionToken)
        if (response) {
          setUser(response.user)
          setSession(response.session)
        } else {
          authService.clearStoredSession()
        }
      }
    } catch (error) {
      console.error('Session verification failed:', error)
      authService.clearStoredSession()
    } finally {
      setIsLoading(false)
    }
  }

  const login = async (email: string, password: string) => {
    setIsLoading(true)
    try {
      const response = await authService.login({ email, password })
      setUser(response.user)
      setSession(response.session)
      authService.saveSession(response.user, response.session)
    } catch (error) {
      console.error('Login failed:', error)
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  const logout = async () => {
    if (session) {
      try {
        await authService.logout(session.session_token)
      } catch (error) {
        console.error('Logout error:', error)
      }
    }
    authService.clearStoredSession()
    setUser(null)
    setSession(null)
  }

  const getCurrentUserId = (): string | null => {
    return user?.id || null
  }

  const hasPermission = async (module: string, action: string): Promise<boolean> => {
    if (!user) return false
    try {
      return await authService.hasPermission(user.id, module, action)
    } catch (error) {
      console.error('Permission check failed:', error)
      return false
    }
  }

  const value: AuthContextType = {
    user,
    session,
    isAuthenticated: !!user,
    isLoading,
    login,
    logout,
    getCurrentUserId,
    hasPermission
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
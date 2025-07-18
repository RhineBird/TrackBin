import { supabase } from '../lib/supabase'
import type { User, Role, UserSession } from '../types/database'
import { userService } from './userService'

export interface LoginRequest {
  email: string
  password: string
}

export interface LoginResponse {
  user: User & { role: Role }
  session: UserSession
}

export interface AuthContext {
  user: (User & { role: Role }) | null
  session: UserSession | null
  isAuthenticated: boolean
  isLoading: boolean
}

export const authService = {
  // Login user with email and password
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    const { email, password } = credentials

    // Get user with role - using two separate queries to avoid join issues
    const { data: userData, error: userError } = await supabase
      .from('app_users')
      .select('*')
      .eq('email', email)
      .eq('is_active', true)
      .single()

    if (userError || !userData) {
      throw new Error('Invalid email or password')
    }

    // Get the role separately
    const { data: roleData, error: roleError } = await supabase
      .from('roles')
      .select('id, name, description, is_system_role')
      .eq('id', userData.role_id)
      .single()

    if (roleError || !roleData) {
      throw new Error('Invalid email or password')
    }

    // Combine user and role data
    const userWithRole = {
      ...userData,
      roles: roleData
    }

    // Verify password
    const isValidPassword = await this.verifyPassword(password, userWithRole.password_hash)
    
    if (!isValidPassword) {
      throw new Error('Invalid email or password')
    }

    // Create session
    const session = await this.createSession(userWithRole.id)

    // Update last login
    await supabase
      .from('app_users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', userWithRole.id)

    // Transform user data
    const user = {
      ...userWithRole,
      role: userWithRole.roles,
      roles: undefined
    }

    return { user, session }
  },

  // Logout user and invalidate session
  async logout(sessionToken: string): Promise<void> {
    if (!sessionToken) return

    // Delete session from database
    await supabase
      .from('user_sessions')
      .delete()
      .eq('session_token', sessionToken)

    // Clear from local storage
    localStorage.removeItem('trackbin_session')
    localStorage.removeItem('trackbin_user')
  },

  // Verify session and get current user
  async verifySession(sessionToken: string): Promise<LoginResponse | null> {
    if (!sessionToken) return null

    // Get session with user data - using separate queries to avoid join issues
    const { data: sessionData, error: sessionError } = await supabase
      .from('user_sessions')
      .select('*')
      .eq('session_token', sessionToken)
      .gt('expires_at', new Date().toISOString())
      .single()

    if (sessionError || !sessionData) {
      return null
    }

    // Get user data separately
    const { data: userData, error: userError } = await supabase
      .from('app_users')
      .select('*')
      .eq('id', sessionData.user_id)
      .eq('is_active', true)
      .single()

    if (userError || !userData) {
      return null
    }

    // Get role data separately
    const { data: roleData, error: roleError } = await supabase
      .from('roles')
      .select('id, name, description, is_system_role')
      .eq('id', userData.role_id)
      .single()

    if (roleError || !roleData) {
      return null
    }

    // Update last activity
    await supabase
      .from('user_sessions')
      .update({ last_activity: new Date().toISOString() })
      .eq('id', sessionData.id)

    // Transform data
    const user = {
      ...userData,
      role: roleData,
      roles: undefined
    }

    const session = {
      ...sessionData,
      app_users: undefined
    }

    return { user, session }
  },

  // Create new session for user
  async createSession(userId: string): Promise<UserSession> {
    const sessionToken = this.generateSessionToken()
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + 24) // 24 hour session

    const { data: sessionData, error } = await supabase
      .from('user_sessions')
      .insert({
        user_id: userId,
        session_token: sessionToken,
        expires_at: expiresAt.toISOString(),
        ip_address: await this.getClientIP(),
        user_agent: navigator.userAgent
      })
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to create session: ${error.message}`)
    }

    return sessionData
  },

  // Extend session expiration
  async extendSession(sessionToken: string): Promise<void> {
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + 24) // Extend by 24 hours

    await supabase
      .from('user_sessions')
      .update({
        expires_at: expiresAt.toISOString(),
        last_activity: new Date().toISOString()
      })
      .eq('session_token', sessionToken)
  },

  // Clean up expired sessions
  async cleanupExpiredSessions(): Promise<void> {
    await supabase
      .from('user_sessions')
      .delete()
      .lt('expires_at', new Date().toISOString())
  },

  // Get all active sessions for a user
  async getUserSessions(userId: string): Promise<UserSession[]> {
    const { data, error } = await supabase
      .from('user_sessions')
      .select('*')
      .eq('user_id', userId)
      .gt('expires_at', new Date().toISOString())
      .order('last_activity', { ascending: false })

    if (error) {
      throw new Error(`Failed to get user sessions: ${error.message}`)
    }

    return data || []
  },

  // Revoke specific session
  async revokeSession(sessionId: string): Promise<void> {
    await supabase
      .from('user_sessions')
      .delete()
      .eq('id', sessionId)
  },

  // Revoke all sessions for user (force logout everywhere)
  async revokeAllUserSessions(userId: string): Promise<void> {
    await supabase
      .from('user_sessions')
      .delete()
      .eq('user_id', userId)
  },

  // Change password (requires current password)
  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await userService.getUserById(userId)
    if (!user) {
      throw new Error('User not found')
    }

    // Verify current password
    const isValidPassword = await this.verifyPassword(currentPassword, user.password_hash)
    if (!isValidPassword) {
      throw new Error('Current password is incorrect')
    }

    // Update password
    const newPasswordHash = await this.hashPassword(newPassword)
    await supabase
      .from('users')
      .update({ password_hash: newPasswordHash })
      .eq('id', userId)

    // Revoke all other sessions (force re-login)
    await this.revokeAllUserSessions(userId)
  },

  // Reset password (for admin use)
  async resetPassword(userId: string, newPassword: string, resetByUserId: string): Promise<void> {
    const newPasswordHash = await this.hashPassword(newPassword)
    
    await supabase
      .from('users')
      .update({ password_hash: newPasswordHash })
      .eq('id', userId)

    // Log the password reset
    await supabase
      .from('audit_logs')
      .insert({
        user_id: resetByUserId,
        action_type: 'password_reset',
        entity: 'user',
        entity_id: userId,
        timestamp: new Date().toISOString(),
        details_json: { target_user_id: userId, reset_by: resetByUserId }
      })

    // Revoke all sessions for the user
    await this.revokeAllUserSessions(userId)
  },

  // Check if user has permission
  async hasPermission(userId: string, module: string, action: string): Promise<boolean> {
    return await userService.hasPermission(userId, module, action)
  },

  // Get user permissions
  async getUserPermissions(userId: string): Promise<Array<{ module: string, action: string }>> {
    const user = await userService.getUserById(userId)
    if (!user || !user.is_active) {
      return []
    }

    // Get role permissions
    const { data: rolePermissions, error } = await supabase
      .from('role_permissions')
      .select(`
        permissions!inner(module, action)
      `)
      .eq('role_id', user.role_id)

    if (error) {
      throw new Error(`Failed to get permissions: ${error.message}`)
    }

    return rolePermissions?.map((rp: any) => ({
      module: rp.permissions.module,
      action: rp.permissions.action
    })) || []
  },

  // Utility: Generate session token
  generateSessionToken(): string {
    return 'session_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now()
  },

  // Utility: Get client IP address
  async getClientIP(): Promise<string | null> {
    try {
      const response = await fetch('https://api.ipify.org?format=json')
      const data = await response.json()
      return data.ip
    } catch {
      return null
    }
  },

  // Utility: Hash password
  async hashPassword(password: string): Promise<string> {
    // This is a simplified implementation for demo
    // In production, use proper bcrypt or scrypt
    return btoa(password)
  },

  // Utility: Verify password
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    // This is a simplified implementation for demo
    // In production, use proper bcrypt or scrypt
    return btoa(password) === hash
  },

  // Local storage helpers
  saveSession(user: User & { role: Role }, session: UserSession): void {
    localStorage.setItem('trackbin_user', JSON.stringify(user))
    localStorage.setItem('trackbin_session', session.session_token)
  },

  getStoredSession(): { user: User & { role: Role }, sessionToken: string } | null {
    const userStr = localStorage.getItem('trackbin_user')
    const sessionToken = localStorage.getItem('trackbin_session')

    if (!userStr || !sessionToken) {
      return null
    }

    try {
      const user = JSON.parse(userStr)
      return { user, sessionToken }
    } catch {
      return null
    }
  },

  clearStoredSession(): void {
    localStorage.removeItem('trackbin_user')
    localStorage.removeItem('trackbin_session')
  }
}
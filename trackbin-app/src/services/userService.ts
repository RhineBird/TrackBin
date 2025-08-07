import { supabase } from '../lib/supabase'
import type { User, Role, Permission, RolePermission, UserPermission, RoleAssignment } from '../types/database'

export interface UserWithRole extends User {
  role?: Role
}

export interface RoleWithPermissions extends Role {
  permissions?: Permission[]
}

export interface CreateUserRequest {
  name: string
  email: string
  password: string
  role_id: string
  created_by: string
}

export interface UpdateUserRequest {
  name?: string
  email?: string
  is_active?: boolean
  role_id?: string
  updated_by?: string
}

export interface ChangePasswordRequest {
  current_password: string
  new_password: string
}

export interface UserPermissionCheck {
  user_id: string
  module: string
  action: string
}

export const userService = {
  // Get all users with their roles
  async getUsers(): Promise<UserWithRole[]> {
    const { data, error } = await supabase
      .from('app_users')
      .select(`
        *,
        roles!inner(id, name, description, is_system_role)
      `)
      .order('name')

    if (error) {
      throw new Error(`Failed to fetch users: ${error.message}`)
    }

    return (data || []).map(user => ({
      ...user,
      role: user.roles,
      roles: undefined
    }))
  },

  // Get single user by ID
  async getUserById(id: string): Promise<UserWithRole | null> {
    const { data, error } = await supabase
      .from('app_users')
      .select(`
        *,
        roles!inner(id, name, description, is_system_role)
      `)
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return null
      }
      throw new Error(`Failed to fetch user: ${error.message}`)
    }

    return {
      ...data,
      role: data.roles,
      roles: undefined
    }
  },

  // Create new user
  async createUser(request: CreateUserRequest): Promise<User> {
    // Check if email already exists
    const { data: existingUser } = await supabase
      .from('app_users')
      .select('id')
      .eq('email', request.email)
      .single()

    if (existingUser) {
      throw new Error('User with this email already exists')
    }

    // Hash password (in production, this should be done server-side)
    const passwordHash = await this.hashPassword(request.password)

    const { data, error } = await supabase
      .from('app_users')
      .insert({
        name: request.name,
        email: request.email,
        password_hash: passwordHash,
        role_id: request.role_id,
        is_active: true,
        created_by: request.created_by
      })
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to create user: ${error.message}`)
    }

    // Log role assignment
    await this.logRoleAssignment(data.id, request.role_id, 'User created with initial role', request.created_by)

    return data
  },

  // Update user
  async updateUser(id: string, request: UpdateUserRequest): Promise<User> {
    const currentUser = await this.getUserById(id)
    if (!currentUser) {
      throw new Error('User not found')
    }

    // Check if email is being changed and if it already exists
    if (request.email && request.email !== currentUser.email) {
      const { data: existingUser } = await supabase
        .from('app_users')
        .select('id')
        .eq('email', request.email)
        .neq('id', id)
        .single()

      if (existingUser) {
        throw new Error('User with this email already exists')
      }
    }

    const { data, error } = await supabase
      .from('app_users')
      .update(request)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to update user: ${error.message}`)
    }

    // Log role assignment if role changed
    if (request.role_id && request.role_id !== currentUser.role_id && request.updated_by) {
      await this.logRoleAssignment(id, request.role_id, 'Role updated', request.updated_by)
    }

    return data
  },

  // Delete user (set inactive)
  async deleteUser(id: string): Promise<void> {
    const { error } = await supabase
      .from('app_users')
      .update({ is_active: false })
      .eq('id', id)

    if (error) {
      throw new Error(`Failed to delete user: ${error.message}`)
    }
  },

  // Change user password
  async changePassword(userId: string, request: ChangePasswordRequest): Promise<void> {
    const user = await this.getUserById(userId)
    if (!user) {
      throw new Error('User not found')
    }

    // Verify current password
    const isValid = await this.verifyPassword(request.current_password, user.password_hash)
    if (!isValid) {
      throw new Error('Current password is incorrect')
    }

    // Hash new password
    const newPasswordHash = await this.hashPassword(request.new_password)

    const { error } = await supabase
      .from('app_users')
      .update({ password_hash: newPasswordHash })
      .eq('id', userId)

    if (error) {
      throw new Error(`Failed to change password: ${error.message}`)
    }
  },

  // Get all roles
  async getRoles(): Promise<Role[]> {
    const { data, error } = await supabase
      .from('roles')
      .select('*')
      .order('name')

    if (error) {
      throw new Error(`Failed to fetch roles: ${error.message}`)
    }

    return data || []
  },

  // Get role with permissions
  async getRoleWithPermissions(roleId: string): Promise<RoleWithPermissions | null> {
    const { data, error } = await supabase
      .from('roles')
      .select(`
        *,
        role_permissions!inner(
          permissions!inner(id, module, action, description)
        )
      `)
      .eq('id', roleId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return null
      }
      throw new Error(`Failed to fetch role: ${error.message}`)
    }

    return {
      ...data,
      permissions: data.role_permissions?.map((rp: any) => rp.permissions) || [],
      role_permissions: undefined
    }
  },

  // Create new role
  async createRole(name: string, description: string): Promise<Role> {
    const { data, error } = await supabase
      .from('roles')
      .insert({
        name,
        description,
        is_system_role: false
      })
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to create role: ${error.message}`)
    }

    return data
  },

  // Update role
  async updateRole(id: string, name: string, description: string): Promise<Role> {
    const { data, error } = await supabase
      .from('roles')
      .update({ name, description })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to update role: ${error.message}`)
    }

    return data
  },

  // Delete role
  async deleteRole(id: string): Promise<void> {
    // Check if role is system role
    const role = await this.getRoleWithPermissions(id)
    if (role?.is_system_role) {
      throw new Error('Cannot delete system role')
    }

    // Check if role is in use
    const { data: usersWithRole, error: usersError } = await supabase
      .from('app_users')
      .select('id')
      .eq('role_id', id)
      .limit(1)

    if (usersError) {
      throw new Error(`Failed to check role usage: ${usersError.message}`)
    }

    if (usersWithRole && usersWithRole.length > 0) {
      throw new Error('Cannot delete role that is assigned to users')
    }

    const { error } = await supabase
      .from('roles')
      .delete()
      .eq('id', id)

    if (error) {
      throw new Error(`Failed to delete role: ${error.message}`)
    }
  },

  // Get all permissions
  async getPermissions(): Promise<Permission[]> {
    const { data, error } = await supabase
      .from('permissions')
      .select('*')
      .order('module', { ascending: true })
      .order('action', { ascending: true })

    if (error) {
      throw new Error(`Failed to fetch permissions: ${error.message}`)
    }

    return data || []
  },

  // Update role permissions
  async updateRolePermissions(roleId: string, permissionIds: string[]): Promise<void> {
    // Remove existing permissions
    const { error: deleteError } = await supabase
      .from('role_permissions')
      .delete()
      .eq('role_id', roleId)

    if (deleteError) {
      throw new Error(`Failed to remove existing permissions: ${deleteError.message}`)
    }

    // Add new permissions
    if (permissionIds.length > 0) {
      const rolePermissions = permissionIds.map(permissionId => ({
        role_id: roleId,
        permission_id: permissionId
      }))

      const { error: insertError } = await supabase
        .from('role_permissions')
        .insert(rolePermissions)

      if (insertError) {
        throw new Error(`Failed to assign permissions: ${insertError.message}`)
      }
    }
  },

  // Check if user has permission
  async hasPermission(userId: string, module: string, action: string): Promise<boolean> {
    const user = await this.getUserById(userId)
    if (!user || !user.is_active) {
      return false
    }

    // Check role permissions
    const { data: rolePermissions, error } = await supabase
      .from('role_permissions')
      .select(`
        permissions!inner(module, action)
      `)
      .eq('role_id', user.role_id)

    if (error) {
      throw new Error(`Failed to check permissions: ${error.message}`)
    }

    const hasRolePermission = rolePermissions?.some((rp: any) => 
      rp.permissions.module === module && rp.permissions.action === action
    )

    if (hasRolePermission) {
      return true
    }

    // Check user-specific permission overrides
    const { data: userPermissions, error: userError } = await supabase
      .from('user_permissions')
      .select(`
        granted,
        permissions!inner(module, action)
      `)
      .eq('user_id', userId)

    if (userError) {
      throw new Error(`Failed to check user permissions: ${userError.message}`)
    }

    const userPermission = userPermissions?.find((up: any) => 
      up.permissions.module === module && up.permissions.action === action
    )

    return userPermission?.granted || false
  },

  // Log role assignment
  async logRoleAssignment(userId: string, roleId: string, reason: string, assignedBy: string): Promise<void> {
    const { error } = await supabase
      .from('role_assignments')
      .insert({
        user_id: userId,
        role_id: roleId,
        assigned_by: assignedBy,
        assigned_at: new Date().toISOString(),
        reason
      })

    if (error) {
      console.error('Failed to log role assignment:', error)
    }
  },

  // Password hashing utility (simplified - in production use proper bcrypt)
  async hashPassword(password: string): Promise<string> {
    // This is a simplified implementation
    // In production, use proper bcrypt or scrypt
    return btoa(password) // Base64 encoding for demo
  },

  // Password verification utility
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    // This is a simplified implementation
    // In production, use proper bcrypt or scrypt
    return btoa(password) === hash
  },

  // Search users
  async searchUsers(query: string): Promise<UserWithRole[]> {
    const { data, error } = await supabase
      .from('app_users')
      .select(`
        *,
        roles!inner(id, name, description, is_system_role)
      `)
      .or(`name.ilike.%${query}%,email.ilike.%${query}%`)
      .order('name')

    if (error) {
      throw new Error(`Failed to search users: ${error.message}`)
    }

    return (data || []).map(user => ({
      ...user,
      role: user.roles,
      roles: undefined
    }))
  },

  // Get user activity logs
  async getUserActivity(userId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('user_id', userId)
      .order('timestamp', { ascending: false })
      .limit(50)

    if (error) {
      throw new Error(`Failed to fetch user activity: ${error.message}`)
    }

    return data || []
  }
}
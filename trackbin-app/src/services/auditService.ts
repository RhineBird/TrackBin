import { supabase } from '../lib/supabase'

export interface AuditLog {
  id: string
  user_id: string
  action_type: string
  entity: string
  entity_id: string
  timestamp: string
  details_json: any
}

export interface AuditLogWithDetails extends AuditLog {
  user_name?: string
  entity_details?: string
}

export interface AuditFilters {
  action_type?: string
  entity?: string
  user_id?: string
  start_date?: string
  end_date?: string
}

export const auditService = {
  // Get audit logs with optional filters
  async getAuditLogs(filters: AuditFilters = {}, limit: number = 50): Promise<AuditLogWithDetails[]> {
    // First, try with the foreign key join
    let query = supabase
      .from('audit_logs')
      .select('*')
      .order('timestamp', { ascending: false })

    // Apply filters
    if (filters.action_type) {
      query = query.eq('action_type', filters.action_type)
    }
    
    if (filters.entity) {
      query = query.eq('entity', filters.entity)
    }
    
    if (filters.user_id) {
      query = query.eq('user_id', filters.user_id)
    }
    
    if (filters.start_date) {
      query = query.gte('timestamp', filters.start_date)
    }
    
    if (filters.end_date) {
      query = query.lte('timestamp', filters.end_date)
    }

    if (limit) {
      query = query.limit(limit)
    }

    const { data: auditData, error } = await query

    if (error) {
      throw new Error(`Failed to fetch audit logs: ${error.message}`)
    }

    if (!auditData || auditData.length === 0) {
      return []
    }

    // Get unique user IDs to fetch user names
    const userIds = [...new Set(auditData.map(log => log.user_id).filter(Boolean))]
    let userMap: Record<string, string> = {}

    if (userIds.length > 0) {
      try {
        const { data: userData } = await supabase
          .from('app_users')
          .select('id, name')
          .in('id', userIds)
        
        if (userData) {
          userMap = userData.reduce((acc, user) => {
            acc[user.id] = user.name
            return acc
          }, {} as Record<string, string>)
        }
      } catch (userError) {
        console.warn('Could not fetch user names:', userError)
      }
    }

    return auditData.map(log => ({
      ...log,
      user_name: log.details_json?.performed_by || userMap[log.user_id] || (log.user_id === '00000000-0000-0000-0000-000000000000' ? 'System' : 'Unknown'),
      entity_details: this.formatEntityDetails(log.entity, log.details_json)
    }))
  },

  // Search audit logs by various criteria
  async searchAuditLogs(searchQuery: string, limit: number = 50): Promise<AuditLogWithDetails[]> {
    const { data: auditData, error } = await supabase
      .from('audit_logs')
      .select('*')
      .or(`entity.ilike.%${searchQuery}%,action_type.ilike.%${searchQuery}%`)
      .order('timestamp', { ascending: false })
      .limit(limit)

    if (error) {
      throw new Error(`Failed to search audit logs: ${error.message}`)
    }

    if (!auditData || auditData.length === 0) {
      return []
    }

    // Get unique user IDs to fetch user names
    const userIds = [...new Set(auditData.map(log => log.user_id).filter(Boolean))]
    let userMap: Record<string, string> = {}

    if (userIds.length > 0) {
      try {
        const { data: userData } = await supabase
          .from('app_users')
          .select('id, name')
          .in('id', userIds)
        
        if (userData) {
          userMap = userData.reduce((acc, user) => {
            acc[user.id] = user.name
            return acc
          }, {} as Record<string, string>)
        }
      } catch (userError) {
        console.warn('Could not fetch user names:', userError)
      }
    }

    // Filter by user name if search query might match names
    const filteredData = auditData.filter(log => {
      const userName = log.details_json?.performed_by || userMap[log.user_id] || ''
      return userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
             log.entity.toLowerCase().includes(searchQuery.toLowerCase()) ||
             log.action_type.toLowerCase().includes(searchQuery.toLowerCase())
    })

    return filteredData.map(log => ({
      ...log,
      user_name: log.details_json?.performed_by || userMap[log.user_id] || (log.user_id === '00000000-0000-0000-0000-000000000000' ? 'System' : 'Unknown'),
      entity_details: this.formatEntityDetails(log.entity, log.details_json)
    }))
  },

  // Get unique action types for filtering
  async getActionTypes(): Promise<string[]> {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('action_type')
      .order('action_type')

    if (error) {
      throw new Error(`Failed to fetch action types: ${error.message}`)
    }

    const uniqueTypes = [...new Set(data.map(log => log.action_type))]
    return uniqueTypes
  },

  // Get unique entities for filtering
  async getEntities(): Promise<string[]> {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('entity')
      .order('entity')

    if (error) {
      throw new Error(`Failed to fetch entities: ${error.message}`)
    }

    const uniqueEntities = [...new Set(data.map(log => log.entity))]
    return uniqueEntities
  },

  // Get audit statistics
  async getAuditStats(days: number = 30): Promise<{
    total_actions: number
    unique_users: number
    most_common_action: string
    most_active_entity: string
  }> {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    const { data, error } = await supabase
      .from('audit_logs')
      .select('action_type, entity, user_id')
      .gte('timestamp', startDate.toISOString())

    if (error) {
      throw new Error(`Failed to fetch audit statistics: ${error.message}`)
    }

    const actionCounts = new Map<string, number>()
    const entityCounts = new Map<string, number>()
    const uniqueUsers = new Set<string>()

    data.forEach(log => {
      actionCounts.set(log.action_type, (actionCounts.get(log.action_type) || 0) + 1)
      entityCounts.set(log.entity, (entityCounts.get(log.entity) || 0) + 1)
      uniqueUsers.add(log.user_id)
    })

    const mostCommonAction = [...actionCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || 'None'
    const mostActiveEntity = [...entityCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || 'None'

    return {
      total_actions: data.length,
      unique_users: uniqueUsers.size,
      most_common_action: mostCommonAction,
      most_active_entity: mostActiveEntity
    }
  },

  // Format entity details for display
  formatEntityDetails(entity: string, details: any): string {
    if (!details) return 'No details available'

    try {
      switch (entity) {
        case 'items':
          if (details.changes) {
            // This is an update operation
            const changeList = Object.keys(details.changes).join(', ')
            return `Updated item "${details.name}" (${details.sku}) - Changed: ${changeList}`
          } else {
            // This is a create or delete operation
            return `Item "${details.name}" (SKU: ${details.sku})`
          }
        
        case 'receipts':
          return `Receipt "${details.reference_code}" from ${details.supplier} with ${details.total_items} item${details.total_items !== 1 ? 's' : ''}`
        
        case 'shipments':
          return `Shipment "${details.reference_code}" to ${details.customer} with ${details.total_items} item${details.total_items !== 1 ? 's' : ''}`
        
        case 'stock_entries':
          if (details.operation === 'receipt') {
            if (details.initial_quantity) {
              return `New stock created with ${details.initial_quantity} units`
            }
            return `Stock increased by ${details.quantity_added} units (${details.previous_quantity} → ${details.new_quantity})`
          } else if (details.operation === 'shipment') {
            if (details.result === 'stock_depleted') {
              return `Stock depleted: shipped ${details.quantity_shipped} units (was ${details.previous_quantity})`
            }
            return `Stock reduced by ${details.quantity_shipped} units (${details.previous_quantity} → ${details.new_quantity})`
          }
          return `Stock quantity: ${details.quantity || 'Unknown'} units`
        
        case 'stock_movements':
          const fromBin = details.from_bin ? ` from ${details.from_bin}` : ''
          const toBin = details.to_bin ? ` to ${details.to_bin}` : ''
          const reason = details.reason ? ` (${details.reason})` : ''
          return `Moved ${details.quantity || 'Unknown'} units${fromBin}${toBin}${reason}`
        
        case 'users':
          return `User "${details.name}" (${details.email})`
        
        default:
          // For unknown entities, try to display meaningful information
          if (details.name) {
            return `${entity.replace('_', ' ')} "${details.name}"`
          }
          if (details.reference_code) {
            return `${entity.replace('_', ' ')} "${details.reference_code}"`
          }
          return `${entity.replace('_', ' ')} record`
      }
    } catch (error) {
      console.error('Error formatting entity details:', error)
      return 'Details formatting error'
    }
  },

  // Export audit logs to CSV format
  async exportAuditLogs(filters: AuditFilters = {}): Promise<string> {
    const logs = await this.getAuditLogs(filters, 1000) // Get up to 1000 records for export

    const headers = ['Timestamp', 'User', 'Action', 'Entity', 'Details']
    const rows = logs.map(log => [
      new Date(log.timestamp).toISOString(),
      log.user_name || 'Unknown',
      log.action_type,
      log.entity,
      log.entity_details || 'No details'
    ])

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n')

    return csvContent
  },

  // Create audit log entry
  async createAuditLog(
    userId: string,
    actionType: string,
    entity: string,
    entityId: string,
    details?: any
  ): Promise<void> {
    console.log('Creating audit log:', { userId, actionType, entity, entityId, details })
    
    try {
      let auditUserId = userId
      let auditDetails = details || {}

      // If we have user details in the details object, store them for display
      if (details?.user_name) {
        auditDetails = { ...details, performed_by: details.user_name }
      }

      // Handle different user ID formats
      if (userId === 'system') {
        auditUserId = '00000000-0000-0000-0000-000000000000'
        auditDetails = { ...auditDetails, performed_by: 'System' }
      } else if (userId && userId.startsWith('ace')) {
        // This is an app_user ID, we'll store the user name in details for now
        auditUserId = '00000000-0000-0000-0000-000000000001' // Use a known system user
        auditDetails = { ...auditDetails, performed_by: details?.user_name || 'App User' }
      }
      
      console.log('Final audit data:', { auditUserId, actionType, entity, entityId, auditDetails })
      
      const { data, error } = await supabase
        .from('audit_logs')
        .insert({
          user_id: auditUserId,
          action_type: actionType,
          entity: entity,
          entity_id: entityId,
          details_json: auditDetails,
          timestamp: new Date().toISOString()
        })
        .select()
        
      if (error) {
        console.error('Audit log insert error:', error)
      } else {
        console.log('Audit log created successfully:', data)
      }
    } catch (error) {
      console.error('Failed to create audit log:', error)
      // Don't throw - audit logging should not break main functionality
    }
  },

  // Subscribe to real-time audit log updates
  subscribeToAuditLogs(callback: (payload: any) => void) {
    return supabase
      .channel('audit_logs_changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'audit_logs' 
        }, 
        callback
      )
      .subscribe()
  }
}
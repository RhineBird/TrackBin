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
    let query = supabase
      .from('audit_logs')
      .select(`
        *,
        users!inner(name)
      `)
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

    const { data, error } = await query

    if (error) {
      throw new Error(`Failed to fetch audit logs: ${error.message}`)
    }

    return (data || []).map(log => ({
      ...log,
      user_name: log.users?.name,
      entity_details: this.formatEntityDetails(log.entity, log.details_json),
      users: undefined
    }))
  },

  // Search audit logs by various criteria
  async searchAuditLogs(searchQuery: string, limit: number = 50): Promise<AuditLogWithDetails[]> {
    const { data, error } = await supabase
      .from('audit_logs')
      .select(`
        *,
        users!inner(name)
      `)
      .or(`entity.ilike.%${searchQuery}%,action_type.ilike.%${searchQuery}%,users.name.ilike.%${searchQuery}%`)
      .order('timestamp', { ascending: false })
      .limit(limit)

    if (error) {
      throw new Error(`Failed to search audit logs: ${error.message}`)
    }

    return (data || []).map(log => ({
      ...log,
      user_name: log.users?.name,
      entity_details: this.formatEntityDetails(log.entity, log.details_json),
      users: undefined
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
    if (!details) return 'No details'

    try {
      switch (entity) {
        case 'items':
          return details.sku ? `${details.sku} - ${details.name || 'Unknown'}` : 'Item'
        case 'stock_entries':
          return `Quantity: ${details.quantity || 'Unknown'}`
        case 'stock_movements':
          return `Moved ${details.quantity || 'Unknown'} units`
        case 'receipts':
          return `Receipt ${details.reference_code || 'Unknown'}`
        case 'shipments':
          return `Shipment ${details.reference_code || 'Unknown'}`
        default:
          return `${entity} modified`
      }
    } catch {
      return 'Invalid details'
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
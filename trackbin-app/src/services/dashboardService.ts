import { supabase } from '../lib/supabase'

export interface DashboardMetrics {
  totalItems: number
  lowStockAlerts: number
  totalStockValue: number
  activeBins: number
}

export interface LowStockItem {
  id: string
  sku: string
  name: string
  available_quantity: number
}

export interface RecentActivity {
  id: string
  action_type: string
  entity: string
  entity_id: string
  timestamp: string
  user_name?: string
  details: any
}

export const dashboardService = {
  // Get main dashboard metrics
  async getMetrics(): Promise<DashboardMetrics> {
    try {
      // Get total active items count
      const { count: totalItems, error: itemsError } = await supabase
        .from('items')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true)

      if (itemsError) throw itemsError

      // Get low stock items (available quantity < 10)
      const { data: stockData, error: stockError } = await supabase
        .from('stock_entries')
        .select(`
          item_id,
          quantity,
          status,
          items!inner(id, sku, name, is_active)
        `)
        .eq('items.is_active', true)

      if (stockError) throw stockError

      // Calculate metrics from stock data
      const stockByItem = new Map<string, { total: number, available: number }>()
      
      stockData?.forEach((entry: any) => {
        const itemId = entry.item_id
        const current = stockByItem.get(itemId) || { total: 0, available: 0 }
        
        current.total += entry.quantity
        if (entry.status === 'available') {
          current.available += entry.quantity
        }
        
        stockByItem.set(itemId, current)
      })

      // Count items with low stock (available < 10)
      const lowStockAlerts = Array.from(stockByItem.values())
        .filter(item => item.available < 10 && item.available > 0).length

      // Calculate total stock value (sum of all quantities)
      const totalStockValue = Array.from(stockByItem.values())
        .reduce((sum, item) => sum + item.total, 0)

      // Get active bins count (bins that have stock)
      const { count: activeBins, error: binsError } = await supabase
        .from('stock_entries')
        .select('bin_id', { count: 'exact', head: true })
        .gt('quantity', 0)

      if (binsError) throw binsError

      return {
        totalItems: totalItems || 0,
        lowStockAlerts,
        totalStockValue,
        activeBins: activeBins || 0
      }
    } catch (error) {
      throw new Error(`Failed to fetch dashboard metrics: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  },

  // Get items with low stock for detailed view
  async getLowStockItems(): Promise<LowStockItem[]> {
    try {
      const { data, error } = await supabase
        .from('stock_entries')
        .select(`
          item_id,
          quantity,
          status,
          items!inner(id, sku, name, is_active)
        `)
        .eq('items.is_active', true)

      if (error) throw error

      // Group by item and calculate available quantities
      const stockByItem = new Map<string, any>()
      
      data?.forEach((entry: any) => {
        const itemId = entry.item_id
        if (!stockByItem.has(itemId)) {
          stockByItem.set(itemId, {
            id: entry.items.id,
            sku: entry.items.sku,
            name: entry.items.name,
            available_quantity: 0
          })
        }
        
        if (entry.status === 'available') {
          const current = stockByItem.get(itemId)!
          current.available_quantity += entry.quantity
        }
      })

      // Filter items with low stock (available < 10 but > 0)
      return Array.from(stockByItem.values())
        .filter(item => item.available_quantity < 10 && item.available_quantity > 0)
        .sort((a, b) => a.available_quantity - b.available_quantity)
    } catch (error) {
      throw new Error(`Failed to fetch low stock items: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  },

  // Get recent activity from audit logs
  async getRecentActivity(limit: number = 10): Promise<RecentActivity[]> {
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select(`
          id,
          action_type,
          entity,
          entity_id,
          timestamp,
          details_json,
          users!inner(name)
        `)
        .order('timestamp', { ascending: false })
        .limit(limit)

      if (error) throw error

      return (data || []).map(log => ({
        id: log.id,
        action_type: log.action_type,
        entity: log.entity,
        entity_id: log.entity_id,
        timestamp: log.timestamp,
        user_name: log.users?.name,
        details: log.details_json
      }))
    } catch (error) {
      throw new Error(`Failed to fetch recent activity: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  },

  // Get quick stats for specific entities
  async getItemStats() {
    try {
      const { data, error } = await supabase
        .from('items')
        .select('id, sku, name')
        .eq('is_active', true)
        .limit(5)

      if (error) throw error
      return data || []
    } catch (error) {
      throw new Error(`Failed to fetch item stats: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  },

  // Subscribe to real-time updates for dashboard
  subscribeToUpdates(callback: (payload: any) => void) {
    const channels = [
      supabase
        .channel('dashboard_items')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'items' }, callback),
      
      supabase
        .channel('dashboard_stock')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'stock_entries' }, callback),
      
      supabase
        .channel('dashboard_audit')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'audit_logs' }, callback)
    ]

    channels.forEach(channel => channel.subscribe())

    return {
      unsubscribe: () => {
        channels.forEach(channel => channel.unsubscribe())
      }
    }
  }
}
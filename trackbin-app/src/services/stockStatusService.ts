import { supabase } from '../lib/supabase'
import type { StockEntry } from '../types/database'

export interface StatusUpdateRequest {
  stockEntryId: string
  newStatus: 'available' | 'reserved' | 'quarantined' | 'damaged'
  reason: string
}

export interface BulkStatusUpdateRequest {
  stockEntryIds: string[]
  newStatus: 'available' | 'reserved' | 'quarantined' | 'damaged'
  reason: string
}

export interface StockStatusHistory {
  id: string
  stock_entry_id: string
  old_status: string
  new_status: string
  reason: string
  changed_by_user_id: string
  changed_at: string
  user_name?: string
}

export interface StockEntryWithDetails extends StockEntry {
  item_sku?: string
  item_name?: string
  bin_name?: string
  zone_name?: string
  warehouse_name?: string
}

export const stockStatusService = {
  // Validate status transitions based on business rules
  validateStatusTransition(currentStatus: string, newStatus: string): { valid: boolean, error?: string } {
    if (currentStatus === newStatus) {
      return { valid: false, error: 'Status is already set to this value' }
    }

    // Define allowed transitions
    const allowedTransitions: { [key: string]: string[] } = {
      available: ['reserved', 'quarantined', 'damaged'],
      reserved: ['available', 'quarantined', 'damaged'],
      quarantined: ['available', 'damaged'], // Cannot go directly to reserved
      damaged: ['quarantined'] // Can only go to quarantined for re-inspection
    }

    const allowed = allowedTransitions[currentStatus] || []
    
    if (!allowed.includes(newStatus)) {
      return { 
        valid: false, 
        error: `Cannot change status from ${currentStatus} to ${newStatus}` 
      }
    }

    return { valid: true }
  },

  // Update stock status for a single entry
  async updateStockStatus(request: StatusUpdateRequest): Promise<StockEntry> {
    // Get current stock entry
    const { data: currentEntry, error: fetchError } = await supabase
      .from('stock_entries')
      .select('*')
      .eq('id', request.stockEntryId)
      .single()

    if (fetchError || !currentEntry) {
      throw new Error('Stock entry not found')
    }

    // Validate transition
    const validation = this.validateStatusTransition(currentEntry.status, request.newStatus)
    if (!validation.valid) {
      throw new Error(validation.error)
    }

    // Update the stock entry
    const { data: updatedEntry, error: updateError } = await supabase
      .from('stock_entries')
      .update({ 
        status: request.newStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', request.stockEntryId)
      .select()
      .single()

    if (updateError) {
      throw new Error(`Failed to update stock status: ${updateError.message}`)
    }

    // Log the status change
    await this.logStatusChange({
      stock_entry_id: request.stockEntryId,
      old_status: currentEntry.status,
      new_status: request.newStatus,
      reason: request.reason,
      changed_by_user_id: 'a0000000-0000-4000-8000-000000000001' // Default admin user for now
    })

    return updatedEntry
  },

  // Bulk update stock status
  async bulkUpdateStatus(request: BulkStatusUpdateRequest): Promise<StockEntry[]> {
    const results: StockEntry[] = []

    // Process each stock entry individually to validate transitions
    for (const stockEntryId of request.stockEntryIds) {
      try {
        const result = await this.updateStockStatus({
          stockEntryId,
          newStatus: request.newStatus,
          reason: request.reason
        })
        results.push(result)
      } catch (error) {
        console.error(`Failed to update stock entry ${stockEntryId}:`, error)
        // Continue with other entries
      }
    }

    return results
  },

  // Log status change for audit trail
  async logStatusChange(change: {
    stock_entry_id: string
    old_status: string
    new_status: string
    reason: string
    changed_by_user_id: string
  }): Promise<void> {
    const { error } = await supabase
      .from('stock_status_history')
      .insert({
        stock_entry_id: change.stock_entry_id,
        old_status: change.old_status,
        new_status: change.new_status,
        reason: change.reason,
        changed_by_user_id: change.changed_by_user_id,
        changed_at: new Date().toISOString()
      })

    if (error) {
      console.error('Failed to log status change:', error)
      // Don't throw error here to avoid breaking the main operation
    }
  },

  // Get status change history for a stock entry
  async getStatusHistory(stockEntryId: string): Promise<StockStatusHistory[]> {
    const { data, error } = await supabase
      .from('stock_status_history')
      .select(`
        *,
        users!inner(name)
      `)
      .eq('stock_entry_id', stockEntryId)
      .order('changed_at', { ascending: false })

    if (error) {
      throw new Error(`Failed to fetch status history: ${error.message}`)
    }

    return (data || []).map(entry => ({
      ...entry,
      user_name: entry.users?.name,
      users: undefined
    }))
  },

  // Get stock entries with detailed information for status management
  async getStockEntriesWithDetails(filters?: {
    itemId?: string
    binId?: string
    status?: string
    limit?: number
  }): Promise<StockEntryWithDetails[]> {
    let query = supabase
      .from('stock_entries')
      .select(`
        *,
        items!inner(sku, name),
        bins!inner(
          name,
          zones!inner(
            name,
            warehouses!inner(name)
          )
        )
      `)
      .gt('quantity', 0)
      .order('updated_at', { ascending: false })

    if (filters?.itemId) {
      query = query.eq('item_id', filters.itemId)
    }

    if (filters?.binId) {
      query = query.eq('bin_id', filters.binId)
    }

    if (filters?.status) {
      query = query.eq('status', filters.status)
    }

    if (filters?.limit) {
      query = query.limit(filters.limit)
    }

    const { data, error } = await query

    if (error) {
      throw new Error(`Failed to fetch stock entries: ${error.message}`)
    }

    return (data || []).map(entry => ({
      ...entry,
      item_sku: entry.items?.sku,
      item_name: entry.items?.name,
      bin_name: entry.bins?.name,
      zone_name: entry.bins?.zones?.name,
      warehouse_name: entry.bins?.zones?.warehouses?.name,
      items: undefined,
      bins: undefined
    }))
  },

  // Get status summary for an item
  async getItemStatusSummary(itemId: string): Promise<{
    available: number
    reserved: number
    quarantined: number
    damaged: number
    total: number
  }> {
    const { data, error } = await supabase
      .from('stock_entries')
      .select('quantity, status')
      .eq('item_id', itemId)
      .gt('quantity', 0)

    if (error) {
      throw new Error(`Failed to fetch item status summary: ${error.message}`)
    }

    const summary = {
      available: 0,
      reserved: 0,
      quarantined: 0,
      damaged: 0,
      total: 0
    }

    ;(data || []).forEach(entry => {
      summary[entry.status as keyof typeof summary] += entry.quantity
      summary.total += entry.quantity
    })

    return summary
  },

  // Subscribe to stock status changes
  subscribeToStatusChanges(callback: (payload: any) => void) {
    return supabase
      .channel('stock_status_changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'stock_entries' 
        }, 
        callback
      )
      .subscribe()
  }
}
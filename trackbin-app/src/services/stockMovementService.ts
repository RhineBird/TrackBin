import { supabase } from '../lib/supabase'
import type { StockMovement, StockEntry, Item, Bin } from '../types/database'

export interface StockMovementWithDetails extends StockMovement {
  item?: Item
  from_bin?: Bin
  to_bin?: Bin
  user_name?: string
}

export interface BinWithLocation extends Bin {
  zone_name?: string
  warehouse_name?: string
}

export interface ItemStockLocation {
  stock_entry_id: string
  item_id: string
  item_sku: string
  item_name: string
  bin_id: string
  bin_name: string
  zone_name: string
  warehouse_name: string
  quantity: number
  status: 'available' | 'reserved' | 'quarantined' | 'damaged'
}

export interface MovementRequest {
  item_id: string
  from_bin_id: string
  to_bin_id: string
  quantity: number
  reason: string
  user_id: string
}

export const stockMovementService = {
  // Get all stock movements with details
  async getMovements(limit?: number): Promise<StockMovementWithDetails[]> {
    let query = supabase
      .from('stock_movements')
      .select(`
        *,
        items(id, sku, name),
        from_bins:from_bin_id(id, name),
        to_bins:to_bin_id(id, name),
        users(name)
      `)
      .order('created_at', { ascending: false })

    if (limit) {
      query = query.limit(limit)
    }

    const { data, error } = await query

    if (error) {
      throw new Error(`Failed to fetch stock movements: ${error.message}`)
    }

    return (data || []).map(movement => ({
      ...movement,
      item: movement.items,
      from_bin: movement.from_bins,
      to_bin: movement.to_bins,
      user_name: movement.users?.name,
      items: undefined,
      from_bins: undefined,
      to_bins: undefined,
      users: undefined
    }))
  },

  // Get stock locations for an item
  async getItemStockLocations(itemId: string): Promise<ItemStockLocation[]> {
    const { data, error } = await supabase
      .from('stock_entries')
      .select(`
        *,
        items!inner(id, sku, name),
        bins!inner(
          id, 
          name,
          zones!inner(
            name,
            warehouses!inner(name)
          )
        )
      `)
      .eq('item_id', itemId)
      .gt('quantity', 0)

    if (error) {
      throw new Error(`Failed to fetch item stock locations: ${error.message}`)
    }

    return (data || []).map(entry => ({
      stock_entry_id: entry.id,
      item_id: entry.items.id,
      item_sku: entry.items.sku,
      item_name: entry.items.name,
      bin_id: entry.bins.id,
      bin_name: entry.bins.name,
      zone_name: entry.bins.zones.name,
      warehouse_name: entry.bins.zones.warehouses.name,
      quantity: entry.quantity,
      status: entry.status
    }))
  },

  // Get all bins with location details
  async getBinsWithLocation(): Promise<BinWithLocation[]> {
    const { data, error } = await supabase
      .from('bins')
      .select(`
        *,
        zones!inner(
          name,
          warehouses!inner(name)
        )
      `)
      .order('name')

    if (error) {
      throw new Error(`Failed to fetch bins: ${error.message}`)
    }

    return (data || []).map(bin => ({
      ...bin,
      zone_name: bin.zones.name,
      warehouse_name: bin.zones.warehouses.name,
      zones: undefined
    }))
  },

  // Validate stock movement before executing
  async validateMovement(request: MovementRequest): Promise<{ valid: boolean, error?: string }> {
    // Check if bins are different
    if (request.from_bin_id === request.to_bin_id) {
      return { valid: false, error: 'Source and destination bins must be different' }
    }

    // Check if bins exist
    const { data: bins, error: binError } = await supabase
      .from('bins')
      .select('id')
      .in('id', [request.from_bin_id, request.to_bin_id])

    if (binError) {
      return { valid: false, error: `Failed to validate bins: ${binError.message}` }
    }

    if (!bins || bins.length !== 2) {
      return { valid: false, error: 'One or both bins do not exist' }
    }

    // Check if item exists
    const { data: item, error: itemError } = await supabase
      .from('items')
      .select('id')
      .eq('id', request.item_id)
      .eq('is_active', true)
      .single()

    if (itemError || !item) {
      return { valid: false, error: 'Item does not exist or is inactive' }
    }

    // Check available stock in source bin
    const { data: stockEntry, error: stockError } = await supabase
      .from('stock_entries')
      .select('quantity, status')
      .eq('item_id', request.item_id)
      .eq('bin_id', request.from_bin_id)
      .eq('status', 'available')
      .single()

    if (stockError || !stockEntry) {
      return { valid: false, error: 'No available stock found in source bin' }
    }

    if (stockEntry.quantity < request.quantity) {
      return { valid: false, error: `Insufficient stock. Available: ${stockEntry.quantity}, Requested: ${request.quantity}` }
    }

    return { valid: true }
  },

  // Execute stock movement
  async moveStock(request: MovementRequest): Promise<StockMovement> {
    // Validate movement first
    const validation = await this.validateMovement(request)
    if (!validation.valid) {
      throw new Error(validation.error)
    }

    const { data, error } = await supabase.rpc('move_stock', {
      p_item_id: request.item_id,
      p_from_bin_id: request.from_bin_id,
      p_to_bin_id: request.to_bin_id,
      p_quantity: request.quantity,
      p_reason: request.reason,
      p_user_id: request.user_id
    })

    if (error) {
      throw new Error(`Failed to move stock: ${error.message}`)
    }

    return data
  },

  // Search movements by item SKU or reason
  async searchMovements(query: string, limit?: number): Promise<StockMovementWithDetails[]> {
    let dbQuery = supabase
      .from('stock_movements')
      .select(`
        *,
        items(id, sku, name),
        from_bins:from_bin_id(id, name),
        to_bins:to_bin_id(id, name),
        users(name)
      `)
      .or(`items.sku.ilike.%${query}%,items.name.ilike.%${query}%,reason.ilike.%${query}%`)
      .order('created_at', { ascending: false })

    if (limit) {
      dbQuery = dbQuery.limit(limit)
    }

    const { data, error } = await dbQuery

    if (error) {
      throw new Error(`Failed to search movements: ${error.message}`)
    }

    return (data || []).map(movement => ({
      ...movement,
      item: movement.items,
      from_bin: movement.from_bins,
      to_bin: movement.to_bins,
      user_name: movement.users?.name,
      items: undefined,
      from_bins: undefined,
      to_bins: undefined,
      users: undefined
    }))
  },

  // Subscribe to real-time movement updates
  subscribeToMovements(callback: (payload: any) => void) {
    return supabase
      .channel('stock_movements_changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'stock_movements' 
        }, 
        callback
      )
      .subscribe()
  }
}
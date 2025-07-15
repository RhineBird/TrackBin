import { supabase } from '../lib/supabase'
import type { Item } from '../types/database'

export interface ItemWithStock extends Item {
  total_quantity?: number
  available_quantity?: number
}

export const itemsService = {
  // Get all active items
  async getAllItems(): Promise<ItemWithStock[]> {
    const { data, error } = await supabase
      .from('items')
      .select('*')
      .eq('is_active', true)
      .order('name')

    if (error) {
      throw new Error(`Failed to fetch items: ${error.message}`)
    }

    return data || []
  },

  // Get all items with their current stock levels (including zero stock items)
  async getItemsWithStock(): Promise<ItemWithStock[]> {
    const { data, error } = await supabase
      .from('items')
      .select(`
        *,
        stock_entries(
          quantity,
          status
        )
      `)
      .eq('is_active', true)
      .order('name')

    if (error) {
      throw new Error(`Failed to fetch items with stock: ${error.message}`)
    }

    // Calculate totals for each item
    const itemsWithStock = (data || []).map(item => {
      const stockEntries = Array.isArray(item.stock_entries) ? item.stock_entries : []
      
      const total_quantity = stockEntries.reduce((sum: number, entry: any) => sum + entry.quantity, 0)
      const available_quantity = stockEntries
        .filter((entry: any) => entry.status === 'available')
        .reduce((sum: number, entry: any) => sum + entry.quantity, 0)

      return {
        ...item,
        stock_entries: undefined, // Remove the nested data
        total_quantity,
        available_quantity
      }
    })

    return itemsWithStock
  },

  // Get only items that have stock entries
  async getItemsWithStockOnly(): Promise<ItemWithStock[]> {
    const { data, error } = await supabase
      .from('items')
      .select(`
        *,
        stock_entries!inner(
          quantity,
          status
        )
      `)
      .eq('is_active', true)
      .order('name')

    if (error) {
      throw new Error(`Failed to fetch items with stock: ${error.message}`)
    }

    // Calculate totals for each item
    const itemsWithStock = (data || []).map(item => {
      const stockEntries = Array.isArray(item.stock_entries) ? item.stock_entries : []
      
      const total_quantity = stockEntries.reduce((sum: number, entry: any) => sum + entry.quantity, 0)
      const available_quantity = stockEntries
        .filter((entry: any) => entry.status === 'available')
        .reduce((sum: number, entry: any) => sum + entry.quantity, 0)

      return {
        ...item,
        stock_entries: undefined, // Remove the nested data
        total_quantity,
        available_quantity
      }
    })

    return itemsWithStock
  },

  // Get single item by ID
  async getItemById(id: string): Promise<Item | null> {
    const { data, error } = await supabase
      .from('items')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return null // Item not found
      }
      throw new Error(`Failed to fetch item: ${error.message}`)
    }

    return data
  },

  // Check if SKU already exists
  async checkSKUExists(sku: string, excludeItemId?: string): Promise<boolean> {
    let query = supabase
      .from('items')
      .select('id')
      .eq('sku', sku)
      .eq('is_active', true)

    if (excludeItemId) {
      query = query.neq('id', excludeItemId)
    }

    const { data, error } = await query.single()

    if (error) {
      // If error is "not found", SKU doesn't exist
      if (error.code === 'PGRST116') {
        return false
      }
      throw new Error(`Failed to check SKU: ${error.message}`)
    }

    return !!data
  },

  // Create new item
  async createItem(item: Omit<Item, 'id' | 'created_at'>): Promise<Item> {
    // Check if SKU already exists
    const skuExists = await this.checkSKUExists(item.sku)
    if (skuExists) {
      throw new Error(`Item with SKU "${item.sku}" already exists`)
    }

    const { data, error } = await supabase
      .from('items')
      .insert([item])
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to create item: ${error.message}`)
    }

    return data
  },

  // Update item
  async updateItem(id: string, updates: Partial<Omit<Item, 'id' | 'created_at'>>): Promise<Item> {
    // Check if SKU is being updated and if it already exists
    if (updates.sku) {
      const skuExists = await this.checkSKUExists(updates.sku, id)
      if (skuExists) {
        throw new Error(`Item with SKU "${updates.sku}" already exists`)
      }
    }

    const { data, error } = await supabase
      .from('items')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to update item: ${error.message}`)
    }

    return data
  },

  // Delete item (set inactive)
  async deleteItem(id: string): Promise<void> {
    const { error } = await supabase
      .from('items')
      .update({ is_active: false })
      .eq('id', id)

    if (error) {
      throw new Error(`Failed to delete item: ${error.message}`)
    }
  },

  // Search items by SKU or name with stock information
  async searchItems(query: string, stockOnly: boolean = false): Promise<ItemWithStock[]> {
    const stockJoin = stockOnly ? 'stock_entries!inner(' : 'stock_entries('
    
    const { data, error } = await supabase
      .from('items')
      .select(`
        *,
        ${stockJoin}
          quantity,
          status
        )
      `)
      .eq('is_active', true)
      .or(`sku.ilike.%${query}%,name.ilike.%${query}%`)
      .order('name')

    if (error) {
      throw new Error(`Failed to search items: ${error.message}`)
    }

    // Calculate totals for each item (same logic as getItemsWithStock)
    const itemsWithStock = (data || []).map(item => {
      const stockEntries = Array.isArray(item.stock_entries) ? item.stock_entries : []
      
      const total_quantity = stockEntries.reduce((sum: number, entry: any) => sum + entry.quantity, 0)
      const available_quantity = stockEntries
        .filter((entry: any) => entry.status === 'available')
        .reduce((sum: number, entry: any) => sum + entry.quantity, 0)

      return {
        ...item,
        stock_entries: undefined, // Remove the nested data
        total_quantity,
        available_quantity
      }
    })

    return itemsWithStock
  },

  // Subscribe to real-time updates
  subscribeToItems(callback: (payload: any) => void) {
    return supabase
      .channel('items_changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'items' 
        }, 
        callback
      )
      .subscribe()
  }
}
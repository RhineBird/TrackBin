import { supabase } from '../lib/supabase'
import type { Item, Bin } from '../types/database'

export interface Shipment {
  id: string
  reference_code: string
  customer: string
  shipped_by_user_id: string
  created_at: string
}

export interface ShipmentLine {
  id: string
  shipment_id: string
  item_id: string
  quantity: number
  bin_id: string
  created_at: string
}

export interface ShipmentWithDetails extends Shipment {
  shipment_lines?: ShipmentLineWithDetails[]
  user_name?: string
  total_items?: number
  total_quantity?: number
}

export interface ShipmentLineWithDetails extends ShipmentLine {
  item?: Item
  bin?: BinWithLocation
}

export interface BinWithLocation extends Bin {
  zone_name?: string
  warehouse_name?: string
}

export interface AvailableStock {
  item_id: string
  item_sku: string
  item_name: string
  item_unit: string
  bin_id: string
  bin_name: string
  zone_name: string
  warehouse_name: string
  available_quantity: number
}

export interface CreateShipmentRequest {
  reference_code: string
  customer: string
  shipment_lines: CreateShipmentLineRequest[]
}

export interface CreateShipmentLineRequest {
  item_id: string
  quantity: number
  bin_id: string
}

export const shipmentsService = {
  // Get all shipments with summary info
  async getShipments(limit?: number): Promise<ShipmentWithDetails[]> {
    let query = supabase
      .from('shipments')
      .select(`
        *,
        users!inner(name),
        shipment_lines(
          id,
          quantity
        )
      `)
      .order('created_at', { ascending: false })

    if (limit) {
      query = query.limit(limit)
    }

    const { data, error } = await query

    if (error) {
      throw new Error(`Failed to fetch shipments: ${error.message}`)
    }

    return (data || []).map(shipment => ({
      ...shipment,
      user_name: shipment.users?.name,
      total_items: shipment.shipment_lines?.length || 0,
      total_quantity: shipment.shipment_lines?.reduce((sum, line) => sum + line.quantity, 0) || 0,
      users: undefined
    }))
  },

  // Get single shipment with full details
  async getShipmentById(shipmentId: string): Promise<ShipmentWithDetails | null> {
    const { data, error } = await supabase
      .from('shipments')
      .select(`
        *,
        users!inner(name),
        shipment_lines(
          *,
          items!inner(id, sku, name, unit),
          bins!inner(
            id,
            name,
            zones!inner(
              name,
              warehouses!inner(name)
            )
          )
        )
      `)
      .eq('id', shipmentId)
      .single()

    if (error) {
      throw new Error(`Failed to fetch shipment: ${error.message}`)
    }

    if (!data) return null

    const shipment: ShipmentWithDetails = {
      ...data,
      user_name: data.users?.name,
      shipment_lines: data.shipment_lines?.map(line => ({
        ...line,
        item: line.items,
        bin: {
          ...line.bins,
          zone_name: line.bins.zones.name,
          warehouse_name: line.bins.zones.warehouses.name,
          zones: undefined
        },
        items: undefined,
        bins: undefined
      })),
      users: undefined
    }

    shipment.total_items = shipment.shipment_lines?.length || 0
    shipment.total_quantity = shipment.shipment_lines?.reduce((sum, line) => sum + line.quantity, 0) || 0

    return shipment
  },

  // Get available stock for shipping (items with positive quantities)
  async getAvailableStock(): Promise<AvailableStock[]> {
    const { data, error } = await supabase
      .from('stock_entries')
      .select(`
        *,
        items!inner(id, sku, name, unit),
        bins!inner(
          id,
          name,
          zones!inner(
            name,
            warehouses!inner(name)
          )
        )
      `)
      .eq('status', 'available')
      .gt('quantity', 0)
      .order('items(sku)')

    if (error) {
      throw new Error(`Failed to fetch available stock: ${error.message}`)
    }

    return (data || []).map(entry => ({
      item_id: entry.items.id,
      item_sku: entry.items.sku,
      item_name: entry.items.name,
      item_unit: entry.items.unit,
      bin_id: entry.bins.id,
      bin_name: entry.bins.name,
      zone_name: entry.bins.zones.name,
      warehouse_name: entry.bins.zones.warehouses.name,
      available_quantity: entry.quantity
    }))
  },

  // Get bins with location details
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

  // Validate shipment before creating (check stock availability)
  async validateShipment(request: CreateShipmentRequest): Promise<{ valid: boolean, errors: string[] }> {
    const errors: string[] = []

    // Check stock availability for each line
    for (const line of request.shipment_lines) {
      const { data: stockEntry, error: stockError } = await supabase
        .from('stock_entries')
        .select('quantity')
        .eq('item_id', line.item_id)
        .eq('bin_id', line.bin_id)
        .eq('status', 'available')
        .single()

      if (stockError || !stockEntry) {
        const { data: item } = await supabase
          .from('items')
          .select('sku')
          .eq('id', line.item_id)
          .single()
        
        const { data: bin } = await supabase
          .from('bins')
          .select('name')
          .eq('id', line.bin_id)
          .single()

        errors.push(`No available stock for ${item?.sku || 'item'} in bin ${bin?.name || 'unknown'}`)
        continue
      }

      if (stockEntry.quantity < line.quantity) {
        const { data: item } = await supabase
          .from('items')
          .select('sku')
          .eq('id', line.item_id)
          .single()

        errors.push(`Insufficient stock for ${item?.sku || 'item'}: available ${stockEntry.quantity}, requested ${line.quantity}`)
      }
    }

    return { valid: errors.length === 0, errors }
  },

  // Create a new shipment with automatic stock reduction
  async createShipment(request: CreateShipmentRequest): Promise<Shipment> {
    // Validate first
    const validation = await this.validateShipment(request)
    if (!validation.valid) {
      throw new Error(`Shipment validation failed: ${validation.errors.join(', ')}`)
    }

    const shipmentId = crypto.randomUUID()
    
    // Create the shipment
    const { data: shipment, error: shipmentError } = await supabase
      .from('shipments')
      .insert({
        id: shipmentId,
        reference_code: request.reference_code,
        customer: request.customer,
        shipped_by_user_id: 'a0000000-0000-4000-8000-000000000001' // Default admin user
      })
      .select()
      .single()

    if (shipmentError) {
      throw new Error(`Failed to create shipment: ${shipmentError.message}`)
    }

    // Create shipment lines
    const shipmentLines = request.shipment_lines.map(line => ({
      shipment_id: shipmentId,
      item_id: line.item_id,
      quantity: line.quantity,
      bin_id: line.bin_id
    }))

    const { error: linesError } = await supabase
      .from('shipment_lines')
      .insert(shipmentLines)

    if (linesError) {
      // Clean up the shipment if lines failed
      await supabase.from('shipments').delete().eq('id', shipmentId)
      throw new Error(`Failed to create shipment lines: ${linesError.message}`)
    }

    // Reduce stock levels
    for (const line of request.shipment_lines) {
      await this.reduceStockLevel(line.item_id, line.bin_id, line.quantity)
    }

    return shipment
  },

  // Helper function to reduce stock levels
  async reduceStockLevel(itemId: string, binId: string, quantityToReduce: number): Promise<void> {
    // Get current stock entry
    const { data: existingStock, error: stockError } = await supabase
      .from('stock_entries')
      .select('id, quantity')
      .eq('item_id', itemId)
      .eq('bin_id', binId)
      .eq('status', 'available')
      .single()

    if (stockError || !existingStock) {
      throw new Error(`No available stock found for item in specified bin`)
    }

    if (existingStock.quantity < quantityToReduce) {
      throw new Error(`Insufficient stock: available ${existingStock.quantity}, requested ${quantityToReduce}`)
    }

    const newQuantity = existingStock.quantity - quantityToReduce

    if (newQuantity === 0) {
      // Remove the stock entry if quantity becomes zero
      const { error: deleteError } = await supabase
        .from('stock_entries')
        .delete()
        .eq('id', existingStock.id)

      if (deleteError) {
        throw new Error(`Failed to remove empty stock entry: ${deleteError.message}`)
      }
    } else {
      // Update the stock entry with new quantity
      const { error: updateError } = await supabase
        .from('stock_entries')
        .update({ 
          quantity: newQuantity,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingStock.id)

      if (updateError) {
        throw new Error(`Failed to update stock: ${updateError.message}`)
      }
    }
  },

  // Search shipments by reference code or customer
  async searchShipments(query: string, limit?: number): Promise<ShipmentWithDetails[]> {
    let dbQuery = supabase
      .from('shipments')
      .select(`
        *,
        users!inner(name),
        shipment_lines(
          id,
          quantity
        )
      `)
      .or(`reference_code.ilike.%${query}%,customer.ilike.%${query}%`)
      .order('created_at', { ascending: false })

    if (limit) {
      dbQuery = dbQuery.limit(limit)
    }

    const { data, error } = await dbQuery

    if (error) {
      throw new Error(`Failed to search shipments: ${error.message}`)
    }

    return (data || []).map(shipment => ({
      ...shipment,
      user_name: shipment.users?.name,
      total_items: shipment.shipment_lines?.length || 0,
      total_quantity: shipment.shipment_lines?.reduce((sum, line) => sum + line.quantity, 0) || 0,
      users: undefined
    }))
  },

  // Subscribe to real-time shipment updates
  subscribeToShipments(callback: (payload: any) => void) {
    return supabase
      .channel('shipments_changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'shipments' 
        }, 
        callback
      )
      .subscribe()
  }
}
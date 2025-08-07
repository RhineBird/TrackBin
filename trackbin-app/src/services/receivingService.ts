import { supabase } from '../lib/supabase'
import type { Item, Bin } from '../types/database'
import { auditService } from './auditService'

export interface Receipt {
  id: string
  reference_code: string
  supplier: string
  received_by_user_id: string
  created_at: string
}

export interface ReceiptLine {
  id: string
  receipt_id: string
  item_id: string
  quantity_expected: number
  quantity_received: number
  bin_id: string
  created_at: string
}

export interface ReceiptWithDetails extends Receipt {
  receipt_lines?: ReceiptLineWithDetails[]
  user_name?: string
  total_items?: number
  total_expected?: number
  total_received?: number
}

export interface ReceiptLineWithDetails extends ReceiptLine {
  item?: Item
  bin?: BinWithLocation
  variance?: number
  variance_percentage?: number
}

export interface BinWithLocation extends Bin {
  zone_name?: string
  warehouse_name?: string
}

export interface CreateReceiptRequest {
  reference_code: string
  supplier: string
  receipt_lines: CreateReceiptLineRequest[]
  user_id: string
}

export interface CreateReceiptLineRequest {
  item_id: string
  quantity_expected: number
  quantity_received: number
  bin_id: string
}

export const receivingService = {
  // Get all receipts with summary info
  async getReceipts(limit?: number): Promise<ReceiptWithDetails[]> {
    let query = supabase
      .from('receipts')
      .select(`
        *,
        receipt_lines(
          id,
          quantity_expected,
          quantity_received
        )
      `)
      .order('created_at', { ascending: false })

    if (limit) {
      query = query.limit(limit)
    }

    const { data, error } = await query

    if (error) {
      throw new Error(`Failed to fetch receipts: ${error.message}`)
    }

    return (data || []).map(receipt => ({
      ...receipt,
      total_items: receipt.receipt_lines?.length || 0,
      total_expected: receipt.receipt_lines?.reduce((sum, line) => sum + line.quantity_expected, 0) || 0,
      total_received: receipt.receipt_lines?.reduce((sum, line) => sum + line.quantity_received, 0) || 0,
    }))
  },

  // Get single receipt with full details
  async getReceiptById(receiptId: string): Promise<ReceiptWithDetails | null> {
    const { data, error } = await supabase
      .from('receipts')
      .select(`
        *,
        receipt_lines(
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
      .eq('id', receiptId)
      .single()

    if (error) {
      throw new Error(`Failed to fetch receipt: ${error.message}`)
    }

    if (!data) return null

    const receipt: ReceiptWithDetails = {
      ...data,
      user_name: data.users?.name,
      receipt_lines: data.receipt_lines?.map(line => ({
        ...line,
        item: line.items,
        bin: {
          ...line.bins,
          zone_name: line.bins.zones.name,
          warehouse_name: line.bins.zones.warehouses.name,
          zones: undefined
        },
        variance: line.quantity_received - line.quantity_expected,
        variance_percentage: line.quantity_expected > 0 
          ? ((line.quantity_received - line.quantity_expected) / line.quantity_expected) * 100 
          : 0,
        items: undefined,
        bins: undefined
      })),
    }

    receipt.total_items = receipt.receipt_lines?.length || 0
    receipt.total_expected = receipt.receipt_lines?.reduce((sum, line) => sum + line.quantity_expected, 0) || 0
    receipt.total_received = receipt.receipt_lines?.reduce((sum, line) => sum + line.quantity_received, 0) || 0

    return receipt
  },

  // Get bins with location details for the receiving form
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

  // Check if a reference code already exists
  async checkReferenceCodeExists(referenceCode: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('receipts')
      .select('id')
      .eq('reference_code', referenceCode)
      .single()

    if (error) {
      // If error is "not found", reference code doesn't exist
      if (error.code === 'PGRST116') {
        return false
      }
      throw new Error(`Failed to check reference code: ${error.message}`)
    }

    return !!data
  },

  // Create a new receipt with automatic stock updates
  async createReceipt(request: CreateReceiptRequest): Promise<Receipt> {
    // Check if reference code already exists
    const referenceExists = await this.checkReferenceCodeExists(request.reference_code)
    if (referenceExists) {
      throw new Error(`Receipt with reference code "${request.reference_code}" already exists`)
    }

    // For now, create receipt and lines manually until we set up the database functions
    const receiptId = crypto.randomUUID()
    
    // Create the receipt
    const { data: receipt, error: receiptError } = await supabase
      .from('receipts')
      .insert({
        id: receiptId,
        reference_code: request.reference_code,
        supplier: request.supplier,
        received_by_user_id: request.user_id
      })
      .select()
      .single()

    if (receiptError) {
      throw new Error(`Failed to create receipt: ${receiptError.message}`)
    }

    // Create receipt lines
    const receiptLines = request.receipt_lines.map(line => ({
      receipt_id: receiptId,
      item_id: line.item_id,
      quantity_expected: line.quantity_expected,
      quantity_received: line.quantity_received,
      bin_id: line.bin_id
    }))

    const { error: linesError } = await supabase
      .from('receipt_lines')
      .insert(receiptLines)

    if (linesError) {
      // Clean up the receipt if lines failed
      await supabase.from('receipts').delete().eq('id', receiptId)
      throw new Error(`Failed to create receipt lines: ${linesError.message}`)
    }

    // Update stock levels for received quantities
    for (const line of request.receipt_lines) {
      if (line.quantity_received > 0) {
        await this.updateStockLevel(line.item_id, line.bin_id, line.quantity_received)
      }
    }

    // Log audit entry
    await auditService.createAuditLog(
      'system',
      'create',
      'receipts',
      receiptId,
      { 
        reference_code: request.reference_code, 
        supplier: request.supplier,
        total_items: request.receipt_lines.length
      }
    )

    return receipt
  },

  // Helper function to update stock levels
  async updateStockLevel(itemId: string, binId: string, quantityToAdd: number): Promise<void> {
    // Check if stock entry exists
    const { data: existingStock, error: stockError } = await supabase
      .from('stock_entries')
      .select('id, quantity')
      .eq('item_id', itemId)
      .eq('bin_id', binId)
      .eq('status', 'available')
      .single()

    if (stockError && stockError.code !== 'PGRST116') { // PGRST116 is "not found"
      throw new Error(`Failed to check existing stock: ${stockError.message}`)
    }

    if (existingStock) {
      // Update existing stock entry
      const { error: updateError } = await supabase
        .from('stock_entries')
        .update({ 
          quantity: existingStock.quantity + quantityToAdd,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingStock.id)

      if (updateError) {
        throw new Error(`Failed to update stock: ${updateError.message}`)
      }
      
      // Log stock movement audit entry
      await auditService.createAuditLog(
        'system',
        'update',
        'stock_entries',
        existingStock.id,
        { 
          previous_quantity: existingStock.quantity,
          new_quantity: existingStock.quantity + quantityToAdd,
          quantity_added: quantityToAdd,
          operation: 'receipt'
        }
      )
    } else {
      // Create new stock entry
      const { error: insertError } = await supabase
        .from('stock_entries')
        .insert({
          item_id: itemId,
          bin_id: binId,
          quantity: quantityToAdd,
          status: 'available'
        })

      if (insertError) {
        throw new Error(`Failed to create stock entry: ${insertError.message}`)
      }
      
      // Log new stock entry audit
      await auditService.createAuditLog(
        'system',
        'create',
        'stock_entries',
        'new-stock-entry',
        { 
          initial_quantity: quantityToAdd,
          operation: 'receipt'
        }
      )
    }
  },

  // Update quantities received for an existing receipt
  async updateReceiptQuantities(receiptId: string, updates: { line_id: string, quantity_received: number }[]): Promise<void> {
    // For now, update each line manually
    for (const update of updates) {
      // Get current line details
      const { data: currentLine, error: lineError } = await supabase
        .from('receipt_lines')
        .select('quantity_received, item_id, bin_id')
        .eq('id', update.line_id)
        .single()

      if (lineError) {
        throw new Error(`Failed to get receipt line: ${lineError.message}`)
      }

      const quantityDiff = update.quantity_received - currentLine.quantity_received

      // Update the receipt line
      const { error: updateError } = await supabase
        .from('receipt_lines')
        .update({ quantity_received: update.quantity_received })
        .eq('id', update.line_id)

      if (updateError) {
        throw new Error(`Failed to update receipt line: ${updateError.message}`)
      }

      // Adjust stock if there's a difference
      if (quantityDiff !== 0) {
        await this.updateStockLevel(currentLine.item_id, currentLine.bin_id, quantityDiff)
      }
    }
  },

  // Search receipts by reference code or supplier
  async searchReceipts(query: string, limit?: number): Promise<ReceiptWithDetails[]> {
    let dbQuery = supabase
      .from('receipts')
      .select(`
        *,
        receipt_lines(
          id,
          quantity_expected,
          quantity_received
        )
      `)
      .or(`reference_code.ilike.%${query}%,supplier.ilike.%${query}%`)
      .order('created_at', { ascending: false })

    if (limit) {
      dbQuery = dbQuery.limit(limit)
    }

    const { data, error } = await dbQuery

    if (error) {
      throw new Error(`Failed to search receipts: ${error.message}`)
    }

    return (data || []).map(receipt => ({
      ...receipt,
      total_items: receipt.receipt_lines?.length || 0,
      total_expected: receipt.receipt_lines?.reduce((sum, line) => sum + line.quantity_expected, 0) || 0,
      total_received: receipt.receipt_lines?.reduce((sum, line) => sum + line.quantity_received, 0) || 0,
    }))
  },

  // Subscribe to real-time receipt updates
  subscribeToReceipts(callback: (payload: any) => void) {
    return supabase
      .channel('receipts_changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'receipts' 
        }, 
        callback
      )
      .subscribe()
  }
}
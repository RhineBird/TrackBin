export interface User {
  id: string
  name: string
  email: string
  password_hash: string
  role_id: string
  created_at: string
}

export interface Role {
  id: string
  name: 'Admin' | 'Operator' | 'Viewer'
}

export interface Warehouse {
  id: string
  name: string
  location: string
}

export interface Zone {
  id: string
  warehouse_id: string
  name: string
}

export interface Bin {
  id: string
  zone_id: string
  name: string
  bin_type: 'floor' | 'shelf' | 'rack'
}

export interface Item {
  id: string
  sku: string
  name: string
  unit: string
  description?: string
  is_active: boolean
}

export interface StockEntry {
  id: string
  item_id: string
  bin_id: string
  quantity: number
  status: 'available' | 'reserved' | 'quarantined' | 'damaged'
  created_at: string
}

export interface StockMovement {
  id: string
  item_id: string
  from_bin_id: string
  to_bin_id: string
  quantity: number
  moved_by_user_id: string
  reason: string
  created_at: string
}

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
}

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
}

export interface AuditLog {
  id: string
  user_id: string
  action_type: string
  entity: string
  entity_id: string
  timestamp: string
  details_json: any
}
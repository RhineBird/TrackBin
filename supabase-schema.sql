-- TrackBin Database Schema
-- Based on project.yaml specifications

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enum types
CREATE TYPE user_role AS ENUM ('Admin', 'Operator', 'Viewer');
CREATE TYPE bin_type AS ENUM ('floor', 'shelf', 'rack');
CREATE TYPE stock_status AS ENUM ('available', 'reserved', 'quarantined', 'damaged');

-- Roles table
CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name user_role NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role_id UUID NOT NULL REFERENCES roles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Warehouses table
CREATE TABLE warehouses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    location VARCHAR(500) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Zones table
CREATE TABLE zones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Bins table
CREATE TABLE bins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    zone_id UUID NOT NULL REFERENCES zones(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    bin_type bin_type NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Items table
CREATE TABLE items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sku VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    unit VARCHAR(50) NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Stock entries table
CREATE TABLE stock_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    item_id UUID NOT NULL REFERENCES items(id),
    bin_id UUID NOT NULL REFERENCES bins(id),
    quantity INTEGER NOT NULL CHECK (quantity >= 0),
    status stock_status NOT NULL DEFAULT 'available',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Stock movements table
CREATE TABLE stock_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    item_id UUID NOT NULL REFERENCES items(id),
    from_bin_id UUID REFERENCES bins(id),
    to_bin_id UUID REFERENCES bins(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    moved_by_user_id UUID NOT NULL REFERENCES users(id),
    reason VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Receipts table
CREATE TABLE receipts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reference_code VARCHAR(100) NOT NULL,
    supplier VARCHAR(255) NOT NULL,
    received_by_user_id UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Receipt lines table
CREATE TABLE receipt_lines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    receipt_id UUID NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES items(id),
    quantity_expected INTEGER NOT NULL CHECK (quantity_expected > 0),
    quantity_received INTEGER NOT NULL CHECK (quantity_received >= 0),
    bin_id UUID NOT NULL REFERENCES bins(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Shipments table
CREATE TABLE shipments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reference_code VARCHAR(100) NOT NULL,
    customer VARCHAR(255) NOT NULL,
    shipped_by_user_id UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Shipment lines table
CREATE TABLE shipment_lines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES items(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    bin_id UUID NOT NULL REFERENCES bins(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Audit logs table
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    action_type VARCHAR(100) NOT NULL,
    entity VARCHAR(100) NOT NULL,
    entity_id UUID NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    details_json JSONB
);

-- Create indexes for better performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role_id ON users(role_id);
CREATE INDEX idx_zones_warehouse_id ON zones(warehouse_id);
CREATE INDEX idx_bins_zone_id ON bins(zone_id);
CREATE INDEX idx_items_sku ON items(sku);
CREATE INDEX idx_items_is_active ON items(is_active);
CREATE INDEX idx_stock_entries_item_id ON stock_entries(item_id);
CREATE INDEX idx_stock_entries_bin_id ON stock_entries(bin_id);
CREATE INDEX idx_stock_entries_status ON stock_entries(status);
CREATE INDEX idx_stock_movements_item_id ON stock_movements(item_id);
CREATE INDEX idx_stock_movements_created_at ON stock_movements(created_at);
CREATE INDEX idx_receipt_lines_receipt_id ON receipt_lines(receipt_id);
CREATE INDEX idx_shipment_lines_shipment_id ON shipment_lines(shipment_id);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity, entity_id);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp);

-- Insert default roles
INSERT INTO roles (name) VALUES 
    ('Admin'),
    ('Operator'),
    ('Viewer');

-- Create function to update stock entries timestamp
CREATE OR REPLACE FUNCTION update_stock_entries_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for stock entries
CREATE TRIGGER trigger_update_stock_entries_timestamp
    BEFORE UPDATE ON stock_entries
    FOR EACH ROW
    EXECUTE FUNCTION update_stock_entries_timestamp();

-- Create function to prevent negative stock
CREATE OR REPLACE FUNCTION check_stock_constraints()
RETURNS TRIGGER AS $$
BEGIN
    -- Ensure no negative stock levels
    IF NEW.quantity < 0 THEN
        RAISE EXCEPTION 'Stock quantity cannot be negative for item % in bin %', NEW.item_id, NEW.bin_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for stock constraint checking
CREATE TRIGGER trigger_check_stock_constraints
    BEFORE INSERT OR UPDATE ON stock_entries
    FOR EACH ROW
    EXECUTE FUNCTION check_stock_constraints();

-- Create function for audit logging
CREATE OR REPLACE FUNCTION create_audit_log()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO audit_logs (user_id, action_type, entity, entity_id, details_json)
    VALUES (
        COALESCE(current_setting('app.current_user_id', true)::UUID, '00000000-0000-0000-0000-000000000000'),
        TG_OP,
        TG_TABLE_NAME,
        COALESCE(NEW.id, OLD.id),
        CASE 
            WHEN TG_OP = 'DELETE' THEN row_to_json(OLD)
            ELSE row_to_json(NEW)
        END
    );
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create audit triggers for important tables
CREATE TRIGGER audit_stock_entries
    AFTER INSERT OR UPDATE OR DELETE ON stock_entries
    FOR EACH ROW EXECUTE FUNCTION create_audit_log();

CREATE TRIGGER audit_stock_movements
    AFTER INSERT OR UPDATE OR DELETE ON stock_movements
    FOR EACH ROW EXECUTE FUNCTION create_audit_log();

CREATE TRIGGER audit_receipts
    AFTER INSERT OR UPDATE OR DELETE ON receipts
    FOR EACH ROW EXECUTE FUNCTION create_audit_log();

CREATE TRIGGER audit_shipments
    AFTER INSERT OR UPDATE OR DELETE ON shipments
    FOR EACH ROW EXECUTE FUNCTION create_audit_log();

-- Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE bins ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipt_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipment_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (basic examples - adjust based on your needs)
-- Admin can see everything
CREATE POLICY admin_all_access ON users
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM roles r 
            WHERE r.id = (SELECT role_id FROM users WHERE id = auth.uid())
            AND r.name = 'Admin'
        )
    );

-- Operators can see operational data
CREATE POLICY operator_access ON stock_entries
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM roles r 
            WHERE r.id = (SELECT role_id FROM users WHERE id = auth.uid())
            AND r.name IN ('Admin', 'Operator')
        )
    );

-- Viewers can only read
CREATE POLICY viewer_read_access ON stock_entries
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM roles r 
            WHERE r.id = (SELECT role_id FROM users WHERE id = auth.uid())
            AND r.name IN ('Admin', 'Operator', 'Viewer')
        )
    );
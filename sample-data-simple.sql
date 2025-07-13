-- Simple sample data for testing TrackBin application
-- This version temporarily disables audit triggers to avoid foreign key issues

-- Disable triggers temporarily
SET session_replication_role = replica;

-- Insert default admin user first
INSERT INTO users (id, name, email, password_hash, role_id) VALUES 
    ('a0000000-0000-4000-8000-000000000001', 'Admin User', 'admin@trackbin.local', '$2a$10$example_hash_change_this', (SELECT id FROM roles WHERE name = 'Admin'));

-- Insert sample warehouse
INSERT INTO warehouses (id, name, location) VALUES 
    ('10000000-0000-4000-8000-000000000001', 'Main Warehouse', 'Building A, Industrial District');

-- Insert sample zones
INSERT INTO zones (id, warehouse_id, name) VALUES 
    ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Receiving Area'),
    ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'Storage Zone A'),
    ('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', 'Shipping Area');

-- Insert sample bins
INSERT INTO bins (id, zone_id, name, bin_type) VALUES 
    ('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'RCV-001', 'floor'),
    ('30000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', 'A1-SHELF-01', 'shelf'),
    ('30000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000002', 'A1-SHELF-02', 'shelf'),
    ('30000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000002', 'A1-RACK-01', 'rack'),
    ('30000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000003', 'SHIP-001', 'floor');

-- Insert sample items
INSERT INTO items (id, sku, name, unit, description, is_active) VALUES 
    ('40000000-0000-4000-8000-000000000001', 'BOLT-M8-50', 'M8x50mm Hex Bolt', 'pieces', 'Stainless steel hex bolt, 8mm diameter, 50mm length', true),
    ('40000000-0000-4000-8000-000000000002', 'WASHER-M8', 'M8 Flat Washer', 'pieces', 'Stainless steel flat washer for M8 bolts', true),
    ('40000000-0000-4000-8000-000000000003', 'PAINT-BLUE-5L', 'Blue Paint 5L', 'liters', 'Industrial blue paint, 5 liter container', true),
    ('40000000-0000-4000-8000-000000000004', 'CABLE-CAT6-100M', 'CAT6 Ethernet Cable', 'meters', 'Category 6 ethernet cable, sold per meter', true),
    ('40000000-0000-4000-8000-000000000005', 'SCREW-PH-M4-20', 'M4x20mm Phillips Screw', 'pieces', 'Phillips head screw, 4mm diameter, 20mm length', true);

-- Insert sample stock entries
INSERT INTO stock_entries (id, item_id, bin_id, quantity, status) VALUES 
    ('50000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000002', 150, 'available'),
    ('50000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000002', 500, 'available'),
    ('50000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000003', 25, 'available'),
    ('50000000-0000-4000-8000-000000000004', '40000000-0000-4000-8000-000000000004', '30000000-0000-4000-8000-000000000004', 1000, 'available'),
    ('50000000-0000-4000-8000-000000000005', '40000000-0000-4000-8000-000000000005', '30000000-0000-4000-8000-000000000002', 200, 'available'),
    ('50000000-0000-4000-8000-000000000006', '40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000003', 75, 'reserved'),
    ('50000000-0000-4000-8000-000000000007', '40000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000004', 3, 'available');

-- Re-enable triggers
SET session_replication_role = DEFAULT;
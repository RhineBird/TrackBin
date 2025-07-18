-- Default Roles and Permissions Seed Data
-- This script populates the system with default roles and permissions

BEGIN;

-- Clear existing data (for fresh install) - commented out to avoid foreign key issues
-- We'll use ON CONFLICT clauses instead for safer updates
-- DELETE FROM role_permissions;
-- DELETE FROM user_permissions;
-- DELETE FROM role_assignments;
-- DELETE FROM permissions;
-- DELETE FROM roles WHERE is_system_role = true;

-- Insert default permissions (with conflict handling)
INSERT INTO permissions (id, module, action, description) VALUES
-- Dashboard permissions
('10000000-0000-4000-8000-000000000001', 'dashboard', 'view', 'View dashboard and summary statistics'),

-- Items/Inventory permissions
('10000000-0000-4000-8000-000000000002', 'items', 'view', 'View inventory items and stock levels'),
('10000000-0000-4000-8000-000000000003', 'items', 'create', 'Create new inventory items'),
('10000000-0000-4000-8000-000000000004', 'items', 'edit', 'Edit existing inventory items'),
('10000000-0000-4000-8000-000000000005', 'items', 'delete', 'Delete inventory items'),
('10000000-0000-4000-8000-000000000006', 'items', 'import', 'Import items from external sources'),
('10000000-0000-4000-8000-000000000007', 'items', 'export', 'Export items data'),

-- Stock permissions
('10000000-0000-4000-8000-000000000008', 'stock', 'view', 'View stock levels and locations'),
('10000000-0000-4000-8000-000000000009', 'stock', 'move', 'Move stock between locations'),
('10000000-0000-4000-8000-000000000010', 'stock', 'adjust', 'Adjust stock quantities'),
('10000000-0000-4000-8000-000000000011', 'stock', 'change_status', 'Change stock status (available, reserved, etc.)'),

-- Receiving permissions
('10000000-0000-4000-8000-000000000012', 'receiving', 'view', 'View receiving records and receipts'),
('10000000-0000-4000-8000-000000000013', 'receiving', 'create', 'Create new receipts'),
('10000000-0000-4000-8000-000000000014', 'receiving', 'edit', 'Edit existing receipts'),
('10000000-0000-4000-8000-000000000015', 'receiving', 'delete', 'Delete receipts'),
('10000000-0000-4000-8000-000000000016', 'receiving', 'process', 'Process and finalize receipts'),

-- Shipping permissions
('10000000-0000-4000-8000-000000000017', 'shipping', 'view', 'View shipping records and shipments'),
('10000000-0000-4000-8000-000000000018', 'shipping', 'create', 'Create new shipments'),
('10000000-0000-4000-8000-000000000019', 'shipping', 'edit', 'Edit existing shipments'),
('10000000-0000-4000-8000-000000000020', 'shipping', 'delete', 'Delete shipments'),
('10000000-0000-4000-8000-000000000021', 'shipping', 'process', 'Process and finalize shipments'),

-- Audit permissions
('10000000-0000-4000-8000-000000000022', 'audit', 'view', 'View audit logs and system activities'),
('10000000-0000-4000-8000-000000000023', 'audit', 'export', 'Export audit data'),

-- User management permissions
('10000000-0000-4000-8000-000000000024', 'users', 'view', 'View user accounts and profiles'),
('10000000-0000-4000-8000-000000000025', 'users', 'create', 'Create new user accounts'),
('10000000-0000-4000-8000-000000000026', 'users', 'edit', 'Edit existing user accounts'),
('10000000-0000-4000-8000-000000000027', 'users', 'delete', 'Delete or deactivate user accounts'),
('10000000-0000-4000-8000-000000000028', 'users', 'assign_roles', 'Assign roles to users'),

-- Settings permissions
('10000000-0000-4000-8000-000000000029', 'settings', 'view', 'View system settings'),
('10000000-0000-4000-8000-000000000030', 'settings', 'edit_warehouses', 'Edit warehouse configurations'),
('10000000-0000-4000-8000-000000000031', 'settings', 'edit_zones', 'Edit zone configurations'),
('10000000-0000-4000-8000-000000000032', 'settings', 'edit_bins', 'Edit bin configurations'),
('10000000-0000-4000-8000-000000000033', 'settings', 'system_settings', 'Modify system-wide settings')
ON CONFLICT (module, action) DO UPDATE SET
    description = EXCLUDED.description;

-- Insert default system roles (with conflict handling)
INSERT INTO roles (id, name, description, is_system_role, created_at) VALUES
('20000000-0000-4000-8000-000000000001', 'System Administrator', 'Full system access with user management and system configuration', true, NOW()),
('20000000-0000-4000-8000-000000000002', 'Warehouse Manager', 'Full operational access to all warehouse functions', true, NOW()),
('20000000-0000-4000-8000-000000000003', 'Inventory Manager', 'Full access to inventory management and stock operations', true, NOW()),
('20000000-0000-4000-8000-000000000004', 'Receiving Supervisor', 'Full access to receiving operations and related inventory', true, NOW()),
('20000000-0000-4000-8000-000000000005', 'Shipping Supervisor', 'Full access to shipping operations and related inventory', true, NOW()),
('20000000-0000-4000-8000-000000000006', 'Stock Clerk', 'Basic stock operations and movements', true, NOW()),
('20000000-0000-4000-8000-000000000007', 'Receiving Clerk', 'Basic receiving operations', true, NOW()),
('20000000-0000-4000-8000-000000000008', 'Shipping Clerk', 'Basic shipping operations', true, NOW()),
('20000000-0000-4000-8000-000000000009', 'Auditor', 'Read-only access to audit logs and reports', true, NOW()),
('20000000-0000-4000-8000-000000000010', 'Viewer', 'Basic read-only access to dashboard and inventory', true, NOW())
ON CONFLICT (name) DO UPDATE SET
    description = EXCLUDED.description,
    is_system_role = EXCLUDED.is_system_role;

-- Verify roles exist before assigning permissions
DO $$
DECLARE
  role_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO role_count FROM roles WHERE is_system_role = true;
  IF role_count = 0 THEN
    RAISE EXCEPTION 'No system roles found. Cannot assign permissions.';
  END IF;
  RAISE NOTICE 'Found % system roles, proceeding with permission assignments', role_count;
END $$;

-- Assign permissions to System Administrator (all permissions)
INSERT INTO role_permissions (role_id, permission_id)
SELECT '20000000-0000-4000-8000-000000000001', id FROM permissions
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Assign permissions to Warehouse Manager (all operational permissions, no user management)
INSERT INTO role_permissions (role_id, permission_id)
SELECT '20000000-0000-4000-8000-000000000002', id FROM permissions 
WHERE module IN ('dashboard', 'items', 'stock', 'receiving', 'shipping', 'audit', 'settings')
AND action != 'system_settings'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Assign permissions to Inventory Manager
INSERT INTO role_permissions (role_id, permission_id)
SELECT '20000000-0000-4000-8000-000000000003', id FROM permissions 
WHERE module IN ('dashboard', 'items', 'stock', 'receiving', 'shipping')
AND action IN ('view', 'create', 'edit', 'move', 'adjust', 'change_status', 'process')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Assign permissions to Receiving Supervisor
INSERT INTO role_permissions (role_id, permission_id)
SELECT '20000000-0000-4000-8000-000000000004', id FROM permissions 
WHERE (module = 'receiving' AND action IN ('view', 'create', 'edit', 'delete', 'process'))
OR (module = 'items' AND action = 'view')
OR (module = 'stock' AND action IN ('view', 'move', 'change_status'))
OR (module = 'dashboard' AND action = 'view')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Assign permissions to Shipping Supervisor
INSERT INTO role_permissions (role_id, permission_id)
SELECT '20000000-0000-4000-8000-000000000005', id FROM permissions 
WHERE (module = 'shipping' AND action IN ('view', 'create', 'edit', 'delete', 'process'))
OR (module = 'items' AND action = 'view')
OR (module = 'stock' AND action IN ('view', 'move', 'change_status'))
OR (module = 'dashboard' AND action = 'view')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Assign permissions to Stock Clerk
INSERT INTO role_permissions (role_id, permission_id)
SELECT '20000000-0000-4000-8000-000000000006', id FROM permissions 
WHERE (module = 'stock' AND action IN ('view', 'move', 'change_status'))
OR (module = 'items' AND action = 'view')
OR (module = 'dashboard' AND action = 'view')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Assign permissions to Receiving Clerk
INSERT INTO role_permissions (role_id, permission_id)
SELECT '20000000-0000-4000-8000-000000000007', id FROM permissions 
WHERE (module = 'receiving' AND action IN ('view', 'create', 'edit', 'process'))
OR (module = 'items' AND action = 'view')
OR (module = 'dashboard' AND action = 'view')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Assign permissions to Shipping Clerk
INSERT INTO role_permissions (role_id, permission_id)
SELECT '20000000-0000-4000-8000-000000000008', id FROM permissions 
WHERE (module = 'shipping' AND action IN ('view', 'create', 'edit', 'process'))
OR (module = 'items' AND action = 'view')
OR (module = 'dashboard' AND action = 'view')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Assign permissions to Auditor
INSERT INTO role_permissions (role_id, permission_id)
SELECT '20000000-0000-4000-8000-000000000009', id FROM permissions 
WHERE (module = 'audit' AND action IN ('view', 'export'))
OR (module = 'dashboard' AND action = 'view')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Assign permissions to Viewer
INSERT INTO role_permissions (role_id, permission_id)
SELECT '20000000-0000-4000-8000-000000000010', id FROM permissions 
WHERE (module = 'dashboard' AND action = 'view')
OR (module = 'items' AND action = 'view')
OR (module = 'stock' AND action = 'view')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Create summary of roles and their permission counts
SELECT 
  r.name as role_name,
  COUNT(rp.permission_id) as permission_count,
  r.description
FROM roles r
LEFT JOIN role_permissions rp ON r.id = rp.role_id
WHERE r.is_system_role = true
GROUP BY r.id, r.name, r.description
ORDER BY permission_count DESC;

-- Verify that all roles were created successfully
DO $$
DECLARE
  role_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO role_count FROM roles WHERE is_system_role = true;
  IF role_count < 10 THEN
    RAISE EXCEPTION 'Not all system roles were created. Expected 10, got %', role_count;
  END IF;
  RAISE NOTICE 'All % system roles created successfully', role_count;
END $$;

-- Success message
SELECT 'Default roles and permissions seeded successfully' as status;

COMMIT;
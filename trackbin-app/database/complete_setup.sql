-- COMPLETE SETUP SCRIPT WITH FIXED TABLE NAMES
-- This script creates the complete TrackBin authentication system using app_users

BEGIN;

-- Step 1: Create the fixed migration
-- Create app_users table (avoiding conflict with Supabase's auth.users)
CREATE TABLE IF NOT EXISTS app_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role_id UUID NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  last_login TIMESTAMP,
  created_by UUID,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create roles table
CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  is_system_role BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create permissions table
CREATE TABLE IF NOT EXISTS permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module VARCHAR(50) NOT NULL,
  action VARCHAR(50) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(module, action)
);

-- Create role_permissions junction table
CREATE TABLE IF NOT EXISTS role_permissions (
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (role_id, permission_id)
);

-- Create user_permissions table for individual overrides
CREATE TABLE IF NOT EXISTS user_permissions (
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  granted BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  created_by UUID REFERENCES app_users(id),
  PRIMARY KEY (user_id, permission_id)
);

-- Create user_sessions table for session management
CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  session_token VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  last_activity TIMESTAMP DEFAULT NOW()
);

-- Create role_assignments table for audit trail
CREATE TABLE IF NOT EXISTS role_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  assigned_by UUID NOT NULL REFERENCES app_users(id),
  assigned_at TIMESTAMP DEFAULT NOW(),
  reason TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE
);

-- Add foreign key constraint for role_id in app_users
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_app_users_role_id') THEN
    ALTER TABLE app_users ADD CONSTRAINT fk_app_users_role_id 
      FOREIGN KEY (role_id) REFERENCES roles(id);
  END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_app_users_email ON app_users(email);
CREATE INDEX IF NOT EXISTS idx_app_users_role_id ON app_users(role_id);
CREATE INDEX IF NOT EXISTS idx_app_users_is_active ON app_users(is_active);

-- Step 2: Insert permissions
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
ON CONFLICT (module, action) DO UPDATE SET description = EXCLUDED.description;

-- Step 3: Insert roles
INSERT INTO roles (name, description, is_system_role, created_at) VALUES
('System Administrator', 'Full system access with user management and system configuration', true, NOW()),
('Warehouse Manager', 'Full operational access to all warehouse functions', true, NOW()),
('Inventory Manager', 'Full access to inventory management and stock operations', true, NOW()),
('Receiving Supervisor', 'Full access to receiving operations and related inventory', true, NOW()),
('Shipping Supervisor', 'Full access to shipping operations and related inventory', true, NOW()),
('Stock Clerk', 'Basic stock operations and movements', true, NOW()),
('Receiving Clerk', 'Basic receiving operations', true, NOW()),
('Shipping Clerk', 'Basic shipping operations', true, NOW()),
('Auditor', 'Read-only access to audit logs and reports', true, NOW()),
('Viewer', 'Basic read-only access to dashboard and inventory', true, NOW())
ON CONFLICT (name) DO UPDATE SET 
    description = EXCLUDED.description,
    is_system_role = EXCLUDED.is_system_role;

-- Step 4: Assign permissions to roles
-- System Administrator gets all permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p 
WHERE r.name = 'System Administrator' AND r.is_system_role = true
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Warehouse Manager gets operational permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'Warehouse Manager' AND r.is_system_role = true
AND p.module IN ('dashboard', 'items', 'stock', 'receiving', 'shipping', 'audit', 'settings')
AND p.action != 'system_settings'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Inventory Manager gets inventory-focused permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'Inventory Manager' AND r.is_system_role = true
AND p.module IN ('dashboard', 'items', 'stock', 'receiving', 'shipping')
AND p.action IN ('view', 'create', 'edit', 'move', 'adjust', 'change_status', 'process')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Viewer gets basic read permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'Viewer' AND r.is_system_role = true
AND ((p.module = 'dashboard' AND p.action = 'view')
OR (p.module = 'items' AND p.action = 'view')
OR (p.module = 'stock' AND p.action = 'view'))
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Step 5: Create ACME users
INSERT INTO app_users (
    id,
    name,
    email,
    password_hash,
    role_id,
    is_active,
    created_by,
    created_at
) VALUES 
(
    'ace00000-0000-4000-8000-000000000001',
    'ACME Administrator',
    'admin@acme.com',
    encode('acme2025'::bytea, 'base64'),
    (SELECT id FROM roles WHERE name = 'System Administrator'),
    true,
    NULL,
    NOW()
),
(
    'ace00000-0000-4000-8000-000000000002',
    'ACME CEO',
    'ceo@acme.com',
    encode('acme2025'::bytea, 'base64'),
    (SELECT id FROM roles WHERE name = 'Warehouse Manager'),
    true,
    'ace00000-0000-4000-8000-000000000001',
    NOW()
),
(
    'ace00000-0000-4000-8000-000000000003',
    'ACME Dispatcher',
    'dispatcher@acme.com',
    encode('acme2025'::bytea, 'base64'),
    (SELECT id FROM roles WHERE name = 'Inventory Manager'),
    true,
    'ace00000-0000-4000-8000-000000000001',
    NOW()
)
ON CONFLICT (email) DO UPDATE SET
    name = EXCLUDED.name,
    password_hash = EXCLUDED.password_hash,
    role_id = EXCLUDED.role_id,
    is_active = EXCLUDED.is_active;

-- Step 6: Verification
SELECT 
    '=== SETUP VERIFICATION ===' as status;

-- Show created users
SELECT 
    'ACME USERS:' as section,
    u.name,
    u.email,
    r.name as role,
    u.is_active,
    u.password_hash
FROM app_users u
JOIN roles r ON u.role_id = r.id
WHERE u.email LIKE '%@acme.com'
ORDER BY u.email;

-- Show role summary
SELECT 
    'ROLE SUMMARY:' as section,
    r.name as role_name,
    COUNT(rp.permission_id) as permission_count
FROM roles r
LEFT JOIN role_permissions rp ON r.id = rp.role_id
WHERE r.is_system_role = true
GROUP BY r.id, r.name
ORDER BY permission_count DESC;

-- Test password hashing
SELECT 
    'PASSWORD TEST:' as section,
    'admin@acme.com' as email,
    encode('acme2025'::bytea, 'base64') as expected_hash,
    u.password_hash as actual_hash,
    (u.password_hash = encode('acme2025'::bytea, 'base64')) as hash_matches
FROM app_users u
WHERE u.email = 'admin@acme.com';

-- Final success message
SELECT 
    '=== AUTHENTICATION READY ===' as section,
    'admin@acme.com / acme2025' as administrator,
    'ceo@acme.com / acme2025' as ceo,
    'dispatcher@acme.com / acme2025' as dispatcher;

COMMIT;

SELECT 'Complete setup finished - app_users table created successfully!' as final_status;
-- Initial Admin User Setup
-- This script creates the first admin user account for system access

-- Set variables (you can modify these values)
-- NOTE: Change these values before running in production!
\set admin_email 'admin@trackbin.com'
\set admin_name 'System Administrator'
\set admin_password 'TrackBin2024!' -- This should be changed immediately after first login

-- Get the System Administrator role ID
DO $$
DECLARE
    admin_role_id UUID;
    admin_user_id UUID;
    password_hash TEXT;
BEGIN
    -- Get the System Administrator role ID
    SELECT id INTO admin_role_id 
    FROM roles 
    WHERE name = 'System Administrator' AND is_system_role = true;
    
    IF admin_role_id IS NULL THEN
        RAISE EXCEPTION 'System Administrator role not found. Please run the roles and permissions seed script first.';
    END IF;
    
    -- Generate a simple password hash (in production, use proper bcrypt)
    -- This is just base64 encoding for demo purposes
    password_hash := encode(:'admin_password'::bytea, 'base64');
    
    -- Check if admin user already exists
    SELECT id INTO admin_user_id FROM users WHERE email = :'admin_email';
    
    IF admin_user_id IS NOT NULL THEN
        RAISE NOTICE 'Admin user already exists with email: %', :'admin_email';
    ELSE
        -- Create the admin user
        INSERT INTO users (
            id,
            name,
            email,
            password_hash,
            role_id,
            is_active,
            created_at
        ) VALUES (
            'a0000000-0000-4000-8000-000000000001',
            :'admin_name',
            :'admin_email',
            password_hash,
            admin_role_id,
            true,
            NOW()
        );
        
        -- Log the role assignment
        INSERT INTO role_assignments (
            user_id,
            role_id,
            assigned_by,
            assigned_at,
            reason
        ) VALUES (
            'a0000000-0000-4000-8000-000000000001',
            admin_role_id,
            'a0000000-0000-4000-8000-000000000001',
            NOW(),
            'Initial admin user creation'
        );
        
        RAISE NOTICE 'Admin user created successfully!';
        RAISE NOTICE 'Email: %', :'admin_email';
        RAISE NOTICE 'Password: %', :'admin_password';
        RAISE NOTICE 'IMPORTANT: Please change the password immediately after first login!';
    END IF;
END $$;

-- Create additional sample users for testing (optional)
DO $$
DECLARE
    warehouse_manager_role_id UUID;
    inventory_manager_role_id UUID;
    viewer_role_id UUID;
    password_hash TEXT;
BEGIN
    -- Get role IDs
    SELECT id INTO warehouse_manager_role_id FROM roles WHERE name = 'Warehouse Manager';
    SELECT id INTO inventory_manager_role_id FROM roles WHERE name = 'Inventory Manager';
    SELECT id INTO viewer_role_id FROM roles WHERE name = 'Viewer';
    
    -- Simple password hash for demo
    password_hash := encode('demo123'::bytea, 'base64');
    
    -- Create sample warehouse manager
    INSERT INTO users (
        id,
        name,
        email,
        password_hash,
        role_id,
        is_active,
        created_by,
        created_at
    ) VALUES (
        'a0000000-0000-4000-8000-000000000002',
        'John Manager',
        'manager@trackbin.com',
        password_hash,
        warehouse_manager_role_id,
        true,
        'a0000000-0000-4000-8000-000000000001',
        NOW()
    ) ON CONFLICT (id) DO NOTHING;
    
    -- Create sample inventory manager
    INSERT INTO users (
        id,
        name,
        email,
        password_hash,
        role_id,
        is_active,
        created_by,
        created_at
    ) VALUES (
        'a0000000-0000-4000-8000-000000000003',
        'Jane Inventory',
        'inventory@trackbin.com',
        password_hash,
        inventory_manager_role_id,
        true,
        'a0000000-0000-4000-8000-000000000001',
        NOW()
    ) ON CONFLICT (id) DO NOTHING;
    
    -- Create sample viewer
    INSERT INTO users (
        id,
        name,
        email,
        password_hash,
        role_id,
        is_active,
        created_by,
        created_at
    ) VALUES (
        'a0000000-0000-4000-8000-000000000004',
        'Bob Viewer',
        'viewer@trackbin.com',
        password_hash,
        viewer_role_id,
        true,
        'a0000000-0000-4000-8000-000000000001',
        NOW()
    ) ON CONFLICT (id) DO NOTHING;
    
    -- Log role assignments for sample users
    INSERT INTO role_assignments (user_id, role_id, assigned_by, assigned_at, reason)
    VALUES 
        ('a0000000-0000-4000-8000-000000000002', warehouse_manager_role_id, 'a0000000-0000-4000-8000-000000000001', NOW(), 'Sample user creation'),
        ('a0000000-0000-4000-8000-000000000003', inventory_manager_role_id, 'a0000000-0000-4000-8000-000000000001', NOW(), 'Sample user creation'),
        ('a0000000-0000-4000-8000-000000000004', viewer_role_id, 'a0000000-0000-4000-8000-000000000001', NOW(), 'Sample user creation')
    ON CONFLICT DO NOTHING;
    
    RAISE NOTICE 'Sample users created for testing:';
    RAISE NOTICE 'Manager: manager@trackbin.com / demo123';
    RAISE NOTICE 'Inventory: inventory@trackbin.com / demo123';
    RAISE NOTICE 'Viewer: viewer@trackbin.com / demo123';
END $$;

-- Display user summary
SELECT 
    u.name,
    u.email,
    r.name as role,
    u.is_active,
    u.created_at
FROM users u
JOIN roles r ON u.role_id = r.id
ORDER BY u.created_at;

-- Display permissions summary for each role
SELECT 
    r.name as role_name,
    COUNT(rp.permission_id) as total_permissions,
    STRING_AGG(DISTINCT p.module, ', ') as modules
FROM roles r
LEFT JOIN role_permissions rp ON r.id = rp.role_id
LEFT JOIN permissions p ON rp.permission_id = p.id
WHERE r.is_system_role = true
GROUP BY r.id, r.name
ORDER BY total_permissions DESC;

-- Success message
SELECT 'Initial admin user and sample users created successfully' as status;

-- Security reminder
SELECT 'SECURITY REMINDER: Change default passwords immediately after first login!' as warning;
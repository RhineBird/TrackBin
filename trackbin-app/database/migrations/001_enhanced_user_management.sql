-- Enhanced User Management System Migration
-- This script creates all tables needed for the comprehensive user role and permission system

-- Drop existing tables if they exist (for fresh install)
DROP TABLE IF EXISTS role_assignments CASCADE;
DROP TABLE IF EXISTS user_sessions CASCADE;
DROP TABLE IF EXISTS user_permissions CASCADE;
DROP TABLE IF EXISTS role_permissions CASCADE;
DROP TABLE IF EXISTS permissions CASCADE;
DROP TABLE IF EXISTS stock_status_history CASCADE;

-- Update existing tables to match new schema
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS last_login TIMESTAMP,
ADD COLUMN IF NOT EXISTS created_by UUID;

-- Update roles table to match new schema
ALTER TABLE roles 
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS is_system_role BOOLEAN DEFAULT FALSE;

-- Update the role name column to allow custom names
ALTER TABLE roles ALTER COLUMN name TYPE VARCHAR(100);

-- Create permissions table
CREATE TABLE permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module VARCHAR(50) NOT NULL,
  action VARCHAR(50) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(module, action)
);

-- Create role_permissions junction table
CREATE TABLE role_permissions (
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (role_id, permission_id)
);

-- Create user_permissions table for individual overrides
CREATE TABLE user_permissions (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  granted BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  PRIMARY KEY (user_id, permission_id)
);

-- Create user_sessions table for session management
CREATE TABLE user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_token VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  last_activity TIMESTAMP DEFAULT NOW()
);

-- Create role_assignments table for audit trail
CREATE TABLE role_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  assigned_by UUID NOT NULL REFERENCES users(id),
  assigned_at TIMESTAMP DEFAULT NOW(),
  reason TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE
);

-- Create stock_status_history table for stock status audit
CREATE TABLE stock_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_entry_id UUID NOT NULL REFERENCES stock_entries(id) ON DELETE CASCADE,
  old_status VARCHAR(20) NOT NULL,
  new_status VARCHAR(20) NOT NULL,
  reason TEXT NOT NULL,
  changed_by_user_id UUID NOT NULL REFERENCES users(id),
  changed_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role_id ON users(role_id);
CREATE INDEX idx_users_is_active ON users(is_active);
CREATE INDEX idx_users_last_login ON users(last_login);

CREATE INDEX idx_permissions_module ON permissions(module);
CREATE INDEX idx_permissions_action ON permissions(action);
CREATE INDEX idx_permissions_module_action ON permissions(module, action);

CREATE INDEX idx_role_permissions_role_id ON role_permissions(role_id);
CREATE INDEX idx_role_permissions_permission_id ON role_permissions(permission_id);

CREATE INDEX idx_user_permissions_user_id ON user_permissions(user_id);
CREATE INDEX idx_user_permissions_permission_id ON user_permissions(permission_id);

CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_token ON user_sessions(session_token);
CREATE INDEX idx_user_sessions_expires_at ON user_sessions(expires_at);

CREATE INDEX idx_role_assignments_user_id ON role_assignments(user_id);
CREATE INDEX idx_role_assignments_role_id ON role_assignments(role_id);
CREATE INDEX idx_role_assignments_assigned_at ON role_assignments(assigned_at);

CREATE INDEX idx_stock_status_history_stock_entry_id ON stock_status_history(stock_entry_id);
CREATE INDEX idx_stock_status_history_changed_at ON stock_status_history(changed_at);
CREATE INDEX idx_stock_status_history_changed_by ON stock_status_history(changed_by_user_id);

-- Add constraints for data integrity
ALTER TABLE users ADD CONSTRAINT users_email_unique UNIQUE (email);
ALTER TABLE users ADD CONSTRAINT users_email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

ALTER TABLE permissions ADD CONSTRAINT permissions_module_not_empty CHECK (module != '');
ALTER TABLE permissions ADD CONSTRAINT permissions_action_not_empty CHECK (action != '');

ALTER TABLE user_sessions ADD CONSTRAINT user_sessions_expires_future CHECK (expires_at > created_at);

ALTER TABLE stock_status_history ADD CONSTRAINT stock_status_history_status_valid 
  CHECK (old_status IN ('available', 'reserved', 'quarantined', 'damaged') AND 
         new_status IN ('available', 'reserved', 'quarantined', 'damaged'));

-- Create a function to automatically clean up expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void AS $$
BEGIN
  DELETE FROM user_sessions WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Create a function to log role assignments
CREATE OR REPLACE FUNCTION log_role_assignment()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.role_id != NEW.role_id THEN
    INSERT INTO role_assignments (user_id, role_id, assigned_by, reason)
    VALUES (NEW.id, NEW.role_id, NEW.created_by, 'Role updated');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic role assignment logging
CREATE TRIGGER trigger_log_role_assignment
  AFTER UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION log_role_assignment();

-- Create a function to update last_activity in sessions
CREATE OR REPLACE FUNCTION update_session_activity()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE user_sessions 
  SET last_activity = NOW() 
  WHERE session_token = NEW.session_token;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add row-level security policies (optional, for multi-tenant scenarios)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_status_history ENABLE ROW LEVEL SECURITY;

-- Create policies for basic access (can be customized based on requirements)
CREATE POLICY users_policy ON users FOR ALL TO authenticated USING (true);
CREATE POLICY roles_policy ON roles FOR ALL TO authenticated USING (true);
CREATE POLICY permissions_policy ON permissions FOR ALL TO authenticated USING (true);
CREATE POLICY user_sessions_policy ON user_sessions FOR ALL TO authenticated USING (true);
CREATE POLICY role_assignments_policy ON role_assignments FOR ALL TO authenticated USING (true);
CREATE POLICY stock_status_history_policy ON stock_status_history FOR ALL TO authenticated USING (true);

-- Add comments for documentation
COMMENT ON TABLE users IS 'Enhanced user accounts with activity tracking and role management';
COMMENT ON TABLE roles IS 'System and custom roles with descriptions and permissions';
COMMENT ON TABLE permissions IS 'Granular permissions for module-action combinations';
COMMENT ON TABLE role_permissions IS 'Junction table mapping roles to permissions';
COMMENT ON TABLE user_permissions IS 'Individual user permission overrides';
COMMENT ON TABLE user_sessions IS 'User session management and tracking';
COMMENT ON TABLE role_assignments IS 'Audit trail for role assignments and changes';
COMMENT ON TABLE stock_status_history IS 'Audit trail for stock status changes';

COMMENT ON COLUMN users.is_active IS 'Whether the user account is active and can log in';
COMMENT ON COLUMN users.last_login IS 'Timestamp of the user last successful login';
COMMENT ON COLUMN users.created_by IS 'ID of the user who created this account';
COMMENT ON COLUMN roles.description IS 'Human-readable description of the role';
COMMENT ON COLUMN roles.is_system_role IS 'Whether this is a built-in system role (cannot be deleted)';
COMMENT ON COLUMN permissions.module IS 'The module/feature this permission applies to';
COMMENT ON COLUMN permissions.action IS 'The specific action this permission allows';
COMMENT ON COLUMN user_permissions.granted IS 'Whether the permission is granted (true) or denied (false)';
COMMENT ON COLUMN user_sessions.session_token IS 'Unique token for session identification';
COMMENT ON COLUMN user_sessions.expires_at IS 'When this session expires';
COMMENT ON COLUMN role_assignments.reason IS 'Reason for the role assignment or change';
COMMENT ON COLUMN stock_status_history.old_status IS 'Previous status before change';
COMMENT ON COLUMN stock_status_history.new_status IS 'New status after change';
COMMENT ON COLUMN stock_status_history.reason IS 'Reason for the status change';

-- Success message
SELECT 'Enhanced user management system migration completed successfully' as status;
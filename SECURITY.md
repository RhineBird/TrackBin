# TrackBin Security Guide

This document outlines security best practices and configuration for the TrackBin warehouse management system.

## 🔐 Environment Security

### Critical Files to Protect

Never commit these files to version control - they contain sensitive credentials:

```
.env.local                    # Supabase credentials for frontend
claude-mcp-config.json        # Supabase access token for MCP
```

### Environment Variables

#### Frontend Environment (`.env.local`)
```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
```

- **VITE_SUPABASE_URL**: Public project URL - safe to expose in frontend
- **VITE_SUPABASE_ANON_KEY**: Public anon key - has limited permissions via RLS

#### MCP Configuration (`claude-mcp-config.json`)
```json
{
  "mcpServers": {
    "supabase": {
      "env": {
        "SUPABASE_ACCESS_TOKEN": "sbp_064342db0f491cd94a85c379954a51fec896a5ec"
      }
    }
  }
}
```

- **SUPABASE_ACCESS_TOKEN**: Admin-level token - NEVER expose or commit

### Setup Checklist

1. ✅ Copy template files:
   ```bash
   cp .env.example .env.local
   cp claude-mcp-config.example.json claude-mcp-config.json
   ```

2. ✅ Verify .gitignore includes:
   ```
   .env.local
   claude-mcp-config.json
   ```

3. ✅ Check git status to ensure no sensitive files are tracked:
   ```bash
   git status --ignored
   ```

## 🛡️ Database Security

### Row Level Security (RLS)

TrackBin implements comprehensive RLS policies:

- **Admin**: Full access to all data and operations
- **Operator**: Read/write access to inventory operations
- **Viewer**: Read-only access to inventory data

### Audit Logging

All critical operations are automatically logged:
- Stock movements and transfers
- Inventory adjustments
- User actions and changes
- System-level operations

### Database Constraints

- **Foreign key constraints** prevent orphaned records
- **Check constraints** prevent negative stock levels
- **UUID primary keys** prevent enumeration attacks
- **Indexed queries** for performance and security

## 🔑 Key Management

### Supabase Keys

1. **Project URL** (`VITE_SUPABASE_URL`)
   - Public identifier
   - Safe to include in frontend code
   - Format: `https://project-ref.supabase.co`

2. **Anon Key** (`VITE_SUPABASE_ANON_KEY`)
   - Public key with limited permissions
   - Controlled by RLS policies
   - Safe for client-side use

3. **Access Token** (`SUPABASE_ACCESS_TOKEN`)
   - Admin-level privileges
   - Can bypass RLS policies
   - **NEVER** expose to frontend
   - Used only for CLI/MCP operations

### Key Rotation

Rotate keys periodically for security:

1. **Generate new keys** in Supabase dashboard
2. **Update environment files** with new values
3. **Test functionality** before deploying
4. **Revoke old keys** in Supabase settings

## 🚨 Security Threats & Mitigations

### Common Threats

| Threat | Risk Level | Mitigation |
|--------|------------|------------|
| Exposed credentials in git | 🔴 Critical | Enhanced .gitignore, pre-commit hooks |
| SQL injection | 🟡 Medium | Supabase client parameterized queries |
| Unauthorized access | 🟡 Medium | RLS policies, role-based access |
| XSS attacks | 🟡 Medium | Input validation, React's built-in protection |
| CSRF attacks | 🟢 Low | Supabase JWT tokens, SameSite cookies |

### Security Headers

Recommended security headers for production:

```
Content-Security-Policy: default-src 'self' https://*.supabase.co
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
```

## 🔍 Security Monitoring

### What to Monitor

1. **Failed authentication attempts**
2. **Unusual data access patterns**
3. **Bulk data exports**
4. **Admin privilege usage**
5. **Database connection anomalies**

### Audit Log Review

Regular audit log analysis should include:

```sql
-- Recent admin actions
SELECT * FROM audit_logs 
WHERE user_id IN (SELECT id FROM users WHERE role_id = 'admin_role_id')
ORDER BY timestamp DESC LIMIT 100;

-- Bulk operations
SELECT action_type, entity, COUNT(*) as count 
FROM audit_logs 
WHERE timestamp > NOW() - INTERVAL '24 hours'
GROUP BY action_type, entity 
HAVING COUNT(*) > 50;

-- Failed operations
SELECT * FROM audit_logs 
WHERE details_json->>'error' IS NOT NULL
ORDER BY timestamp DESC;
```

## ⚠️ Security Incidents

### Response Plan

1. **Immediate Actions**
   - Revoke compromised credentials
   - Block suspicious IP addresses
   - Enable additional logging

2. **Investigation**
   - Review audit logs
   - Check git history for exposed credentials
   - Analyze access patterns

3. **Recovery**
   - Generate new credentials
   - Update all environments
   - Document lessons learned

### Emergency Contacts

- **Supabase Support**: support@supabase.com
- **Security Team**: [Your security contact]
- **System Administrator**: [Your admin contact]

## 📋 Security Checklist

### Development Environment
- [ ] Environment files are not committed
- [ ] Template files are up to date
- [ ] Local database uses test data only
- [ ] Debug logs don't contain credentials

### Staging Environment  
- [ ] Separate Supabase project from production
- [ ] Limited data set for testing
- [ ] Access restricted to team members
- [ ] Regular security scans

### Production Environment
- [ ] Strong passwords and 2FA enabled
- [ ] Regular key rotation schedule
- [ ] Monitoring and alerting configured
- [ ] Backup and recovery procedures tested
- [ ] Security headers configured
- [ ] SSL/TLS certificates valid

## 📚 Additional Resources

- [Supabase Security Best Practices](https://supabase.com/docs/guides/auth/row-level-security)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [React Security Guide](https://reactjs.org/docs/dom-elements.html#dangerouslysetinnerhtml)
- [Node.js Security Checklist](https://blog.risingstack.com/node-js-security-checklist/)

---

**Remember**: Security is an ongoing process, not a one-time setup. Regular reviews and updates are essential for maintaining a secure system.
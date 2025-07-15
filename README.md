# TrackBin

> A modern warehouse management system for production facilities of all sizes

TrackBin is a comprehensive web-based inventory management solution designed for factory operators, warehouse supervisors, and administrators. Built with React and Supabase, it provides real-time inventory tracking, stock movements, and comprehensive audit logging.

## 🚀 Features

- **📊 Dashboard & Analytics** - Real-time KPIs, stock alerts, and activity overview
- **📦 Inventory Management** - Track items by SKU with current stock levels and locations
- **🏢 Bin-Level Tracking** - Organize inventory by warehouse zones and bin locations
- **📥 Goods Receiving** - Streamlined receiving process with expected vs actual quantities
- **🔄 Stock Movements** - Transfer stock between bins with full audit trail
- **📤 Shipping & Picking** - Prepare outgoing shipments with item tracking
- **👥 User Management** - Role-based access control (Admin, Operator, Viewer)
- **📋 Audit Logging** - Complete transaction history for compliance
- **🌍 Multilingual Support** - English primary, Turkish secondary (ready for i18n)

## 🛠️ Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Backend**: Supabase (PostgreSQL + Auth + Real-time)
- **Routing**: React Router v6
- **Styling**: CSS Modules with responsive design
- **Database**: PostgreSQL with Row Level Security (RLS)

## 🏗️ Architecture

### User Roles
- **Admin**: Full system access including user management
- **Operator**: Inventory operations and stock management
- **Viewer**: Read-only access to inventory data

### Core Entities
- **Warehouses** → **Zones** → **Bins** (hierarchical location structure)
- **Items** with SKU tracking and status management
- **Stock Entries** with real-time quantity and status
- **Receipts/Shipments** for inbound/outbound logistics
- **Audit Logs** for complete transaction traceability

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- Supabase account

### Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/RhineBird/TrackBin.git
   cd TrackBin
   ```

2. **Set up the database**
   - Create a new Supabase project
   - Run the SQL schema from `supabase-schema.sql` in your Supabase SQL editor

3. **Configure environment**
   ```bash
   cd trackbin-app
   cp .env.example .env.local
   ```
   
   Update `.env.local` with your Supabase credentials:
   ```env
   VITE_SUPABASE_URL=https://your-project-ref.supabase.co
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here
   ```
   
   Get these values from your Supabase project dashboard:
   - **Project URL**: Found in Project Settings → API
   - **Anon Key**: Found in Project Settings → API
   
   ⚠️ **Security Note**: Never commit `.env.local` to version control. It contains sensitive credentials.

4. **Install dependencies and start**
   ```bash
   npm install
   npm run dev
   ```

5. **Access the application**
   Open http://localhost:5173

## 📁 Project Structure

```
TrackBin/
├── trackbin-app/                 # React frontend application
│   ├── src/
│   │   ├── components/Layout/    # Sidebar and main layout
│   │   ├── lib/supabase.ts      # Supabase client config
│   │   ├── pages/               # Application pages
│   │   └── types/database.ts    # TypeScript type definitions
│   └── ...
├── supabase-schema.sql          # Complete database schema
└── README.md                    # This file
```

## 🗄️ Database Schema

The system uses a comprehensive PostgreSQL schema with:

- **UUID primary keys** for all entities
- **Enum types** for controlled vocabularies (roles, bin types, stock status)
- **Foreign key constraints** ensuring data integrity
- **Audit triggers** for automatic transaction logging
- **Row Level Security** for role-based data access
- **Performance indexes** for optimized queries

Key constraints:
- No negative stock levels allowed
- All inventory transactions are automatically logged
- Role-based access enforced at database level

## 🔐 Security

### Environment Security
- **Environment variables** for all sensitive configuration
- **Template files** (`.env.example`, `claude-mcp-config.example.json`) for safe setup
- **Enhanced .gitignore** patterns prevent credential leaks
- **Never commit** actual environment files to version control

### Database Security
- **Row Level Security (RLS)** policies enforce role-based access
- **Audit logging** for all inventory operations
- **Foreign key constraints** maintain data integrity
- **UUID-based IDs** prevent enumeration attacks

### Application Security
- **Session-based authentication** via Supabase Auth
- **Role-based access control** (Admin, Operator, Viewer)
- **Input validation** on all forms
- **SQL injection protection** via Supabase client

### Best Practices
1. **Rotate keys regularly** - Update Supabase keys periodically
2. **Use different environments** - Separate dev/staging/production credentials
3. **Monitor access logs** - Review audit logs for suspicious activity
4. **Backup sensitive data** - Store environment configs securely offline
5. **Review permissions** - Regularly audit user roles and database policies

### Environment Variables Reference
- `VITE_SUPABASE_URL`: Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY`: Public anon key for client connections
- `SUPABASE_ACCESS_TOKEN`: Private token for CLI/MCP (in claude-mcp-config.json)

⚠️ **Critical**: The access token has admin privileges. Treat it like a password.

## 🚧 Development Status

- ✅ **Core Infrastructure**: React app, database schema, authentication
- ✅ **Basic UI**: Responsive sidebar layout, navigation, dashboard
- 🚧 **Inventory Operations**: CRUD operations for items and stock
- 🚧 **Receiving/Shipping**: Form workflows for goods processing
- 🚧 **Reports & Analytics**: Advanced dashboard metrics
- 🚧 **Mobile Responsiveness**: Touch-optimized interface
- 🚧 **Internationalization**: Turkish translation implementation

## 📝 API Documentation

The application uses Supabase's auto-generated REST API. Key endpoints include:

- `/items` - Item management
- `/stock_entries` - Current inventory levels
- `/stock_movements` - Movement history
- `/receipts` & `/shipments` - Logistics operations
- `/audit_logs` - Transaction history

Real-time subscriptions available for live inventory updates.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:
- Create an issue in this repository
- Check the `trackbin-app/README.md` for frontend-specific setup

---

**TrackBin** - Streamlining warehouse operations for modern manufacturing.
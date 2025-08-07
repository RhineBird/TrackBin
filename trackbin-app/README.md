# TrackBin - Warehouse Management System

A comprehensive web-based warehouse management system designed for factory operators, warehouse supervisors, and administrators. TrackBin provides real-time inventory tracking, goods receiving, stock movements, and audit logging capabilities with full multilingual support.

## 🌟 Features

### Core Functionality
- **Item Management**: Complete product catalog with SKU tracking, descriptions, and units
- **Inventory Tracking**: Real-time stock levels tracked by bin location
- **Goods Receiving**: Streamlined receiving process with variance tracking
- **Stock Movement**: Inter-bin stock transfers with reason tracking
- **Shipment Management**: Outbound shipment creation and tracking
- **Audit Logging**: Comprehensive activity logging with search and export
- **User Management**: Role-based access control with admin/operator/viewer roles

### User Interface
- **🌍 Multilingual Support**: Complete English and Turkish localization
- **📱 Mobile Responsive**: Touch-friendly interface optimized for all devices  
- **🎨 Modern UI**: Clean, intuitive design with sidebar navigation
- **🔄 Real-time Updates**: Live data synchronization across all users
- **🔍 Advanced Search**: Powerful search and filtering capabilities
- **📊 Dashboard**: Real-time KPIs, metrics, and activity feeds

### Technical Features
- **⚡ Real-time Database**: Powered by Supabase PostgreSQL
- **🔐 Authentication**: Secure user authentication with session management
- **📈 Performance**: Optimized queries and efficient data loading
- **🛡️ Data Integrity**: Comprehensive validation and error handling
- **📋 Audit Trail**: Complete tracking of all system changes
- **🌐 Internationalization**: Dynamic language switching with user preferences

## 🚀 Technology Stack

- **Frontend**: React 18 with TypeScript
- **Backend**: Supabase (PostgreSQL + Real-time + Auth)
- **Styling**: CSS with responsive design
- **Build Tool**: Vite
- **Deployment**: Netlify-ready
- **Languages**: English (primary), Turkish (secondary)

## 📦 Installation & Setup

### Prerequisites
- Node.js 18+ and npm
- Supabase account and project

### Environment Setup
1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create `.env.local` file with your Supabase credentials:
   ```env
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

### Development Commands
```bash
# Start development server
npm run dev

# Build for production
npm run build

# Run linting
npm run lint

# Preview production build
npm run preview
```

## 🗄️ Database Schema

The application uses a comprehensive database schema including:

### Core Tables
- **items**: Product catalog with SKU, name, description, unit
- **bins**: Storage locations with zone and warehouse hierarchy
- **stock_entries**: Current stock levels by item and bin
- **stock_movements**: Historical stock transfer records

### Operational Tables
- **receipts**: Incoming shipment records
- **receipt_lines**: Individual items in receipts
- **shipments**: Outgoing shipment records  
- **shipment_lines**: Individual items in shipments

### System Tables
- **users**: User accounts with roles and permissions
- **roles**: System and custom roles
- **audit_logs**: Complete activity audit trail

## 👥 User Roles & Permissions

### Administrator
- Full system access including user management
- Can create/edit/delete all records
- Access to audit logs and system configuration
- User and role management capabilities

### Operator  
- Inventory operations and stock management
- Can receive goods, move stock, create shipments
- Read/write access to operational data
- Cannot manage users or system settings

### Viewer
- Read-only access to inventory data
- Can view stock levels, movements, and reports
- Cannot modify any data or perform operations

## 🌍 Internationalization

TrackBin features complete multilingual support:

### Supported Languages
- **English** (en): Primary language with full coverage
- **Turkish** (tr): Complete translation including technical terms

### Features
- Dynamic language switching with instant UI updates
- User preference persistence in localStorage  
- Contextual translations for business terminology
- Date/time formatting per locale
- Number formatting with locale-specific separators

### Translation Coverage
- All UI elements, forms, and navigation
- Error messages and validation feedback
- Table headers, buttons, and labels
- Confirmation dialogs and notifications
- Dashboard metrics and status indicators

## 🔧 Development Notes

### Code Organization
- **Components**: Reusable UI components in `/src/components/`
- **Pages**: Main application views in `/src/pages/`
- **Services**: API integration layer in `/src/services/`
- **Types**: TypeScript definitions in `/src/types/`
- **i18n**: Internationalization system in `/src/i18n/`

### Key Implementation Details
- Uses React Context for i18n with template variable support
- Supabase real-time subscriptions for live updates
- Comprehensive error handling with user-friendly messages
- Mobile-first responsive design with CSS media queries
- Type-safe API calls with TypeScript interfaces

### Recent Improvements
- ✅ Complete Turkish localization (200+ translation keys)
- ✅ Fixed stock movement display issues with robust database queries
- ✅ Enhanced error handling and user feedback
- ✅ Improved mobile responsiveness and touch interfaces
- ✅ Optimized build performance and deployment readiness

## 📊 Performance & Scalability

### Optimizations
- Efficient Supabase queries with proper indexing
- Real-time subscriptions for live data updates
- Optimized bundle size with code splitting
- Responsive images and asset optimization
- Lazy loading for improved initial load times

### Scalability Features
- Pagination for large data sets
- Search optimization with database indexes
- Efficient state management with React hooks
- Modular component architecture for maintainability

## 🚀 Deployment

The application is configured for easy deployment on Netlify:

1. **Build Configuration**: Optimized Vite build process
2. **Environment Variables**: Secure handling of API keys
3. **Static Asset Optimization**: Compressed CSS/JS bundles
4. **Progressive Enhancement**: Works without JavaScript for basic functionality

### Build Output
- Gzipped bundle size: ~130KB JavaScript, ~7KB CSS
- Optimized for fast loading and caching
- Source maps for debugging in production

## 🛠️ Maintenance & Support

### Monitoring
- Comprehensive audit logging for troubleshooting
- Error tracking with detailed stack traces
- Performance monitoring through build metrics
- User activity tracking for usage analysis

### Updates
- Regular dependency updates for security
- Database migration support through Supabase
- Feature flags for gradual rollouts
- Backup and recovery procedures documented

## 📄 License

This project is proprietary software developed for warehouse management operations.

## 👨‍💻 Development Team

Developed with modern web technologies and best practices for enterprise warehouse management.

---

For technical support or questions about implementation, refer to the CLAUDE.md file for detailed development instructions and architectural decisions.
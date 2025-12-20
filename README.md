# Invoice Swift - Professional Invoice Management Platform

A modern, production-ready invoice management system built with a cutting-edge tech stack. Designed for small businesses, freelancers, and companies to create, manage, and track professional invoices with real-time synchronization and cloud storage.

**Live Demo**: [Deployed on Vercel](https://invoice-swift-demo.vercel.app)  
**Repository**: [GitHub](https://github.com/ANI-MAZING/invoice-swift)

---

## 🎯 Project Overview

Invoice Swift is a full-stack SaaS application that enables users to:

- Create and manage invoices with multiple customizable templates
- Maintain a client database for quick invoice generation
- Upload company branding (logo, signature) for professional invoices
- Export invoices as PDF
- Track invoice status and due dates
- Access a responsive dashboard with real-time data
- Toggle between light/dark themes
- Support multiple currencies

**Perfect for**: Freelancers, Small Business Owners, Consultants, Agencies

---

## 🏗️ Architecture Overview

### User Flow

```
Landing Page (Index)
    ↓
Authentication (Sign Up / Sign In via Supabase Auth)
    ↓
Dashboard (Invoice List & Overview)
    ├→ Create Invoice → Invoice Form → Template Selection → PDF Preview → Save to Database
    ├→ Edit Invoice → Modify Details → Update Database
    ├→ Clients Management → Add/Edit Clients → Reuse in Invoices
    ├→ Profile Settings → Company Details → Upload Logo/Signature → Branding Management
    └→ Theme Toggle (Light/Dark Mode)
```

---

## 🛠️ Tech Stack & Architecture Decisions

### Frontend Stack

| Technology          | Version | Purpose                 | Why Chosen                                                                        |
| ------------------- | ------- | ----------------------- | --------------------------------------------------------------------------------- |
| **React**           | 18.3.1  | UI Component Library    | Industry standard, excellent ecosystem, component reusability                     |
| **TypeScript**      | 5.8.3   | Static Type Checking    | Catches errors at compile-time, improves code maintainability, better IDE support |
| **Vite**            | 5.4.19  | Build Tool & Dev Server | 10-100x faster than Webpack, instant HMR, production-optimized builds             |
| **Tailwind CSS**    | 3.4.17  | Styling Framework       | Utility-first, highly customizable, rapid UI development, smaller bundle size     |
| **shadcn/ui**       | Latest  | Component Library       | Accessible, unstyled, copy-paste components, built on Radix UI + Tailwind         |
| **React Router**    | 6.30.1  | Client-side Routing     | SPA navigation, nested routes, code splitting support                             |
| **React Hook Form** | 7.61.1  | Form State Management   | Lightweight, performant, minimal re-renders, easy validation                      |
| **Zod**             | 3.25.76 | Schema Validation       | TypeScript-first validation, runtime & compile-time checking                      |

### Backend & Database

| Technology           | Version    | Purpose              | Why Chosen                                                           |
| -------------------- | ---------- | -------------------- | -------------------------------------------------------------------- |
| **Supabase**         | 2.81.1     | Backend-as-a-Service | PostgreSQL + Real-time API, Auth, Storage in one platform            |
| **PostgreSQL**       | (Supabase) | Database             | ACID compliance, JSON support, perfect for structured financial data |
| **Supabase Auth**    | Built-in   | Authentication       | JWT-based, email/password, automatic session management              |
| **Supabase Storage** | Built-in   | File Storage         | S3-compatible, CDN delivery, security policies per file              |

### Data Fetching & State Management

| Technology                | Version | Purpose         | Why Chosen                                                               |
| ------------------------- | ------- | --------------- | ------------------------------------------------------------------------ |
| **React Query**           | 5.83.0  | Server State    | Automatic caching, background refetching, simplifies async data handling |
| **@supabase/supabase-js** | 2.81.1  | Database Client | Realtime subscriptions, type-safe queries, automatic session handling    |

### UI/UX Libraries

| Technology           | Version | Purpose             | Why Chosen                                               |
| -------------------- | ------- | ------------------- | -------------------------------------------------------- |
| **Radix UI**         | Latest  | Headless Components | Accessibility-first, unstyled, full control over styling |
| **Lucide React**     | 0.462.0 | Icons               | 600+ icons, consistent design, tree-shakeable            |
| **Sonner**           | 1.7.4   | Toast Notifications | Beautiful, customizable, type-safe notifications         |
| **React Day Picker** | 8.10.1  | Date Selection      | Accessible, customizable date picker                     |
| **Embla Carousel**   | 8.6.0   | Carousel Component  | Lightweight, accessible, fluid animations                |
| **Recharts**         | 2.15.4  | Charts/Graphs       | React-native, responsive, easy data visualization        |

### Document Generation & Export

| Technology      | Version | Purpose        | Why Chosen                                                   |
| --------------- | ------- | -------------- | ------------------------------------------------------------ |
| **jsPDF**       | 3.0.3   | PDF Generation | Client-side PDF creation, no backend needed, privacy-focused |
| **HTML2Canvas** | 1.4.1   | DOM to Canvas  | Converts invoice HTML to image for PDF embedding             |

### Utilities & Helpers

| Technology         | Version | Purpose                 | Why Chosen                                                   |
| ------------------ | ------- | ----------------------- | ------------------------------------------------------------ |
| **Date-fns**       | 3.6.0   | Date Manipulation       | Functional, modular, tree-shakeable alternative to Moment.js |
| **Clsx**           | 2.1.1   | Class Name Merging      | Conditional CSS classes with Tailwind                        |
| **Tailwind Merge** | 2.6.0   | CSS Conflict Resolution | Prevents duplicate Tailwind classes                          |
| **Next Themes**    | 0.3.0   | Theme Switching         | Dark/Light mode management, localStorage persistence         |

### Development Tools

| Technology            | Version | Purpose                           |
| --------------------- | ------- | --------------------------------- |
| **ESLint**            | 9.32.0  | Code Quality & Linting            |
| **TypeScript ESLint** | 8.38.0  | TypeScript-specific linting rules |
| **PostCSS**           | 8.5.6   | CSS Processing & Autoprefixing    |
| **Autoprefixer**      | 10.4.21 | Vendor prefix handling            |

---

## 📊 Database Schema

### Tables Structure

**1. Profiles (User Information)**

```sql
- id (UUID) → Links to auth.users
- email, full_name, company_name
- company_logo_url, signature_url (file uploads)
- company_address, company_phone, company_email
- tax_id, bank details (account, routing, swift)
- created_at, updated_at
```

**2. Invoices (Invoice Records)**

```sql
- id, user_id (UUID)
- invoice_number, client details
- issue_date, due_date
- items (JSONB: line items array)
- subtotal, tax_rate, tax_amount, total
- template_id (classic/minimal/modern)
- status (draft/sent/paid/overdue)
- created_at, updated_at
```

**3. Clients (Client Management)**

```sql
- id, user_id
- client_name, client_email, client_address, phone
- created_at, updated_at
```

**4. Storage Buckets**

```
company-assets/ → User-specific folders for logos & signatures
```

### Security Features

- **Row Level Security (RLS)**: Users can only access their own data
- **Authentication**: Supabase JWT-based auth with auto session refresh
- **Storage Policies**: Users can upload/delete only their own files

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- npm or bun
- Git

### Installation

```bash
# Clone repository
git clone https://github.com/ANI-MAZING/invoice-swift.git
cd invoice-swift

# Install dependencies
npm install
# or
bun install

# Create .env file with Supabase credentials
VITE_SUPABASE_URL=your_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_key
VITE_SUPABASE_PROJECT_ID=your_project_id

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

---

## 📁 Project Structure

```
src/
├── pages/                    # Route pages
│   ├── Auth.tsx             # Login/Signup
│   ├── Dashboard.tsx        # Invoice list & overview
│   ├── CreateInvoice.tsx    # Invoice creation
│   ├── EditInvoice.tsx      # Invoice editing
│   ├── ClientsManagement.tsx # Client CRUD
│   └── ProfileSettings.tsx  # Company branding
├── components/
│   ├── invoice/             # Invoice-related components
│   │   ├── InvoiceForm.tsx  # Form with validation
│   │   ├── InvoiceList.tsx  # Table display
│   │   ├── InvoicePreview.tsx # PDF preview
│   │   └── templates/       # 3 invoice templates
│   ├── ui/                  # Shadcn/UI components
│   └── dashboard/           # Layout components
├── integrations/
│   └── supabase/
│       ├── client.ts        # Supabase client init
│       └── types.ts         # Auto-generated DB types
├── lib/                     # Utilities
│   ├── currencies.ts        # 150+ currency support
│   └── utils.ts             # Helper functions
├── hooks/                   # Custom React hooks
└── App.tsx                  # Main router setup
```

---

## 🎨 Features in Detail

### 1. **Invoice Management**

- Create invoices with dynamic line items
- Real-time calculation of subtotal, tax, and total
- 3 professional templates (Modern, Classic, Minimal)
- PDF export with company branding
- Status tracking (Draft, Sent, Paid, Overdue)
- Multi-currency support (150+ currencies)

### 2. **Client Management**

- Add and manage client database
- Quick-select clients when creating invoices
- Auto-fill client details in invoice form

### 3. **Company Branding**

- Upload company logo
- Upload signature
- Company details management (address, phone, tax ID)
- Banking information storage
- All branding applied to invoice templates

### 4. **Authentication & Security**

- Email/password signup and login
- JWT-based session management
- Automatic session refresh
- Secure, encrypted credentials in Supabase

### 5. **User Experience**

- Dark/Light theme toggle with persistence
- Responsive design (Mobile, Tablet, Desktop)
- Real-time form validation
- Toast notifications for actions
- Loading states and error handling
- Skeleton loaders for better UX

---

## 🔄 Key Design Patterns Used

1. **Component-Driven Architecture**: Modular, reusable components from shadcn/ui
2. **Form-First Validation**: React Hook Form + Zod for type-safe, server-side validation
3. **Real-time State Sync**: React Query for automatic cache invalidation
4. **Provider Pattern**: Theme, Query, and Toast providers wrapped at App root
5. **Custom Hooks**: Separation of logic from UI components
6. **Environment Configuration**: Secure env variable handling for API keys

---

## 📈 Performance Optimizations

- **Code Splitting**: Route-based code splitting via Vite
- **Tree Shaking**: Unused exports automatically removed in production
- **Image Optimization**: SVG icons instead of raster images
- **CSS Optimization**: Tailwind purges unused styles in production
- **Lazy Loading**: Components load on demand
- **Caching Strategy**: React Query caches data client-side

---

## 🌐 Deployment

### Deployed on Vercel

- Automatic deployment on git push to main
- Environment variables configured in Vercel dashboard
- Edge functions available for enhanced performance
- Analytics and performance monitoring included

**Deploy to Vercel** (1-click):

1. Push code to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Import repository
4. Add environment variables
5. Deploy!

---

## 🧪 Development Commands

```bash
# Development server with HMR
npm run dev

# Build for production
npm run build

# Build in development mode
npm run build:dev

# Preview production build locally
npm run preview

# Lint code
npm run lint
```

---

## 🔐 Security & Best Practices

✅ **Implemented**:

- Environment variables for sensitive data
- Row-level security on database
- JWT authentication with auto-refresh
- HTTPS-only Supabase connections
- Input validation with Zod schemas
- XSS protection via React's built-in escaping
- CORS configured on Supabase

---

## 📦 Dependencies Breakdown

- **Core**: React 18, React Router 6, TypeScript
- **Styling**: Tailwind CSS, Shadcn/UI (48 components)
- **Forms**: React Hook Form, Zod, @hookform/resolvers
- **Data**: @tanstack/react-query, @supabase/supabase-js
- **Export**: jsPDF, HTML2Canvas
- **UI**: Radix UI (23 primitives), Lucide (icons), Sonner (toasts)
- **Utilities**: date-fns, clsx, tailwind-merge, next-themes

**Total Package Count**: 403 packages  
**Bundle Size**: ~150KB (gzipped)

---

## 🎓 Learning Outcomes

This project demonstrates:

✅ Full-stack development with TypeScript  
✅ Modern React patterns (Hooks, Context, Router)  
✅ Form validation and state management  
✅ PostgreSQL database design with RLS  
✅ Real-time data synchronization  
✅ PDF generation and export  
✅ File upload and storage management  
✅ Authentication and authorization  
✅ Responsive design with Tailwind  
✅ Production deployment on Vercel  
✅ Component library integration (shadcn/ui)  
✅ API integration (Supabase REST + Real-time)

---

## 🤝 Contributing

Contributions welcome! Please feel free to submit PRs or open issues.

---

## 📄 License

This project is open source and available under the MIT License.

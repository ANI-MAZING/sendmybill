# Sendmybill Product Roadmap

This document is the working product and engineering roadmap for Sendmybill.

## Product direction

Sendmybill should become a focused invoicing workflow for freelancers, consultants, agencies, and small service businesses.

The core promise should be:

> Create professional invoices quickly, organize client billing, and follow up reliably.

The product should not try to become a full accounting system during the first release. The initial product should make invoice creation, storage, export, and follow-up excellent. Payment collection and the client portal can be added later as premium workflow extensions.

## Current product baseline

Already available:

- Email/password and Google authentication through Supabase Auth
- Invoice creation and editing
- Dynamic line items
- Tax calculation
- Three invoice templates
- PDF export
- Client CRUD and client reuse during invoice creation
- Company profile, logo, signature, and bank details
- Multiple currencies
- Draft, pending, and paid status labels
- Supabase PostgreSQL persistence with row-level security
- Light and dark themes

The current implementation is a good single-user MVP foundation. It is not yet a complete SaaS because it does not send invoices, automate follow-up, collect payments, or provide a client-facing workflow.

## Product principles

- Keep the first version simple and fast.
- Optimize for getting an invoice created and sent in under two minutes.
- Use automation to create recurring value.
- Make the invoice the source of truth for all related events.
- Keep financial records auditable and immutable after sending.
- Prefer a small number of dependable workflows over many shallow features.
- Defer accounting, expenses, payroll, and complex tax filing until there is validated demand.

---

## Phase 0 — Stabilize the foundation

Priority: Required before public launch

### Product and UX

- Rename all remaining `InvoiceFlow` references to `Sendmybill`.
- Improve the landing page with a clear audience, product promise, screenshots, and a focused call to action.
- Add a first-run onboarding flow:
  - Name
  - Business or personal billing mode
  - Country and default currency
  - Company details
  - Default payment terms
  - First client or sample invoice
- Add an invoice numbering preference, such as `INV-0001` with configurable prefix and starting number.
- Add a proper empty dashboard with a guided first invoice action.
- Add consistent loading, error, success, and retry states.
- Add a confirmation dialog before deleting invoices and clients instead of relying on browser `confirm()`.
- Add a friendly not-found and unauthorized experience for direct URL access.

### Authentication and authorization

- Create a shared `ProtectedRoute` component for all dashboard routes.
- Protect:
  - `/dashboard`
  - `/dashboard/create`
  - `/dashboard/edit/:id`
  - `/dashboard/clients`
  - `/dashboard/settings`
- Add password reset and email verification flows.
- Handle expired sessions consistently.
- Show useful authentication errors without exposing internal Supabase errors.
- Keep Supabase RLS as the final authorization boundary; client-side route protection is only a UX layer.

### Invoice correctness

- Add a Zod schema for invoice creation and editing.
- Validate at minimum:
  - Invoice number
  - Client name
  - Client email
  - Issue date
  - Due date
  - At least one non-empty line item
  - Positive quantity
  - Non-negative rate
  - Tax range
  - Supported currency
- Display field-level validation errors instead of only showing a generic toast.
- Recalculate totals from line items rather than trusting a submitted total.
- Add server-side or database validation for financial values.
- Add a database constraint for allowed statuses.
- Add a unique invoice-number rule per user.
- Prevent due dates earlier than issue dates unless explicitly allowed.
- Decide whether clients may have an empty email. The current database requires `client_email`, while the invoice form does not require it.

### Database and migration cleanup

- Add a checked-in migration for the `currency` column if it was added manually. The current initial invoice migration does not define it, while the application expects it.
- Regenerate Supabase types after every schema change.
- Add indexes for:
  - `invoices.user_id`
  - `invoices.user_id, created_at`
  - `invoices.user_id, status`
  - `invoices.user_id, due_date`
  - `clients.user_id, client_name`
- Add `CHECK` constraints for status, tax rate, quantity, and monetary values.
- Add an invoice snapshot of seller information so editing a profile later does not change already-issued invoices.
- Prefer integer minor units for money calculations where practical, or centralize decimal-safe money handling.
- Add `updated_at` triggers consistently to every mutable table.
- Document and test the complete schema from a fresh Supabase project.

### Storage and security

- Validate uploaded file type and size for logos and signatures.
- Use private storage with signed URLs where public access is not required.
- Delete replaced and removed assets to prevent orphaned files.
- Avoid storing sensitive bank information unless it is necessary for the product.
- Add basic abuse protection to authentication and future public invoice endpoints.
- Never place email provider or payment provider secrets in the frontend.

### Code quality and delivery

- Make `npm run lint` pass with zero errors.
- Remove unnecessary `any` usage and define shared domain types.
- Fix React hook dependency warnings.
- Add a test setup and at least unit tests for:
  - Invoice totals
  - Tax calculations
  - Currency formatting
  - Invoice validation
  - Status transitions
- Add component or end-to-end tests for creating, editing, and deleting an invoice.
- Add CI to run type checking, linting, tests, and production build on every pull request.
- Add an explicit `typecheck` script.
- Update stale Browserslist data during dependency maintenance.
- Add route-level lazy loading to reduce the current large initial JavaScript bundle.
- Remove or implement unused React Query claims. Either use React Query properly or remove the dependency and documentation references.

### Definition of done

- A new user can sign up, complete onboarding, create a valid invoice, edit it, export it, and find it again after refreshing.
- A user cannot access another user's data.
- A fresh database can be created entirely from checked-in migrations.
- Lint, type checking, tests, and production build pass in CI.

---

## Phase 1 — V1 launch: dependable invoice management

Priority: Required for the first real product launch

### Invoice management

- Create, edit, duplicate, archive, and delete invoices.
- Add an invoice detail page instead of making the edit screen the only detail view.
- Add a duplicate invoice action for repeat work.
- Add invoice filters for:
  - Draft
  - Pending
  - Paid
  - Overdue
  - Archived
- Automatically calculate overdue status from due date and payment state.
- Add bulk export and CSV export.
- Add a print-friendly invoice view.
- Support notes, payment terms, late-fee notes, and footer text.
- Allow default tax rate, default currency, and default due-date period in settings.
- Preserve invoice values as a snapshot when an invoice is created.

### Client management

- Search, sort, and filter clients.
- Add client notes and internal tags.
- Show client invoice history and outstanding amount.
- Show last invoice date and last payment date.
- Add a “Create invoice for this client” action.
- Add CSV import and export.
- Prevent accidental duplicate clients by warning on matching email addresses.

### Dashboard

- Replace the invoice-only home screen with a useful summary:
  - Outstanding amount
  - Overdue amount
  - Paid this month
  - Draft invoice value
  - Number of active clients
- Add upcoming due dates.
- Add recent invoice activity.
- Add a simple monthly invoice and payment chart once payment data exists.

### Templates and branding

- Add a reusable company invoice profile.
- Add configurable accent color and typography choices.
- Add reusable invoice presets for common services.
- Add better long-invoice PDF behavior, including multi-page output.
- Add a PDF preview that matches the exported PDF more closely.
- Keep template-specific styling separate from invoice data.

### V1 launch definition

V1 is ready when users can reliably:

```text
Set up business details
    -> Add or select a client
    -> Create a professional invoice
    -> Save, edit, duplicate, and export it
    -> Track draft, pending, paid, and overdue state
    -> Review outstanding work from the dashboard
```

V1 does not need payment collection or a client portal.

---

## Phase 2 — Automation and repeat usage

Priority: High-value additions after V1 validation

### Invoice email sending

- Send an invoice from the application.
- Generate a branded email containing:
  - Client name
  - Invoice number
  - Amount due
  - Due date
  - Secure invoice link
  - PDF attachment
- Add resend capability.
- Add email delivery status.
- Add an email activity timeline per invoice.
- Add configurable sender name, reply-to email, and email footer.
- Send email through a server-side service or Supabase Edge Function.

### Public invoice links

- Create a secure, non-guessable public token for each sent invoice.
- Add a read-only public invoice page.
- Allow the client to view and download the invoice without creating an account.
- Track:
  - Sent
  - Delivered
  - Viewed
  - Downloaded
  - Reminder sent
- Allow the owner to revoke a public link.
- Never expose the internal invoice ID as the public access credential.

### Automated reminders

- Add reminder rules:
  - Before due date
  - On due date
  - After due date
- Allow custom reminder copy.
- Allow reminders to be paused per invoice.
- Add a reminder history.
- Add a daily scheduled job or Supabase scheduled function.
- Make reminders idempotent so a job cannot send duplicates.

### Invoice activity and audit trail

- Add an `invoice_events` table.
- Record status changes and user actions.
- Show an activity timeline on the invoice detail page.
- Record who performed actions once teams are supported.
- Keep sent invoice versions immutable or create explicit revisions.

### Recurring invoices

- Add weekly, monthly, quarterly, and yearly schedules.
- Generate future invoices automatically.
- Allow automatic email sending for generated invoices.
- Allow pausing, editing, and cancelling schedules.
- Keep a history of generated invoices.

---

## Phase 3 — Advanced invoice builder and quotes

Priority: Differentiating feature set; more complex than the V1 workflow

### Block-based invoice builder

Add a visual invoice builder inspired by Framer or Elementor, but optimized for documents rather than websites.

#### Initial block types

- Company logo
- Company details
- Client details
- Invoice metadata
- Line-item table
- Subtotal and tax summary
- Payment instructions
- Notes and terms
- Signature
- Divider
- Spacer
- Text block
- Image block
- Footer

#### Builder capabilities

- Drag and drop blocks.
- Add, remove, duplicate, and reorder blocks.
- Configure block-level visibility.
- Configure spacing, alignment, colors, and typography.
- Save reusable templates.
- Preview desktop, tablet, and print/PDF layout.
- Provide safe defaults so users cannot create unusable PDFs.
- Support responsive behavior separately from print behavior.
- Add undo and redo.
- Autosave builder drafts.
- Store the layout as versioned JSON with a stable schema.

#### Builder architecture

- Keep invoice data separate from layout data.
- Create a block registry with:
  - Block type
  - Configuration schema
  - Editor component
  - Preview component
  - PDF rendering behavior
- Validate layout JSON before saving.
- Version layout schemas so future changes do not break old invoices.
- Render the same layout model in the browser preview and server-side PDF renderer where possible.
- Start with a constrained canvas rather than a completely free-form design tool.

### Quotes and estimates

- Create estimates using the same line-item system as invoices.
- Add estimate statuses:
  - Draft
  - Sent
  - Viewed
  - Accepted
  - Rejected
  - Expired
- Add estimate expiry dates.
- Add accept/reject actions on the public estimate page.
- Convert an accepted estimate into an invoice.
- Preserve the relationship between estimate and invoice.
- Add version history for changed estimates.

### Quote-to-invoice workflow

```text
Create estimate
    -> Send estimate link
    -> Client accepts
    -> Convert to invoice
    -> Send invoice
    -> Follow up
```

This should be an add-on workflow, not a blocker for the initial launch.

---

## Phase 4 — Payments and client portal

Priority: High-value premium add-on after the invoicing workflow is proven

Payment collection and the client portal should be treated as an extension of Sendmybill, not a requirement for the first release.

### Online payments

- Add a “Pay invoice” action to the public invoice page.
- Start with one payment provider appropriate to the primary market.
- Add payment states:
  - Pending
  - Succeeded
  - Failed
  - Refunded
  - Partially paid
- Process payment confirmation through webhooks.
- Never mark an invoice paid based only on a frontend redirect.
- Support partial payments.
- Add payment receipts.
- Store provider transaction IDs and reconciliation metadata.
- Add refunds or payment reversal handling.
- Add a payment history per invoice and client.

### Client portal

- Allow a client to access their invoices through a secure magic link or account.
- Show:
  - Outstanding invoices
  - Paid invoices
  - Overdue invoices
  - Estimates
  - Receipts
- Allow clients to:
  - Download invoices
  - Pay invoices
  - Accept estimates
  - Update billing details
  - Contact the business
- Keep client accounts separate from internal business users.
- Add explicit consent and privacy controls for client communications.

### Portal architecture

- Introduce a `client_contacts` identity model separate from the internal `clients` record.
- Use scoped access tokens or authenticated client accounts.
- Never expose all client data through a public query.
- Add portal-specific RLS policies.
- Add rate limits and token revocation.
- Add audit events for client actions.

---

## Phase 5 — SaaS monetization and collaboration

Priority: Required when user activity justifies paid plans

### Subscriptions and limits

- Add subscription plans.
- Add free-plan usage limits.
- Add paid plan upgrades and cancellations.
- Add billing portal access.
- Handle failed subscription payments.
- Enforce limits server-side, not only in the UI.
- Add usage metrics for invoices, clients, reminders, and storage.

### Workspaces and teams

- Introduce workspaces so a user can manage one or more businesses.
- Add workspace membership and roles:
  - Owner
  - Admin
  - Member
  - Accountant or viewer
- Scope all invoices, clients, settings, templates, and events to a workspace.
- Add invitations and member removal.
- Add an audit log for team actions.

### Integrations

- CSV import/export.
- Accounting integrations.
- Calendar integration for due dates.
- Cloud storage export.
- API keys and webhooks for paid plans.
- Zapier or similar automation only after the core API is stable.

---

## Phase 6 — Optional expansion

Priority: Only after strong product-market evidence

- Expense tracking.
- Profit and loss reporting.
- Tax/GST/VAT reporting support.
- Purchase orders.
- Time tracking.
- Project budgets.
- Multi-business consolidated reporting.
- Mobile application or installable PWA.
- Industry-specific invoice templates.
- OCR invoice import.
- Accounting-grade reconciliation.

These features can substantially expand scope and should not be added before the invoice workflow, reminders, and retention metrics are working well.

---

## Recommended data model evolution

### Existing core tables

- `profiles`
- `invoices`
- `clients`

### Add during Phase 1 or 2

- `invoice_events`
- `invoice_revisions`
- `email_deliveries`
- `reminder_rules`
- `recurring_invoice_schedules`
- `public_invoice_tokens`

### Add during Phase 3

- `quotes`
- `quote_revisions`
- `invoice_templates`
- `template_versions`

### Add during Phase 4

- `payments`
- `payment_events`
- `client_contacts`
- `client_portal_sessions`

### Add during Phase 5

- `workspaces`
- `workspace_members`
- `subscriptions`
- `subscription_events`
- `usage_records`
- `audit_logs`

---

## Recommended technical architecture

### Keep the current stack for V1

The current React, Vite, TypeScript, Supabase, and Tailwind stack is scalable enough for V1 and likely well beyond it. The main limitations are architectural discipline and missing backend workflows, not React or Vite.

Prioritize:

- Shared domain types.
- A service layer for Supabase operations.
- React Query for server-state caching if it remains in the dependency tree.
- Zod schemas shared between client and server boundaries where possible.
- Supabase Edge Functions for email, reminders, payment webhooks, and protected business logic.
- Database constraints and RLS.
- A server-side PDF strategy when invoices become longer or more customizable.
- Route-level lazy loading.
- Automated tests and CI.

### Should the project move to Next.js?

Not immediately. Moving now would create migration work without solving the most urgent product problems.

The current stack is a good fit when:

- The authenticated dashboard is the main product.
- Supabase is the backend.
- Most screens are interactive client-side application screens.
- Vercel or another static/SPA-friendly host is sufficient.
- Public marketing SEO is not the primary growth channel.

Next.js becomes more attractive when:

- SEO-driven marketing pages are important.
- Public invoice and estimate pages need server rendering or metadata.
- Server-side PDF generation becomes central.
- You need many server-side API routes.
- You want server actions, middleware, image optimization, or tighter frontend/backend co-location.
- The application grows into a larger multi-tenant product with complex server workflows.

Recommended decision:

1. Keep the current Vite app for Phase 0 and Phase 1.
2. Add Supabase Edge Functions for server-side workflows.
3. Build public invoice pages as a carefully protected route within the current app first.
4. Re-evaluate Next.js after validating email sending, reminders, and public invoice traffic.
5. If SEO and public pages become important, either migrate deliberately or use a separate Next.js marketing/public-web application while keeping the dashboard stable.

Do not migrate frameworks merely to make the project feel more production-ready. Fix validation, data integrity, route protection, migrations, testing, and backend workflows first.

---

## Suggested launch metrics

Track these from the first release:

- Signup to first invoice created.
- Time to create first invoice.
- Percentage of users who create a second invoice.
- Invoices created per active user.
- Percentage of invoices exported.
- Percentage of invoices sent once email is available.
- Reminder engagement.
- Paid invoices once payments are available.
- Weekly active businesses.
- Client repeat rate.
- Free-to-paid conversion.

The most important early signal is whether users return to create invoices repeatedly. The most important later signal is whether Sendmybill helps them receive payment faster.


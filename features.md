# Sendmybill Product Roadmap

This document is the working product and engineering roadmap for Sendmybill.

## Roadmap tracking convention

- Every top-level deliverable has a stable phase-scoped ID in the form `[P{phase}-{serial}]`.
- Nested bullets are requirements, options, or acceptance criteria for their parent deliverable.
- IDs should not be renumbered after implementation starts; new work should receive the next available ID in its phase.
- Completed deliverables and their completed acceptance criteria are shown with strikethrough.

## Product direction

Sendmybill should become a focused client, project, billing, and cash-tracking workspace for freelancers, consultants, agencies, and small service businesses.

The core promise should be:

> Manage clients and projects, create professional billing documents, automate recurring invoices, and understand money coming in and going out from one dashboard.

The product should not try to become a full accounting system during the first releases. It should provide an operational view of projects, invoices, manually recorded payments, and business outgoings without claiming to replace bookkeeping, tax filing, or bank reconciliation.

Online payment collection is intentionally deferred. Before a payment gateway exists, users should be able to record incoming payments manually, allocate them to invoices, record expenses and other outgoings, and see accurate outstanding balances and cash-flow summaries.

The core operating model should be:

```text
Client
  -> Project (fixed-price, hourly, milestone, or retainer)
      -> Invoice, proforma invoice, expense, time, and activity
          -> Manual incoming payment or outgoing transaction
              -> Dashboard and project financial summary
```

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
- Make the project the organizing context for client work, billing documents, time, expenses, and profitability.
- Keep an invoice, a payment, and an expense as separate auditable records.
- Treat proforma invoices as non-accounting documents until they are converted into final invoices.
- Make every scheduled automation idempotent, observable, pausable, and safe to retry.
- Keep financial records auditable and immutable after sending.
- Prefer a small number of dependable workflows over many shallow features.
- Defer payroll, complex tax filing, bank reconciliation, and accounting-grade reporting until there is validated demand.

---

## Phase 0 — Stabilize the foundation

Priority: Required before public launch

### Product and UX

- [P0-001] ~~Rename all remaining `InvoiceFlow` references to `Sendmybill`.~~
- [P0-002] ~~Improve the landing page with a clear audience, product promise, screenshots, and a focused call to action.~~
- [P0-003] ~~Add a first-run onboarding flow:~~
  - ~~Name~~
  - ~~Business or personal billing mode~~
  - ~~Country and default currency~~
  - ~~Company details~~
  - ~~Default payment terms~~
  - ~~First client or sample invoice~~
- [P0-004] ~~Add an invoice numbering preference, such as `INV-0001` with configurable prefix and starting number.~~
- [P0-005] ~~Add a proper empty dashboard with a guided first invoice action.~~
- [P0-006] Add consistent loading, error, success, and retry states.
- [P0-007] ~~Add a confirmation dialog before deleting invoices and clients instead of relying on browser `confirm()`.~~
- [P0-008] ~~Add a friendly not-found and unauthorized experience for direct URL access.~~

### Authentication and authorization

- [P0-009] ~~Create a shared `ProtectedRoute` component for all dashboard routes.~~
- [P0-010] ~~Protect:~~
  - ~~/dashboard~~
  - ~~/dashboard/create~~
  - ~~/dashboard/edit/:id~~
  - ~~/dashboard/clients~~
  - ~~/dashboard/settings~~
- [P0-011] ~~Add password reset and email verification flows.~~
- [P0-012] ~~Handle expired sessions consistently.~~
- [P0-013] ~~Show useful authentication errors without exposing internal Supabase errors.~~
- [P0-014] ~~Keep Supabase RLS as the final authorization boundary; client-side route protection is only a UX layer.~~

### Invoice correctness

- [P0-015] ~~Add a Zod schema for invoice creation and editing.~~
- [P0-016] ~~Validate at minimum:~~
  - ~~Invoice number~~
  - ~~Client name~~
  - ~~Client email~~
  - ~~Issue date~~
  - ~~Due date~~
  - ~~At least one non-empty line item~~
  - ~~Positive quantity~~
  - ~~Non-negative rate~~
  - ~~Tax range~~
  - ~~Supported currency~~
- [P0-017] ~~Display field-level validation errors instead of only showing a generic toast.~~
- [P0-018] ~~Recalculate totals from line items rather than trusting a submitted total.~~
- [P0-019] ~~Add server-side or database validation for financial values.~~
- [P0-020] ~~Add a database constraint for allowed statuses.~~
- [P0-021] ~~Add a unique invoice-number rule per user.~~
- [P0-022] ~~Prevent due dates earlier than issue dates unless explicitly allowed.~~
- [P0-023] ~~Decide whether clients may have an empty email. The current database requires `client_email`, while the invoice form does not require it.~~ (Decision: client email is required in both the UI and database.)

### Database and migration cleanup

- [P0-024] ~~Add a checked-in migration for the `currency` column if it was added manually. The current initial invoice migration does not define it, while the application expects it.~~
- [P0-025] Regenerate Supabase types after every schema change.
- [P0-026] ~~Add indexes for:~~
  - ~~invoices.user_id~~
  - ~~invoices.user_id, created_at~~
  - ~~invoices.user_id, status~~
  - ~~invoices.user_id, due_date~~
  - ~~clients.user_id, client_name~~
- [P0-027] ~~Add `CHECK` constraints for status, tax rate, quantity, and monetary values.~~
- [P0-028] ~~Add an invoice snapshot of seller information so editing a profile later does not change already-issued invoices.~~
- [P0-029] ~~Prefer integer minor units for money calculations where practical, or centralize decimal-safe money handling.~~
- [P0-030] ~~Add `updated_at` triggers consistently to every mutable table.~~
- [P0-031] Document and test the complete schema from a fresh Supabase project.

### Storage and security

- [P0-032] ~~Validate uploaded file type and size for logos and signatures.~~
- [P0-033] ~~Use private storage with signed URLs where public access is not required.~~
- [P0-034] ~~Delete replaced and removed assets to prevent orphaned files.~~
- [P0-035] ~~Avoid storing sensitive bank information unless it is necessary for the product.~~ (Decision: bank fields remain optional and are only intended for payment instructions displayed on invoices.)
- [P0-036] Add basic abuse protection to authentication and future public invoice endpoints.
- [P0-037] ~~Never place email provider or payment provider secrets in the frontend.~~

### Code quality and delivery

- [P0-038] ~~Make `npm run lint` pass with zero errors.~~
- [P0-039] ~~Remove unnecessary `any` usage and define shared domain types.~~
- [P0-040] ~~Fix React hook dependency warnings.~~
- [P0-041] ~~Add a test setup and at least unit tests for:~~
  - ~~Invoice totals~~
  - ~~Tax calculations~~
  - ~~Currency formatting~~
  - ~~Invoice validation~~
  - ~~Status transitions~~
- [P0-042] Add component or end-to-end tests for creating, editing, and deleting an invoice.
- [P0-043] ~~Add CI to run type checking, linting, tests, and production build on every pull request.~~
- [P0-044] ~~Add an explicit `typecheck` script.~~
- [P0-045] ~~Update stale Browserslist data during dependency maintenance.~~
- [P0-046] ~~Add route-level lazy loading to reduce the current large initial JavaScript bundle.~~
- [P0-047] ~~Remove or implement unused React Query claims. Either use React Query properly or remove the dependency and documentation references.~~

### Definition of done

- [P0-048] A new user can sign up, complete onboarding, create a valid invoice, edit it, export it, and find it again after refreshing.
- [P0-049] A user cannot access another user's data.
- [P0-050] A fresh database can be created entirely from checked-in migrations.
- [P0-051] Lint, type checking, tests, and production build pass in CI.

---

## Phase 1 — V1 launch: dependable client, project, and billing management

Priority: Required for the first real product launch

### Invoice management

- [P1-001] ~~Create, edit, duplicate, archive, and delete invoices.~~
- [P1-002] ~~Add an invoice detail page instead of making the edit screen the only detail view.~~
- [P1-003] ~~Add a duplicate invoice action for repeat work.~~
- [P1-004] ~~Add invoice filters for:~~
  - ~~Draft~~
  - ~~Pending~~
  - ~~Paid~~
  - ~~Overdue~~
  - ~~Archived~~
- [P1-005] ~~Automatically calculate overdue status from due date and payment state.~~
- [P1-006] ~~Add bulk export and CSV export.~~
- [P1-007] ~~Add a print-friendly invoice view.~~
- [P1-008] ~~Support notes, payment terms, late-fee notes, and footer text.~~
- [P1-009] ~~Allow default tax rate, default currency, and default due-date period in settings.~~
- [P1-010] ~~Preserve invoice values as a snapshot when an invoice is created.~~

### Client management

- [P1-011] ~~Search, sort, and filter clients.~~
- [P1-012] ~~Add client notes and internal tags.~~
- [P1-013] ~~Show client invoice history and outstanding amount.~~
- [P1-014] ~~Show last invoice date and last payment date.~~
- [P1-015] ~~Add a “Create invoice for this client” action.~~
- [P1-016] ~~Add CSV import and export.~~
- [P1-017] ~~Prevent accidental duplicate clients by warning on matching email addresses.~~

### Project management

- [P1-018] ~~Create a project under a client.~~
- [P1-019] ~~Support billing models:~~
  - ~~Fixed price~~
  - ~~Hourly~~
  - ~~Milestone based~~
  - ~~Retainer~~
- [P1-020] ~~Add project statuses:~~
  - ~~Planned~~
  - ~~Active~~
  - ~~On hold~~
  - ~~Completed~~
  - ~~Cancelled~~
- [P1-021] ~~Store project name, description, start date, optional end date, currency, budget, billing rate, and internal notes.~~
- [P1-022] ~~Add project milestones with due dates, value, status, and optional billing trigger.~~
- [P1-023] ~~Add lightweight tasks and deliverables without trying to replace a full engineering issue tracker.~~
- [P1-024] ~~Record manual or timer-based time entries with date, duration, member, billable state, rate, and notes.~~
- [P1-025] ~~Convert selected unbilled time entries into invoice line items while preventing duplicate billing.~~
- [P1-026] ~~Link invoices, proforma invoices, payments, expenses, files, and activity to a project.~~
- [P1-027] ~~Add “Create invoice” and “Create proforma invoice” actions from a project.~~
- [P1-028] ~~Show a project financial summary:~~
  - ~~Contract or retainer value~~
  - ~~Invoiced amount~~
  - ~~Amount received~~
  - ~~Outstanding amount~~
  - ~~Recorded expenses~~
  - ~~Estimated margin~~
- [P1-029] ~~Show project activity and upcoming milestones.~~
- [P1-030] ~~Preserve historical project billing values when project defaults change.~~

### Proforma invoices

- [P1-031] ~~Create a proforma invoice using the same client, project, line-item, tax, template, and PDF systems as a final invoice.~~
- [P1-032] ~~Give proforma invoices a separate number sequence and a clear `PROFORMA` label.~~
- [P1-033] ~~Add proforma statuses:~~
  - ~~Draft~~
  - ~~Sent~~
  - ~~Viewed~~
  - ~~Accepted~~
  - ~~Rejected~~
  - ~~Expired~~
  - ~~Converted~~
- [P1-034] ~~Add an optional validity or expiry date.~~
- [P1-035] ~~Do not include proforma values in revenue, outstanding invoice, or overdue totals.~~
- [P1-036] ~~Convert a proforma invoice into a final invoice without retyping line items.~~
- [P1-037] ~~Preserve the relationship and snapshots between the proforma and final invoice.~~
- [P1-038] ~~Allow a proforma invoice to use the same secure public-link and email-delivery workflow as a final invoice once Phase 2 automation is enabled.~~

### Manual payments, income, and outgoings

- [P1-039] ~~Record incoming payments manually without a payment gateway.~~
- [P1-040] ~~Capture payment date, amount, currency, method, reference, payer, notes, and optional attachment.~~
- [P1-041] ~~Allocate one payment fully or partially across one or more invoices.~~
- [P1-042] ~~Support partial, over, and unallocated payments without silently changing invoice totals.~~
- [P1-043] ~~Calculate invoice balance from payment allocations instead of a manually selected paid status.~~
- [P1-044] ~~Record business outgoings and expenses with date, amount, category, vendor, tax, project, notes, and optional receipt.~~
- [P1-045] ~~Support recurring expense records as a later extension without confusing them with recurring invoices.~~
- [P1-046] ~~Add an income and outgoing ledger with search, filters, and CSV export.~~
- [P1-047] ~~Keep edits and deletions auditable.~~
- [P1-048] ~~Do not present the ledger as bank reconciliation or accounting-grade books.~~

### Dashboard

- [P1-049] ~~Replace the invoice-only home screen with a useful summary:~~
  - ~~Outstanding amount~~
  - ~~Overdue amount~~
  - ~~Paid this month~~
  - ~~Draft invoice value~~
  - ~~Number of active clients~~
- [P1-050] ~~Add project summaries:~~
  - ~~Active projects~~
  - ~~Retainers due for billing~~
  - ~~Projects over budget~~
  - ~~Upcoming milestones~~
- [P1-051] ~~Add cash summaries based on manual records:~~
  - ~~Income this month~~
  - ~~Outgoings this month~~
  - ~~Net cash flow~~
  - ~~Unallocated incoming payments~~
- [P1-052] ~~Add upcoming due dates.~~
- [P1-053] ~~Add recent invoice activity.~~
- [P1-054] ~~Add a simple monthly invoice and payment chart once payment data exists.~~

### Templates and branding

- [P1-055] ~~Add a reusable company invoice profile.~~
- [P1-056] ~~Add configurable accent color and typography choices.~~
- [P1-057] ~~Add reusable invoice presets for common services.~~
- [P1-058] ~~Add better long-invoice PDF behavior, including multi-page output.~~
- [P1-059] ~~Add a PDF preview that matches the exported PDF more closely.~~
- [P1-060] ~~Keep template-specific styling separate from invoice data.~~
- [P1-061] ~~Keep pre-migration invoices visible with a legacy-schema fallback while Phase 1 migrations are pending.~~
- [P1-062] ~~Reconcile the live Supabase migration history and deploy the complete Phase 0 and Phase 1 schema without removing legacy invoices.~~

### V1 launch definition

V1 is ready when users can reliably:

```text
Set up business details
    -> Add or select a client
    -> Create a project or retainer
    -> Create an invoice or proforma invoice
    -> Save, edit, duplicate, and export it
    -> Record incoming payments and project expenses manually
    -> Track outstanding balances, cash movement, and project health
    -> Review the business from one dashboard
```

V1 does not need online payment collection, bank feeds, bookkeeping, or a full client portal.

---

## Phase 2 — Automation and repeat usage

Priority: High-value additions after V1 validation

### Invoice email sending

- [P2-001] Send an invoice from the application.
- [P2-002] Generate a branded email containing:
  - Client name
  - Invoice number
  - Amount due
  - Due date
  - Secure invoice link
  - PDF attachment
- [P2-003] Add resend capability.
- [P2-004] Add email delivery status.
- [P2-005] Add an email activity timeline per invoice.
- [P2-006] Add configurable sender name, reply-to email, and email footer.
- [P2-007] Send email through a server-side service or Supabase Edge Function.

### Public invoice links

- [P2-008] Create a secure, non-guessable public token for each shared invoice or proforma invoice.
- [P2-009] Store only a hash of the public token where practical.
- [P2-010] Add a read-only public billing-document page with the business’s branding.
- [P2-011] Allow the client to view and download the invoice or proforma invoice without creating an account.
- [P2-012] Show the current balance and manually recorded payment state without exposing internal notes or unrelated project data.
- [P2-013] Track:
  - Sent
  - Delivered
  - Viewed
  - Downloaded
  - Reminder sent
- [P2-014] Allow the owner to revoke a public link.
- [P2-015] Allow an optional expiry date and link regeneration.
- [P2-016] Add rate limiting and abuse monitoring to public-link access.
- [P2-017] Never expose the internal invoice ID as the public access credential.

### Automated reminders

- [P2-018] Add reminder rules:
  - Before due date
  - On due date
  - After due date
- [P2-019] Allow custom reminder copy.
- [P2-020] Allow reminders to be paused per invoice.
- [P2-021] Add a reminder history.
- [P2-022] Add a daily scheduled job or Supabase scheduled function.
- [P2-023] Make reminders idempotent so a job cannot send duplicates.

### Invoice activity and audit trail

- [P2-024] Add an `invoice_events` table.
- [P2-025] Record status changes and user actions.
- [P2-026] Show an activity timeline on the invoice detail page.
- [P2-027] Record who performed actions once teams are supported.
- [P2-028] Keep sent invoice versions immutable or create explicit revisions.

### Recurring invoices

- [P2-029] Let a retainer project own one or more recurring invoice schedules.
- [P2-030] Provide a calendar-style schedule builder inspired by recurring calendar events.
- [P2-031] Support frequencies:
  - Weekly
  - Every two weeks
  - Monthly
  - Quarterly
  - Yearly
  - Custom interval, such as every `N` weeks or months
- [P2-032] Support recurrence details:
  - Start date
  - Optional end date or occurrence count
  - Time zone
  - Day of week
  - Day of month, with explicit end-of-month behavior
  - Generation time
  - Issue-date and due-date offsets
- [P2-033] Preview the next scheduled occurrences before saving.
- [P2-034] Create a reusable invoice template for each schedule instead of copying a previously sent invoice blindly.
- [P2-035] Choose whether each generated invoice remains a draft or is sent automatically.
- [P2-036] Generate future invoices through a server-side scheduled job or Supabase scheduled function.
- [P2-037] Allow automatic email sending and public-link creation for generated invoices.
- [P2-038] Allow pausing, resuming, editing, skipping the next occurrence, running now, and cancelling schedules.
- [P2-039] Define whether schedule edits affect only future occurrences or regenerate a selected draft.
- [P2-040] Store `next_run_at`, `last_run_at`, schedule time zone, and last execution result.
- [P2-041] Guarantee one generated invoice per schedule occurrence with a database uniqueness rule.
- [P2-042] Make generation and delivery separately idempotent so retries never create or send duplicates.
- [P2-043] Keep a history of generated invoices and automation events on the project and schedule.
- [P2-044] Notify the owner when generation or delivery repeatedly fails.

### Automation operations

- [P2-045] Add an automation run log with queued, running, succeeded, failed, skipped, and cancelled states.
- [P2-046] Separate invoice generation from email delivery so either step can be retried safely.
- [P2-047] Add an outbox or job table for reliable background delivery.
- [P2-048] Use deterministic idempotency keys for schedule occurrence, document generation, public-link creation, and email delivery.
- [P2-049] Add retry policies with backoff and a terminal failure state.
- [P2-050] Show upcoming automations in the dashboard.
- [P2-051] Allow workspace-wide automation pause for incidents or maintenance.

---

## Phase 3 — Advanced invoice builder and quotes

Priority: Differentiating feature set; more complex than the V1 workflow

### Block-based invoice builder

Add a visual invoice builder inspired by Framer or Elementor, but optimized for documents rather than websites.

#### Initial block types

- [P3-001] Company logo
- [P3-002] Company details
- [P3-003] Client details
- [P3-004] Invoice metadata
- [P3-005] Line-item table
- [P3-006] Subtotal and tax summary
- [P3-007] Payment instructions
- [P3-008] Notes and terms
- [P3-009] Signature
- [P3-010] Divider
- [P3-011] Spacer
- [P3-012] Text block
- [P3-013] Image block
- [P3-014] Footer

#### Builder capabilities

- [P3-015] Drag and drop blocks.
- [P3-016] Add, remove, duplicate, and reorder blocks.
- [P3-017] Configure block-level visibility.
- [P3-018] Configure spacing, alignment, colors, and typography.
- [P3-019] Save reusable templates.
- [P3-020] Preview desktop, tablet, and print/PDF layout.
- [P3-021] Provide safe defaults so users cannot create unusable PDFs.
- [P3-022] Support responsive behavior separately from print behavior.
- [P3-023] Add undo and redo.
- [P3-024] Autosave builder drafts.
- [P3-025] Store the layout as versioned JSON with a stable schema.

#### Builder architecture

- [P3-026] Keep invoice data separate from layout data.
- [P3-027] Create a block registry with:
  - Block type
  - Configuration schema
  - Editor component
  - Preview component
  - PDF rendering behavior
- [P3-028] Validate layout JSON before saving.
- [P3-029] Version layout schemas so future changes do not break old invoices.
- [P3-030] Render the same layout model in the browser preview and server-side PDF renderer where possible.
- [P3-031] Start with a constrained canvas rather than a completely free-form design tool.

### Quotes and estimates

- [P3-032] Create estimates using the same line-item system as invoices.
- [P3-033] Add estimate statuses:
  - Draft
  - Sent
  - Viewed
  - Accepted
  - Rejected
  - Expired
- [P3-034] Add estimate expiry dates.
- [P3-035] Add accept/reject actions on the public estimate page.
- [P3-036] Convert an accepted estimate into an invoice.
- [P3-037] Preserve the relationship between estimate and invoice.
- [P3-038] Add version history for changed estimates.

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

- [P4-001] Build gateway collection on the existing manual payment and allocation model instead of creating a second invoice-balance system.
- [P4-002] Add a “Pay invoice” action to the public invoice page.
- [P4-003] Start with one payment provider appropriate to the primary market.
- [P4-004] Add payment states:
  - Pending
  - Succeeded
  - Failed
  - Refunded
  - Partially paid
- [P4-005] Process payment confirmation through webhooks.
- [P4-006] Never mark an invoice paid based only on a frontend redirect.
- [P4-007] Support partial payments.
- [P4-008] Add payment receipts.
- [P4-009] Store provider transaction IDs and reconciliation metadata.
- [P4-010] Add refunds or payment reversal handling.
- [P4-011] Add a payment history per invoice, project, and client.
- [P4-012] Allow a gateway payment and a manually recorded payment to coexist in one auditable ledger.

### Client portal

- [P4-013] Allow a client to access their invoices through a secure magic link or account.
- [P4-014] Show:
  - Outstanding invoices
  - Paid invoices
  - Overdue invoices
  - Estimates
  - Receipts
- [P4-015] Allow clients to:
  - Download invoices
  - Pay invoices
  - Accept estimates
  - Update billing details
  - Contact the business
- [P4-016] Keep client accounts separate from internal business users.
- [P4-017] Add explicit consent and privacy controls for client communications.

### Portal architecture

- [P4-018] Introduce a `client_contacts` identity model separate from the internal `clients` record.
- [P4-019] Use scoped access tokens or authenticated client accounts.
- [P4-020] Never expose all client data through a public query.
- [P4-021] Add portal-specific RLS policies.
- [P4-022] Add rate limits and token revocation.
- [P4-023] Add audit events for client actions.

---

## Phase 5 — SaaS monetization and collaboration

Priority: Required when user activity justifies paid plans

### Subscriptions and limits

- [P5-001] Add subscription plans.
- [P5-002] Add free-plan usage limits.
- [P5-003] Add paid plan upgrades and cancellations.
- [P5-004] Add billing portal access.
- [P5-005] Handle failed subscription payments.
- [P5-006] Enforce limits server-side, not only in the UI.
- [P5-007] Add usage metrics for invoices, clients, reminders, and storage.

### Workspaces and teams

- [P5-008] Introduce workspaces so a user can manage one or more businesses.
- [P5-009] Add workspace membership and roles:
  - Owner
  - Admin
  - Member
  - Accountant or viewer
- [P5-010] Scope all invoices, clients, settings, templates, and events to a workspace.
- [P5-011] Add invitations and member removal.
- [P5-012] Add an audit log for team actions.

### Integrations

- [P5-013] CSV import/export.
- [P5-014] Accounting integrations.
- [P5-015] Calendar integration for due dates.
- [P5-016] Cloud storage export.
- [P5-017] API keys and webhooks for paid plans.
- [P5-018] Zapier or similar automation only after the core API is stable.

---

## Phase 6 — Optional expansion

Priority: Only after strong product-market evidence

- [P6-001] Profit and loss reporting.
- [P6-002] Tax/GST/VAT reporting support.
- [P6-003] Purchase orders.
- [P6-004] Multi-business consolidated reporting.
- [P6-005] Mobile application or installable PWA.
- [P6-006] Industry-specific invoice templates.
- [P6-007] OCR invoice import.
- [P6-008] Accounting-grade reconciliation.

These features can substantially expand scope and should not be added before the invoice workflow, reminders, and retention metrics are working well.

---

## Recommended data model evolution

### Existing core tables

- `profiles`
- `invoices`
- `clients`

### Add during Phase 1

- `projects`
- `project_milestones`
- `project_tasks`
- `time_entries`
- `payments`
- `payment_allocations`
- `expenses`
- `expense_categories`
- `attachments`
- `project_events`

Add project and document relationships to existing records:

- `invoices.project_id`
- `invoices.document_type`
- `invoices.converted_from_id`
- `invoices.schedule_id`
- `invoices.schedule_occurrence_at`

### Add during Phase 2

- `invoice_events`
- `invoice_revisions`
- `email_deliveries`
- `email_outbox`
- `reminder_rules`
- `recurring_invoice_schedules`
- `automation_runs`
- `public_invoice_tokens`

### Add during Phase 3

- `quotes`
- `quote_revisions`
- `invoice_templates`
- `template_versions`

### Add during Phase 4

- `payment_provider_accounts`
- `payment_provider_events`
- `refunds`
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
- Keep explicit route-level data loading for now; introduce a query/cache layer only when project and dashboard data complexity justifies it.
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

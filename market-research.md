# SendMyBill — Invoicing & Client Management Market Research

Oct 6, 2026 · @Aniruddha Gharat

## Executive summary

**Position SendMyBill as the simple, trustworthy way for freelancers and small agencies — India first, billing clients worldwide — to send an invoice and get paid.** The big US players (HoneyBook, Wave) don't serve India at all; FreshBooks and Bonsai charge $23–$43/mo with client caps; open-source options are PHP self-host tools, and Crater has been abandoned since 2022.

- **Demand is proven by free generators**: invoice-generator.com and Invoice Simple each draw roughly 2M visits, and the no-signup Invoify repo has 6.4k stars. A free generator page should be SendMyBill's main acquisition channel.
- **People churn over trust, not features**: HoneyBook's 2025 price hike (Starter $19 → $36), Wave's account freezes, Bonsai's payout delays and disappearing invoices.
- **SendMyBill's Phase 1 is already deep** (projects, time, proforma, partial payments, ledger) but it **cannot send, remind or collect yet** — every competitor can. Phase 2 plus payment links is the launch line.
- **Wedge features**: GST + LUT export invoices, UPI QR on invoices, the user's own Stripe/Razorpay connection, WhatsApp delivery and reminders, accountant-ready tax exports.
- **Pricing to test**: free with unlimited clients; Pro at ₹399 / $9 per month gating automation — under Moxie ($12) and Invoice Ninja ($14).

## Market landscape

The market splits into three tiers: accounting suites (Wave, FreshBooks, Zoho), "clientflow" CRMs for creatives (HoneyBook, Bonsai, Moxie), and free invoice generators (Invoice Simple, invoice-generator.com) that win huge SEO traffic but convert little of it into paid accounts. Traffic is a Similarweb estimate for Aug–Sep 2026; treat it as directional.

| Platform | Tier | Traffic (Similarweb) | Entry paid price | Free plan | Main audience |
| --- | --- | --- | --- | --- | --- |
| [Wave](https://www.waveapps.com/pricing) | Accounting | Global rank #6,178; 69% US, 14% CA | Pro $19/mo | Yes — unlimited invoices; cards 2.9% + $0.60 | US/CA micro-business |
| [FreshBooks](https://www.freshbooks.com/pricing) | Accounting | ~2.6M visits / 3 mo; rank #14,044; 77% US | Lite $23/mo (5 billable clients) | No (30-day trial) | Service SMBs, accountants |
| [Zoho Invoice](https://www.zoho.com/us/invoice/pricing/) | Accounting | Part of zoho.com (not separable) | — | Yes — 500 invoices/yr, 3 projects | Global SMB, India strong |
| [HoneyBook](https://www.honeybook.com/pricing) | Clientflow CRM | ~1.7M visits / 3 mo; rank #25,277; 92% US | Starter $29/mo (yearly) | No (30-day trial) | Creatives, event pros |
| [Bonsai](https://www.hellobonsai.com/pricing) | Clientflow CRM | ~327K visits / 3 mo; rank #131,693 | Essentials $25/user/mo (invoicing not in Basic) | No (7-day trial) | Freelancers, agencies |
| [Moxie](https://www.withmoxie.com/pricing) | Clientflow CRM | ~55K visits / 3 mo; down 35% m/m | Starter $12/mo | No (14-day trial) | Solo freelancers |
| [Invoice Simple](https://www.similarweb.com/website/invoicesimple.com/) | Generator + app | ~2M visits/mo; rank #28,949 | Paid app tiers | Limited | Trades, mobile-first |
| [invoice-generator.com](https://www.similarweb.com/website/invoice-generator.com/) | Generator | ~2M visits / 3 mo; 13% India | Free | Yes | One-off senders |
| [Refrens](https://www.refrens.com/pricing) | India GST suite | ~512K visits; 68% India; down 15% m/m | Premium (INR, not public) | 15 documents | Indian freelancers/SMBs |
| [Invoice Ninja (hosted)](https://invoiceninja.com/pricing-plans/) | Open-core | ~116K visits / 3 mo | Pro $14/mo | 5 clients | Tech-savvy SMB, self-hosters |

What the numbers say: generators prove demand for "make an invoice now, no signup" — the top search intent — while paid tools gate core features (client counts, branding removal, reminders) behind $14–$49/mo tiers.

## Open-source projects

Most open-source invoicing is PHP/Laravel, self-host-first and dated in UX; only Midday and Invoify use a modern React/Next.js stack like SendMyBill's. Licences matter: Invoice Ninja (Elastic) and Akaunting (BSL) are not OSI open source, and Midday needs a paid licence for commercial use — so none can simply be forked into a competing SaaS.

| Project | Stars | Licence | Stack | Status | What to learn from it |
| --- | --- | --- | --- | --- | --- |
| [Midday](https://github.com/midday-ai/midday) | ~15.0k | AGPL-3.0 + commercial | Next.js, Supabase, Tauri, Expo | Active | Bank sync + receipt "magic inbox" + AI assistant; same Supabase stack as SendMyBill |
| [Akaunting](https://github.com/akaunting/akaunting) | ~10.1k | BSL | Laravel, Vue | Active | Paid app marketplace as monetisation |
| [Invoice Ninja](https://github.com/invoiceninja/invoiceninja) | ~10.0k | Elastic | Laravel, Flutter/JS | Active (v5.11.x) | Most complete feature set; $40/yr white-label; PEPPOL e-invoicing |
| [IDURAR ERP/CRM](https://github.com/idurar/idurar-erp-crm) | ~8.8k | AGPL-3.0 | MERN, Ant Design | Active | Invoices + quotes + CRM in JS |
| [Crater](https://github.com/crater-invoice-inc/crater) | ~8.4k | AGPL-3.0 | Laravel, Vue, React Native | Unmaintained since v6.0.6 (Mar 2022) ([source](https://selfhosting.sh/apps/crater-finance/)) | Clean UX loved by users; orphaned audience |
| [Invoify](https://github.com/al1abb/invoify) | ~6.4k | MIT | Next.js 15, shadcn, Puppeteer | Active | No-signup generator, 13 templates, 18 languages, local AES-encrypted storage |
| [InvoicePlane](https://github.com/InvoicePlane/InvoicePlane) | ~3.1k | MIT | PHP, CodeIgniter | Volunteer-maintained | Simple quotes → invoices; legacy stack |
| [InvoiceShelf](https://github.com/InvoiceShelf/InvoiceShelf) | ~1.8k | AGPL-3.0 | Laravel, Vite | Active (fork of Crater; 3.x alpha) ([source](https://ideaproof.io/open-source/project/invoiceshelf)) | Multi-company, customer portal |
| [SolidInvoice](https://github.com/SolidInvoice/SolidInvoice) | ~950 | MIT | Symfony 7, API Platform | Active | Hosted at $8/mo — shows the low price floor |

Takeaways for SendMyBill:

- **Invoify's 6.4k stars for a no-login generator** confirm the "try before signup" hook. A public generator page is the cheapest acquisition channel in this market.
- **Crater's abandonment** left ~8k-star worth of users wanting a clean, simple tool without self-hosting pain.
- **Midday** is the closest technical peer; it targets bookkeeping-heavy users, leaving the pure "bill clients and get paid" job less served.
- MIT projects (Invoify, SolidInvoice, InvoicePlane) can be studied or borrowed from legally; AGPL code should not be copied into a closed SaaS.

## Comparative feature matrix

SendMyBill's Phase 1 (projects, time, proforma, manual payments, ledger) already matches paid tiers on depth; it trails every competitor on **delivery and follow-up** — email sending, public links, reminders and recurring invoices. Those are table stakes, not differentiators. ✓ = included, ◐ = partial or higher tier only, ✗ = absent.

| Capability | Wave | FreshBooks | Zoho Invoice | HoneyBook | Bonsai | Moxie | Invoice Ninja | Refrens | SendMyBill today |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Cheapest plan with unlimited clients (USD/mo) | 0 | 70 (Premium) | 0 (500 inv/yr) | 29 (yearly) | 25 | 12 | 14 | Paid (INR) | 0 |
| Email invoice from app | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ |
| Public link / client portal | ◐ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ |
| Automatic reminders | ◐ Pro | ✓ | ✓ | ◐ Essentials | ✓ | ✓ | ◐ Pro | ✓ | ✗ |
| Recurring invoices | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ (planned) |
| Online card payments | ◐ US/CA | ✓ | ✓ | ◐ US/CA | ✓ | ✓ | ✓ | ✓ | ✗ (manual only) |
| Quotes / proforma | ✓ quotes | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ◐ proforma |
| Proposals + e-sign contracts | ✗ | ◐ Plus | ✗ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |
| Projects + time tracking | ✗ | ✓ | ◐ 3 projects | ◐ | ✓ | ✓ | ✓ | ◐ | ✓ |
| Partial payments + allocation | ✓ | ✓ | ✓ | ✓ | ◐ | ◐ | ✓ | ✓ | ✓ |
| Multi-currency | ✓ | ✓ | ✓ | ✗ USD/CAD | ◐ Premium | ✓ | ✓ | ✓ | ✓ |
| India GST, UPI, LUT export invoices | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ◐ | ✓ | ◐ tax calc only |
| EU e-invoicing (Peppol/EN16931) | ✗ | ✗ | ◐ | ✗ | ✗ | ✗ | ◐ Enterprise | ✗ | ✗ |
| Open API | ✗ | ✓ | ✓ | ✗ | ◐ | ◐ Pro | ◐ Pro | ◐ | ✗ |

Prices from each vendor's pricing page (linked in the landscape table); feature cells are from vendor pages and reviews and should be spot-checked before quoting publicly.

## Limitations and user complaints

The complaints repeat across platforms: surprise price hikes, US/Canada-only payments, slow or unreliable invoice delivery, payout delays, and email-only support. Each is a promise SendMyBill can make on its landing page.

| Platform | Top complaints (from reviews) | Rating seen | Opening for SendMyBill |
| --- | --- | --- | --- |
| [HoneyBook](https://agiled.app/blog/honeybook-review) | Feb 2025 hike: Starter $19 → $36/mo, Premium $79 → $129; US/Canada only; card-on-file 3.4% + $0.09; glitches sending contracts; no phone support ([Trustpilot](https://www.trustpilot.com/review/honeybook.com?page=6)) | 4.0/5 (735 Trustpilot) | Global, price-locked plans; reliable send |
| [Bonsai](https://www.trustpilot.com/review/hellobonsai.com?page=2) | 3–4 clicks per invoice download, no bulk download; 7–10 day payment delays; invoices disappearing from pending; slow, "clunky" UI; invoicing locked out of the $15 Basic plan | 4.2/5 (624 Trustpilot) | Fast UI, bulk export (already built), invoicing on every plan |
| [FreshBooks](https://www.business.org/finance/accounting/freshbooks-review/) | 5-client cap on Lite, 50 on Plus; $11/mo per extra user; promo-to-full price jump ($1 → $23, $8.60 → $43) | — | No client caps; flat team pricing |
| [Wave](https://www.merchantmaverick.com/reviews/wave-payments-review/) | PSP model → surprise account freezes; US/CA only; no phone support; free tier now pushes to $19 Pro for reminders; bugs and slow support ([CheckThat](https://checkthat.ai/brands/wave/reviews)) | 2.8/5 aggregate | Use the user's own Stripe/Razorpay account — no held funds |
| [Zoho Invoice](https://www.merchantmaverick.com/reviews/zoho-invoice-review) | 500 invoices/yr cap; only 3 projects; P&L needs Zoho Books upsell; no phone support; dense UI | 4.0/5 reliability | Unlimited projects; simpler UX for solo users |
| [Invoice Ninja](https://www.getapp.co.uk/software/109411/invoice-ninja) | v5 seen as slower and confusing vs v4, migration lost data ([forum](https://forum.invoiceninja.com/t/v5-a-horrible-downgrade-from-v4/8817)); no tax export for quarterly filing; email-only support | 4.7/5 (167 GetApp) | Tax summary export; polished modern UI |
| Crater / InvoiceShelf | Crater unmaintained since Mar 2022, no security patches; InvoiceShelf 3.x still alpha; self-hosting burden | — | Hosted, zero-ops alternative with import |
| Generators (Invoice Simple, invoice-generator.com, Invoify) | No records, no follow-up, no client history; data lost or trapped locally | — | Convert generator users into accounts after first invoice |

Pattern: people do not leave over missing features; they leave over **price shocks, payment holds and lost trust** in delivery.

## Opportunity gaps for SendMyBill

The clearest gap is **freelancers and small agencies outside the US/Canada — India first — who bill clients at home and abroad**. HoneyBook and Wave exclude them, FreshBooks and Bonsai ignore GST, Zoho is complex, and Refrens (the only India player with real traffic) fell 15% month on month.

1. **India + export billing done right.** GST-ready tax invoices, export-of-services invoices with LUT number (zero-rated), INR equivalent on foreign-currency invoices, and a UPI QR code printed on every INR invoice so clients pay with zero gateway fees. Add foreign-remittance tracking (FIRA/e-FIRC reference per payment).
2. **Bring your own payment account.** Connect the user's Stripe or Razorpay account and generate payment links, so funds never sit with SendMyBill. This directly answers Wave's account freezes and Bonsai's 7–10 day delays, and avoids becoming a regulated payment intermediary.
3. **Free no-signup invoice generator as the acquisition funnel.** invoice-generator.com draws ~2M visits per 3 months and Invoify earned 6.4k stars for exactly this. Let anyone make and download an invoice, then offer "save, send and track it" with one-click signup that keeps their draft.
4. **Delivery people can trust.** Branded email with delivery and "viewed" status, a secure public link, and one-tap WhatsApp share (the default channel for Indian clients). Show an activity timeline per invoice — the trust gap behind Bonsai's "disappearing invoices" complaints.
5. **Reminders as the upgrade reason.** Wave, Invoice Ninja and HoneyBook gate reminders behind paid tiers. Make polite, editable reminder sequences (email + WhatsApp template) the core reason to upgrade, with a clear "days to get paid" metric on the dashboard.
6. **Pricing users can trust.** No client caps (vs FreshBooks' 5/50), no per-seat tax for the first collaborator, and a public price-lock promise for early users — a direct answer to HoneyBook's 89% hike.
7. **Accountant-ready exports.** A tax summary and GSTR-1-friendly CSV per month or quarter, plus a read-only accountant/CA invite. Invoice Ninja users explicitly complain that tax data cannot be exported separately.
8. **Switching tools.** CSV import for clients and invoices from FreshBooks, Zoho, Invoice Ninja and Crater/InvoiceShelf. Crater's orphaned users and Invoice Ninja v5 refugees are reachable through self-hosting communities.
9. **Light AI where it saves time.** Create an invoice from a pasted message or email ("bill Acme 12 hours at $40 for September"), suggest line items from project time, and draft reminder copy. Midday has set the expectation; keep it optional and cheap to run.
10. **Later: e-invoicing readiness.** Belgium (Jan 2026), Poland (Feb 2026) and France (Sep 2026) now mandate B2B e-invoicing ([source](https://innovatetax.com/blog/7-countries-set-to-mandate-b2b-e-invoicing-in-2026/)); India's IRP applies only above ₹5 crore turnover ([source](https://www.accountune.com/e-invoicing-compulsory-india-small-business-2026)). Store invoice data in a structured, EN16931-mappable model now so Peppol export is an add-on later, not a rewrite.

What not to build early: payroll, bank reconciliation, inventory and full double-entry books — that is where Wave, Zoho and FreshBooks are strongest and where support costs explode.

## Production launch checklist

Launch when an invoice can be created, **sent, viewed, reminded and paid** without leaving SendMyBill — that is Phase 2 of the roadmap plus a payment link, not Phase 3's block builder. Keep the current React + Vite + Supabase stack; it is the same base Midday runs on.

### Launch scope (must ship)

1. Email sending with delivery + viewed status (server-side via Supabase Edge Function and a transactional provider such as Resend or Postmark).
2. Secure public invoice link with hashed token, revoke and expiry; WhatsApp share button.
3. Reminder sequences (before due, on due, after due) with pause per invoice, idempotent daily job.
4. Recurring invoices for retainers, generated by a scheduled job with one-invoice-per-occurrence uniqueness.
5. UPI QR on INR invoices; Stripe and Razorpay payment-link connect (user's own account).
6. India tax pack: GSTIN fields, CGST/SGST/IGST split by place of supply, HSN/SAC codes, LUT export invoice, monthly tax summary CSV.
7. Free public invoice generator page that converts to signup with the draft kept.
8. CSV import for clients and invoices.

### Pricing to test

| Plan | Price | Includes | Positioned against |
| --- | --- | --- | --- |
| Free | ₹0 / $0 | Unlimited clients and invoices, PDF, public link, SendMyBill footer | Zoho Invoice, Wave Starter |
| Pro | ₹399/mo or $9/mo (yearly discount ~2 months) | Email delivery tracking, reminders, recurring, payment links, branding removal, tax exports | Moxie $12, Invoice Ninja $14, Bonsai $25 |
| Studio | ₹999/mo or $19/mo | 3 team members, accountant access, custom domain for links, API | FreshBooks Plus $43, HoneyBook $49 |

Gate on automation, not on client count — that is the promise competitors break. Offer a written price lock to the first 500 paying users.

### Production readiness

- [ ] Row-level security tests for every table, including public-link access paths
- [ ] Immutable sent invoices: edits create a revision; full `invoice_events` audit trail
- [ ] Gapless, per-financial-year invoice numbering per business (GST requirement)
- [ ] Outbox/job table with retries, backoff and a terminal failure state for email, reminders and recurring runs
- [ ] Rate limiting and abuse checks on public links and the free generator (spam/phishing risk)
- [ ] Supabase point-in-time recovery enabled; tested restore drill
- [ ] Error tracking (Sentry) and uptime monitoring; status page
- [ ] Email domain authentication (SPF, DKIM, DMARC) to keep invoices out of spam
- [ ] SaaS billing with Razorpay (India) and Stripe or a merchant of record such as Paddle/Lemon Squeezy (global VAT handled)
- [ ] Terms, privacy policy, refund policy, DPA; data export and account deletion
- [ ] India DPDP Act: rules notified 13 Nov 2025, core consent, security and 72-hour breach-report duties apply from 13 May 2027 ([source](https://www.hlc.com/en/publications/indias-digital-personal-data-protection-act-2023-brought-into-force-)); GDPR basics for EU users
- [ ] Onboarding that reaches "first invoice sent" in under 2 minutes; sample data option
- [ ] Product analytics events: signup, first invoice, first send, first payment recorded, upgrade

### Metrics to watch in the first 90 days

| Metric | Target |
| --- | --- |
| Signup → first invoice sent | > 40% within 24 h |
| Generator visitor → signup | > 5% |
| Free → Pro conversion | 3–5% by day 60 |
| Median days to get paid (Pro users) | Falling month on month |
| Monthly logo churn (Pro) | < 4% |

Targets are planning assumptions typical for micro-SaaS, not sourced benchmarks.

## Sources

Pricing pages: [FreshBooks](https://www.freshbooks.com/pricing) · [Zoho Invoice](https://www.zoho.com/us/invoice/pricing/) · [Wave](https://www.waveapps.com/pricing) · [Bonsai](https://www.hellobonsai.com/pricing) · [HoneyBook](https://www.honeybook.com/pricing) · [Moxie](https://www.withmoxie.com/pricing) · [Invoice Ninja](https://invoiceninja.com/pricing-plans/) · [Refrens](https://www.refrens.com/pricing)

Traffic (Similarweb, Aug–Sep 2026): [freshbooks.com](https://www.similarweb.com/website/freshbooks.com/) · [waveapps.com](https://www.similarweb.com/website/waveapps.com/) · [honeybook.com](https://www.similarweb.com/website/honeybook.com/) · [hellobonsai.com](https://www.similarweb.com/website/hellobonsai.com/) · [invoiceninja.com](https://www.similarweb.com/website/invoiceninja.com/) · [invoicesimple.com](https://www.similarweb.com/website/invoicesimple.com/) · [invoice-generator.com](https://www.similarweb.com/website/invoice-generator.com/) · [refrens.com](https://www.similarweb.com/website/refrens.com/) · [withmoxie.com](https://www.similarweb.com/website/withmoxie.com/)

Open source: [Invoice Ninja](https://github.com/invoiceninja/invoiceninja) · [InvoiceShelf](https://github.com/InvoiceShelf/InvoiceShelf) · [Crater](https://github.com/crater-invoice-inc/crater) · [Akaunting](https://github.com/akaunting/akaunting) · [Midday](https://github.com/midday-ai/midday) · [Invoify](https://github.com/al1abb/invoify) · [SolidInvoice](https://github.com/SolidInvoice/SolidInvoice) · [InvoicePlane](https://github.com/InvoicePlane/InvoicePlane) · [IDURAR](https://github.com/idurar/idurar-erp-crm) · [Crater status](https://selfhosting.sh/apps/crater-finance/) · [InvoiceShelf health](https://ideaproof.io/open-source/project/invoiceshelf)

Reviews and complaints: [HoneyBook price hike](https://agiled.app/blog/honeybook-review) · [HoneyBook Trustpilot](https://www.trustpilot.com/review/honeybook.com?page=6) · [Bonsai Trustpilot](https://www.trustpilot.com/review/hellobonsai.com?page=2) · [FreshBooks review](https://www.business.org/finance/accounting/freshbooks-review/) · [Wave Payments review](https://www.merchantmaverick.com/reviews/wave-payments-review/) · [Wave reviews](https://checkthat.ai/brands/wave/reviews) · [Zoho Invoice review](https://www.merchantmaverick.com/reviews/zoho-invoice-review) · [Invoice Ninja GetApp](https://www.getapp.co.uk/software/109411/invoice-ninja) · [Invoice Ninja v5 forum](https://forum.invoiceninja.com/t/v5-a-horrible-downgrade-from-v4/8817)

Regulation: [EU e-invoicing 2026](https://innovatetax.com/blog/7-countries-set-to-mandate-b2b-e-invoicing-in-2026/) · [India e-invoicing threshold](https://www.accountune.com/e-invoicing-compulsory-india-small-business-2026) · [India DPDP Rules](https://www.hlc.com/en/publications/indias-digital-personal-data-protection-act-2023-brought-into-force-)

Internal: SendMyBill `features.md` roadmap (Phase 1 complete, Phase 2 not started).

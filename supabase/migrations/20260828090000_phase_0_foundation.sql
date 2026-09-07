-- Phase 0 foundation hardening.
-- This migration is intentionally self-contained so a fresh project and an
-- existing project converge on the same constraints and defaults.

-- Application preferences and first-run setup.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS billing_mode TEXT,
  ADD COLUMN IF NOT EXISTS country_code TEXT,
  ADD COLUMN IF NOT EXISTS default_currency TEXT NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS default_payment_terms INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS invoice_prefix TEXT NOT NULL DEFAULT 'INV-',
  ADD COLUMN IF NOT EXISTS invoice_next_number BIGINT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN;

-- Profiles that pre-date onboarding should not be forced through it.
UPDATE public.profiles SET onboarding_completed = true WHERE onboarding_completed IS NULL;
ALTER TABLE public.profiles
  ALTER COLUMN onboarding_completed SET DEFAULT false,
  ALTER COLUMN onboarding_completed SET NOT NULL;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_billing_mode_check,
  DROP CONSTRAINT IF EXISTS profiles_country_code_check,
  DROP CONSTRAINT IF EXISTS profiles_default_currency_check,
  DROP CONSTRAINT IF EXISTS profiles_default_payment_terms_check,
  DROP CONSTRAINT IF EXISTS profiles_invoice_prefix_check,
  DROP CONSTRAINT IF EXISTS profiles_invoice_next_number_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_billing_mode_check CHECK (billing_mode IS NULL OR billing_mode IN ('business', 'personal')),
  ADD CONSTRAINT profiles_country_code_check CHECK (country_code IS NULL OR country_code ~ '^[A-Z]{2}$'),
  ADD CONSTRAINT profiles_default_currency_check CHECK (default_currency IN ('USD','EUR','GBP','JPY','CAD','AUD','CHF','CNY','INR','BRL','MXN','SGD','HKD','KRW','ZAR','AED','NZD','SEK','NOK','DKK')),
  ADD CONSTRAINT profiles_default_payment_terms_check CHECK (default_payment_terms BETWEEN 0 AND 365),
  ADD CONSTRAINT profiles_invoice_prefix_check CHECK (invoice_prefix ~ '^[A-Za-z0-9-]{1,20}$'),
  ADD CONSTRAINT profiles_invoice_next_number_check CHECK (invoice_next_number > 0);

-- The application has always read currency, but the original migration did
-- not create it. Check it in here and make it deterministic.
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS currency TEXT;
UPDATE public.invoices SET currency = 'USD' WHERE currency IS NULL OR btrim(currency) = '';
ALTER TABLE public.invoices
  ALTER COLUMN currency SET DEFAULT 'USD',
  ALTER COLUMN currency SET NOT NULL,
  ADD COLUMN IF NOT EXISTS seller_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Snapshot existing seller details once so future profile edits do not change
-- historical invoice presentation.
UPDATE public.invoices AS invoice
SET seller_snapshot = jsonb_build_object(
  'company_name', COALESCE(profile.company_name, ''),
  'company_address', COALESCE(profile.company_address, ''),
  'company_phone', COALESCE(profile.company_phone, ''),
  'company_email', COALESCE(profile.company_email, ''),
  'tax_id', COALESCE(profile.tax_id, ''),
  'bank_name', COALESCE(profile.bank_name, ''),
  'bank_account_number', COALESCE(profile.bank_account_number, ''),
  'bank_routing_number', COALESCE(profile.bank_routing_number, ''),
  'bank_swift_code', COALESCE(profile.bank_swift_code, ''),
  'company_logo_url', profile.company_logo_url,
  'signature_url', profile.signature_url
)
FROM public.profiles AS profile
WHERE invoice.user_id = profile.id AND invoice.seller_snapshot = '{}'::jsonb;

-- Normalize legacy statuses before enforcing the launch status vocabulary.
UPDATE public.invoices SET status = lower(status);
UPDATE public.invoices SET status = 'pending' WHERE status IN ('sent', 'overdue');
UPDATE public.invoices SET status = 'draft' WHERE status NOT IN ('draft', 'pending', 'paid');

-- Older app versions allowed template identifiers that are no longer
-- rendered. Preserve those invoices while assigning the closest supported
-- presentation before enforcing the current template vocabulary.
UPDATE public.invoices
SET template_id = 'modern'
WHERE template_id IS NULL OR template_id NOT IN ('modern', 'classic', 'minimal');

-- The earliest invoice editor stored a unit price under `price`. Translate
-- that key to the current `rate` shape without changing descriptions,
-- quantities, or the invoice-level financial snapshot.
UPDATE public.invoices AS invoice
SET items = (
  SELECT jsonb_agg(
    CASE
      WHEN item ? 'price'
        AND NOT item ? 'rate'
        AND jsonb_typeof(item->'quantity') = 'number'
        AND jsonb_typeof(item->'price') = 'number'
      THEN (item - 'price') || jsonb_build_object(
        'rate', item->'price',
        'amount', to_jsonb(round((item->>'quantity')::NUMERIC * (item->>'price')::NUMERIC, 2))
      )
      ELSE item
    END
    ORDER BY ordinal
  )
  FROM jsonb_array_elements(invoice.items) WITH ORDINALITY AS legacy_item(item, ordinal)
)
WHERE jsonb_typeof(invoice.items) = 'array'
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(invoice.items) AS legacy_item(item)
    WHERE item ? 'price' AND NOT item ? 'rate'
  );

CREATE OR REPLACE FUNCTION public.invoice_items_are_valid(candidate JSONB)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  item JSONB;
BEGIN
  IF jsonb_typeof(candidate) <> 'array' OR jsonb_array_length(candidate) < 1 THEN
    RETURN false;
  END IF;

  FOR item IN SELECT value FROM jsonb_array_elements(candidate)
  LOOP
    IF jsonb_typeof(item) <> 'object'
      OR jsonb_typeof(item->'description') <> 'string'
      OR btrim(item->>'description') = ''
      OR jsonb_typeof(item->'quantity') <> 'number'
      OR (item->>'quantity')::numeric <= 0
      OR jsonb_typeof(item->'rate') <> 'number'
      OR (item->>'rate')::numeric < 0
    THEN
      RETURN false;
    END IF;
  END LOOP;
  RETURN true;
EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.prepare_invoice_financials()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  computed_items JSONB;
  computed_subtotal NUMERIC(12,2);
BEGIN
  IF NOT public.invoice_items_are_valid(NEW.items) THEN
    RAISE EXCEPTION 'Invoice requires valid line items' USING ERRCODE = '23514';
  END IF;

  SELECT
    COALESCE(jsonb_agg(jsonb_set(
      item,
      '{amount}',
      to_jsonb(round((item->>'quantity')::numeric * (item->>'rate')::numeric, 2)),
      true
    )), '[]'::jsonb),
    COALESCE(round(sum((item->>'quantity')::numeric * (item->>'rate')::numeric), 2), 0)
  INTO computed_items, computed_subtotal
  FROM jsonb_array_elements(NEW.items) AS item;

  NEW.items := computed_items;
  NEW.subtotal := computed_subtotal;
  NEW.tax_amount := round(computed_subtotal * NEW.tax_rate / 100, 2);
  NEW.total := NEW.subtotal + NEW.tax_amount;

  IF TG_OP = 'INSERT' AND NEW.seller_snapshot = '{}'::jsonb THEN
    SELECT jsonb_build_object(
      'company_name', COALESCE(company_name, ''),
      'company_address', COALESCE(company_address, ''),
      'company_phone', COALESCE(company_phone, ''),
      'company_email', COALESCE(company_email, ''),
      'tax_id', COALESCE(tax_id, ''),
      'bank_name', COALESCE(bank_name, ''),
      'bank_account_number', COALESCE(bank_account_number, ''),
      'bank_routing_number', COALESCE(bank_routing_number, ''),
      'bank_swift_code', COALESCE(bank_swift_code, ''),
      'company_logo_url', company_logo_url,
      'signature_url', signature_url
    ) INTO NEW.seller_snapshot
    FROM public.profiles WHERE id = NEW.user_id;
    NEW.seller_snapshot := COALESCE(NEW.seller_snapshot, '{}'::jsonb);
  ELSIF TG_OP = 'UPDATE' THEN
    NEW.seller_snapshot := OLD.seller_snapshot;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prepare_invoice_financials ON public.invoices;
CREATE TRIGGER prepare_invoice_financials
  BEFORE INSERT OR UPDATE OF items, tax_rate, seller_snapshot ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.prepare_invoice_financials();

ALTER TABLE public.invoices
  DROP CONSTRAINT IF EXISTS invoices_status_check,
  DROP CONSTRAINT IF EXISTS invoices_tax_rate_check,
  DROP CONSTRAINT IF EXISTS invoices_subtotal_check,
  DROP CONSTRAINT IF EXISTS invoices_tax_amount_check,
  DROP CONSTRAINT IF EXISTS invoices_total_check,
  DROP CONSTRAINT IF EXISTS invoices_due_date_check,
  DROP CONSTRAINT IF EXISTS invoices_items_check,
  DROP CONSTRAINT IF EXISTS invoices_currency_check,
  DROP CONSTRAINT IF EXISTS invoices_template_id_check,
  DROP CONSTRAINT IF EXISTS invoices_client_email_check,
  DROP CONSTRAINT IF EXISTS invoices_invoice_number_check;

ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_status_check CHECK (status IN ('draft', 'pending', 'paid')),
  ADD CONSTRAINT invoices_tax_rate_check CHECK (tax_rate BETWEEN 0 AND 100),
  ADD CONSTRAINT invoices_subtotal_check CHECK (subtotal >= 0),
  ADD CONSTRAINT invoices_tax_amount_check CHECK (tax_amount >= 0),
  ADD CONSTRAINT invoices_total_check CHECK (total >= 0 AND total = subtotal + tax_amount),
  ADD CONSTRAINT invoices_due_date_check CHECK (due_date >= issue_date),
  -- Enforce the current shape for new and changed records without deleting or
  -- rewriting historical snapshots that contain legitimate negative discounts.
  ADD CONSTRAINT invoices_items_check CHECK (public.invoice_items_are_valid(items)) NOT VALID,
  ADD CONSTRAINT invoices_currency_check CHECK (currency IN ('USD','EUR','GBP','JPY','CAD','AUD','CHF','CNY','INR','BRL','MXN','SGD','HKD','KRW','ZAR','AED','NZD','SEK','NOK','DKK')),
  ADD CONSTRAINT invoices_template_id_check CHECK (template_id IN ('modern', 'classic', 'minimal')),
  -- New records require a valid email; one historical snapshot predates that
  -- requirement and remains readable until it is explicitly edited.
  ADD CONSTRAINT invoices_client_email_check CHECK (btrim(client_email) <> '' AND position('@' IN client_email) > 1) NOT VALID,
  ADD CONSTRAINT invoices_invoice_number_check CHECK (btrim(invoice_number) <> '');

-- Preserve all legacy records while resolving duplicate invoice numbers before
-- adding a case-insensitive per-user uniqueness rule.
WITH duplicates AS (
  SELECT id, row_number() OVER (PARTITION BY user_id, lower(invoice_number) ORDER BY created_at, id) AS duplicate_number
  FROM public.invoices
)
UPDATE public.invoices AS invoice
SET invoice_number = invoice.invoice_number || '-' || substr(invoice.id::text, 1, 8)
FROM duplicates
WHERE invoice.id = duplicates.id AND duplicates.duplicate_number > 1;

CREATE UNIQUE INDEX IF NOT EXISTS invoices_user_invoice_number_unique ON public.invoices (user_id, lower(invoice_number));
CREATE INDEX IF NOT EXISTS invoices_user_id_idx ON public.invoices (user_id);
CREATE INDEX IF NOT EXISTS invoices_user_created_at_idx ON public.invoices (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS invoices_user_status_idx ON public.invoices (user_id, status);
CREATE INDEX IF NOT EXISTS invoices_user_due_date_idx ON public.invoices (user_id, due_date);
CREATE INDEX IF NOT EXISTS clients_user_client_name_idx ON public.clients (user_id, lower(client_name));

-- The original clients migration omitted its auth.users foreign key.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'clients_user_id_fkey') THEN
    ALTER TABLE public.clients ADD CONSTRAINT clients_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Keep updated_at behavior consistent across every mutable public table.
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_invoices_updated_at ON public.invoices;
CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_clients_updated_at ON public.clients;
CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Company assets are account-private and delivered by short-lived signed URLs.
UPDATE storage.buckets SET public = false WHERE id = 'company-assets';
DROP POLICY IF EXISTS "Public can view company assets" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own company assets" ON storage.objects;
CREATE POLICY "Users can view own company assets"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'company-assets' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Convert known legacy public URLs to bucket-relative object paths.
UPDATE public.profiles
SET company_logo_url = regexp_replace(company_logo_url, '^.*/storage/v1/object/public/company-assets/', '')
WHERE company_logo_url LIKE '%/storage/v1/object/public/company-assets/%';
UPDATE public.profiles
SET signature_url = regexp_replace(signature_url, '^.*/storage/v1/object/public/company-assets/', '')
WHERE signature_url LIKE '%/storage/v1/object/public/company-assets/%';

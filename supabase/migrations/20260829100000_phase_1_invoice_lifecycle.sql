-- Phase 1 invoice lifecycle: reversible archiving and safe duplication.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS default_tax_rate NUMERIC(5,2) NOT NULL DEFAULT 0;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_default_tax_rate_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_default_tax_rate_check CHECK (default_tax_rate BETWEEN 0 AND 100);

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS source_invoice_id UUID,
  ADD COLUMN IF NOT EXISTS payment_terms TEXT,
  ADD COLUMN IF NOT EXISTS late_fee_notes TEXT,
  ADD COLUMN IF NOT EXISTS footer_text TEXT;

ALTER TABLE public.invoices
  DROP CONSTRAINT IF EXISTS invoices_payment_terms_length_check,
  DROP CONSTRAINT IF EXISTS invoices_late_fee_notes_length_check,
  DROP CONSTRAINT IF EXISTS invoices_footer_text_length_check;

ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_payment_terms_length_check CHECK (char_length(payment_terms) <= 5000),
  ADD CONSTRAINT invoices_late_fee_notes_length_check CHECK (char_length(late_fee_notes) <= 5000),
  ADD CONSTRAINT invoices_footer_text_length_check CHECK (char_length(footer_text) <= 5000);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'invoices_source_invoice_id_fkey'
      AND conrelid = 'public.invoices'::regclass
  ) THEN
    ALTER TABLE public.invoices
      ADD CONSTRAINT invoices_source_invoice_id_fkey
      FOREIGN KEY (source_invoice_id) REFERENCES public.invoices(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS invoices_user_archived_at_idx
  ON public.invoices (user_id, archived_at);

CREATE INDEX IF NOT EXISTS invoices_source_invoice_id_idx
  ON public.invoices (source_invoice_id)
  WHERE source_invoice_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.duplicate_invoice(p_source_invoice_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  source_invoice public.invoices%ROWTYPE;
  user_profile public.profiles%ROWTYPE;
  next_sequence BIGINT;
  next_invoice_number TEXT;
  duplicated_invoice_id UUID;
  duplicate_issue_date DATE := CURRENT_DATE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication is required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO source_invoice
  FROM public.invoices
  WHERE id = p_source_invoice_id AND user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO user_profile
  FROM public.profiles
  WHERE id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found' USING ERRCODE = 'P0002';
  END IF;

  next_sequence := user_profile.invoice_next_number;
  LOOP
    next_invoice_number := user_profile.invoice_prefix ||
      CASE
        WHEN length(next_sequence::TEXT) >= 4 THEN next_sequence::TEXT
        ELSE lpad(next_sequence::TEXT, 4, '0')
      END;

    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.invoices
      WHERE user_id = auth.uid()
        AND lower(invoice_number) = lower(next_invoice_number)
    );
    next_sequence := next_sequence + 1;
  END LOOP;

  UPDATE public.profiles
  SET invoice_next_number = next_sequence + 1
  WHERE id = auth.uid();

  INSERT INTO public.invoices (
    user_id,
    invoice_number,
    client_name,
    client_email,
    client_address,
    issue_date,
    due_date,
    items,
    tax_rate,
    notes,
    payment_terms,
    late_fee_notes,
    footer_text,
    template_id,
    status,
    currency,
    seller_snapshot,
    source_invoice_id
  ) VALUES (
    auth.uid(),
    next_invoice_number,
    source_invoice.client_name,
    source_invoice.client_email,
    source_invoice.client_address,
    duplicate_issue_date,
    duplicate_issue_date + user_profile.default_payment_terms,
    source_invoice.items,
    source_invoice.tax_rate,
    source_invoice.notes,
    source_invoice.payment_terms,
    source_invoice.late_fee_notes,
    source_invoice.footer_text,
    source_invoice.template_id,
    'draft',
    source_invoice.currency,
    source_invoice.seller_snapshot,
    source_invoice.id
  )
  RETURNING id INTO duplicated_invoice_id;

  RETURN duplicated_invoice_id;
END;
$$;

REVOKE ALL ON FUNCTION public.duplicate_invoice(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.duplicate_invoice(UUID) TO authenticated;

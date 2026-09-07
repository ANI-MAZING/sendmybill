ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS discount_type TEXT NOT NULL DEFAULT 'fixed',
  ADD COLUMN IF NOT EXISTS discount_value NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.prepare_invoice_financials()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  computed_items JSONB;
  computed_subtotal NUMERIC(12,2);
  computed_discount NUMERIC(12,2);
BEGIN
  IF NOT public.invoice_items_are_valid(NEW.items) THEN
    RAISE EXCEPTION 'Invoice requires valid line items' USING ERRCODE = '23514';
  END IF;

  IF NEW.discount_type NOT IN ('fixed', 'percentage')
    OR NEW.discount_value < 0
    OR (NEW.discount_type = 'percentage' AND NEW.discount_value > 100)
  THEN
    RAISE EXCEPTION 'Invoice discount is invalid' USING ERRCODE = '23514';
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

  computed_discount := round(LEAST(
    computed_subtotal,
    CASE WHEN NEW.discount_type = 'percentage'
      THEN computed_subtotal * NEW.discount_value / 100
      ELSE NEW.discount_value
    END
  ), 2);

  NEW.items := computed_items;
  NEW.subtotal := computed_subtotal;
  NEW.discount_amount := computed_discount;
  NEW.tax_amount := round((computed_subtotal - computed_discount) * NEW.tax_rate / 100, 2);
  NEW.total := computed_subtotal - computed_discount + NEW.tax_amount;

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
  BEFORE INSERT OR UPDATE OF items, discount_type, discount_value, tax_rate, seller_snapshot ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.prepare_invoice_financials();

ALTER TABLE public.invoices
  DROP CONSTRAINT IF EXISTS invoices_total_check,
  DROP CONSTRAINT IF EXISTS invoices_discount_type_check,
  DROP CONSTRAINT IF EXISTS invoices_discount_value_check,
  DROP CONSTRAINT IF EXISTS invoices_discount_amount_check;

ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_discount_type_check CHECK (discount_type IN ('fixed', 'percentage')),
  ADD CONSTRAINT invoices_discount_value_check CHECK (discount_value >= 0 AND (discount_type <> 'percentage' OR discount_value <= 100)),
  ADD CONSTRAINT invoices_discount_amount_check CHECK (discount_amount >= 0 AND discount_amount <= subtotal),
  ADD CONSTRAINT invoices_total_check CHECK (total >= 0 AND total = subtotal - discount_amount + tax_amount);

CREATE OR REPLACE FUNCTION public.convert_proforma(p_proforma_id UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE source public.invoices%ROWTYPE; profile public.profiles%ROWTYPE; sequence BIGINT; candidate TEXT; result_id UUID;
BEGIN
  SELECT * INTO source FROM public.invoices WHERE id = p_proforma_id AND user_id = auth.uid() AND document_type = 'proforma';
  IF NOT FOUND THEN RAISE EXCEPTION 'Proforma not found' USING ERRCODE = 'P0002'; END IF;
  IF source.proforma_status = 'converted' THEN
    SELECT id INTO result_id FROM public.invoices WHERE converted_from_id = source.id AND user_id = auth.uid();
    RETURN result_id;
  END IF;
  SELECT * INTO profile FROM public.profiles WHERE id = auth.uid() FOR UPDATE;
  sequence := profile.invoice_next_number;
  LOOP
    candidate := profile.invoice_prefix || CASE WHEN length(sequence::TEXT) >= 4 THEN sequence::TEXT ELSE lpad(sequence::TEXT, 4, '0') END;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.invoices WHERE user_id = auth.uid() AND lower(invoice_number) = lower(candidate));
    sequence := sequence + 1;
  END LOOP;
  UPDATE public.profiles SET invoice_next_number = sequence + 1 WHERE id = auth.uid();
  INSERT INTO public.invoices (
    user_id, invoice_number, client_id, project_id, client_name, client_email, client_address,
    issue_date, due_date, items, discount_type, discount_value, tax_rate, notes, payment_terms, late_fee_notes, footer_text,
    template_id, status, currency, seller_snapshot, document_type, converted_from_id
  ) VALUES (
    auth.uid(), candidate, source.client_id, source.project_id, source.client_name, source.client_email, source.client_address,
    CURRENT_DATE, CURRENT_DATE + profile.default_payment_terms, source.items, source.discount_type, source.discount_value, source.tax_rate, source.notes,
    source.payment_terms, source.late_fee_notes, source.footer_text, source.template_id, 'draft', source.currency,
    source.seller_snapshot, 'invoice', source.id
  ) RETURNING id INTO result_id;
  UPDATE public.invoices SET proforma_status = 'converted' WHERE id = source.id;
  RETURN result_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.duplicate_invoice(p_source_invoice_id UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE source public.invoices%ROWTYPE; profile public.profiles%ROWTYPE; sequence BIGINT; prefix TEXT; candidate TEXT; result_id UUID;
BEGIN
  SELECT * INTO source FROM public.invoices WHERE id = p_source_invoice_id AND user_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Document not found' USING ERRCODE = 'P0002'; END IF;
  SELECT * INTO profile FROM public.profiles WHERE id = auth.uid() FOR UPDATE;
  IF source.document_type = 'proforma' THEN sequence := profile.proforma_next_number; prefix := profile.proforma_prefix;
  ELSE sequence := profile.invoice_next_number; prefix := profile.invoice_prefix; END IF;
  LOOP
    candidate := prefix || CASE WHEN length(sequence::TEXT) >= 4 THEN sequence::TEXT ELSE lpad(sequence::TEXT, 4, '0') END;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.invoices WHERE user_id = auth.uid() AND lower(invoice_number) = lower(candidate));
    sequence := sequence + 1;
  END LOOP;
  IF source.document_type = 'proforma' THEN UPDATE public.profiles SET proforma_next_number = sequence + 1 WHERE id = auth.uid();
  ELSE UPDATE public.profiles SET invoice_next_number = sequence + 1 WHERE id = auth.uid(); END IF;
  INSERT INTO public.invoices (
    user_id, invoice_number, client_id, project_id, client_name, client_email, client_address,
    issue_date, due_date, expiry_date, items, discount_type, discount_value, tax_rate, notes, payment_terms, late_fee_notes, footer_text,
    template_id, status, currency, seller_snapshot, document_type, proforma_status, source_invoice_id
  ) VALUES (
    auth.uid(), candidate, source.client_id, source.project_id, source.client_name, source.client_email, source.client_address,
    CURRENT_DATE, CURRENT_DATE + profile.default_payment_terms,
    CASE WHEN source.document_type = 'proforma' THEN CURRENT_DATE + profile.default_payment_terms ELSE NULL END,
    source.items, source.discount_type, source.discount_value, source.tax_rate, source.notes, source.payment_terms, source.late_fee_notes, source.footer_text,
    source.template_id, 'draft', source.currency, source.seller_snapshot, source.document_type,
    CASE WHEN source.document_type = 'proforma' THEN 'draft' ELSE NULL END, source.id
  ) RETURNING id INTO result_id;
  RETURN result_id;
END;
$$;

REVOKE ALL ON FUNCTION public.convert_proforma(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.convert_proforma(UUID) TO authenticated;
REVOKE ALL ON FUNCTION public.duplicate_invoice(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.duplicate_invoice(UUID) TO authenticated;

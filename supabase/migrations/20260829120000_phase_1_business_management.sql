-- Phase 1 business-management model.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS proforma_prefix TEXT NOT NULL DEFAULT 'PRO-',
  ADD COLUMN IF NOT EXISTS proforma_next_number BIGINT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS invoice_accent_color TEXT NOT NULL DEFAULT '#2563eb',
  ADD COLUMN IF NOT EXISTS invoice_font TEXT NOT NULL DEFAULT 'sans';

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_proforma_prefix_check,
  DROP CONSTRAINT IF EXISTS profiles_proforma_next_number_check,
  DROP CONSTRAINT IF EXISTS profiles_invoice_accent_color_check,
  DROP CONSTRAINT IF EXISTS profiles_invoice_font_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_proforma_prefix_check CHECK (proforma_prefix ~ '^[A-Za-z0-9-]{1,20}$'),
  ADD CONSTRAINT profiles_proforma_next_number_check CHECK (proforma_next_number > 0),
  ADD CONSTRAINT profiles_invoice_accent_color_check CHECK (invoice_accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  ADD CONSTRAINT profiles_invoice_font_check CHECK (invoice_font IN ('sans', 'serif', 'mono'));

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}'::TEXT[];

CREATE INDEX IF NOT EXISTS clients_user_email_idx ON public.clients (user_id, lower(client_email));
CREATE INDEX IF NOT EXISTS clients_tags_idx ON public.clients USING GIN (tags);

CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  description TEXT,
  billing_model TEXT NOT NULL DEFAULT 'fixed',
  status TEXT NOT NULL DEFAULT 'planned',
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  currency TEXT NOT NULL DEFAULT 'USD',
  budget NUMERIC(12,2) NOT NULL DEFAULT 0,
  billing_rate NUMERIC(12,2) NOT NULL DEFAULT 0,
  internal_notes TEXT,
  billing_snapshot JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT projects_name_check CHECK (btrim(name) <> ''),
  CONSTRAINT projects_billing_model_check CHECK (billing_model IN ('fixed', 'hourly', 'milestone', 'retainer')),
  CONSTRAINT projects_status_check CHECK (status IN ('planned', 'active', 'on_hold', 'completed', 'cancelled')),
  CONSTRAINT projects_dates_check CHECK (end_date IS NULL OR end_date >= start_date),
  CONSTRAINT projects_money_check CHECK (budget >= 0 AND billing_rate >= 0)
);

CREATE TABLE IF NOT EXISTS public.project_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  due_date DATE,
  value NUMERIC(12,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'planned',
  billing_trigger BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT project_milestones_name_check CHECK (btrim(name) <> ''),
  CONSTRAINT project_milestones_value_check CHECK (value >= 0),
  CONSTRAINT project_milestones_status_check CHECK (status IN ('planned', 'in_progress', 'completed', 'cancelled'))
);

CREATE TABLE IF NOT EXISTS public.project_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'todo',
  is_deliverable BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT project_tasks_title_check CHECK (btrim(title) <> ''),
  CONSTRAINT project_tasks_status_check CHECK (status IN ('todo', 'in_progress', 'done', 'cancelled'))
);

CREATE TABLE IF NOT EXISTS public.time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  duration_minutes INTEGER NOT NULL,
  member_name TEXT NOT NULL,
  billable BOOLEAN NOT NULL DEFAULT true,
  hourly_rate NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes TEXT,
  timer_started_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT time_entries_duration_check CHECK (duration_minutes > 0),
  CONSTRAINT time_entries_rate_check CHECK (hourly_rate >= 0),
  CONSTRAINT time_entries_member_check CHECK (btrim(member_name) <> '')
);

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS document_type TEXT NOT NULL DEFAULT 'invoice',
  ADD COLUMN IF NOT EXISTS proforma_status TEXT,
  ADD COLUMN IF NOT EXISTS expiry_date DATE,
  ADD COLUMN IF NOT EXISTS converted_from_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL;

UPDATE public.invoices SET proforma_status = 'draft' WHERE document_type = 'proforma' AND proforma_status IS NULL;

ALTER TABLE public.invoices
  DROP CONSTRAINT IF EXISTS invoices_document_type_check,
  DROP CONSTRAINT IF EXISTS invoices_proforma_status_check,
  DROP CONSTRAINT IF EXISTS invoices_expiry_date_check;

ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_document_type_check CHECK (document_type IN ('invoice', 'proforma')),
  ADD CONSTRAINT invoices_proforma_status_check CHECK (
    (document_type = 'invoice' AND proforma_status IS NULL)
    OR (document_type = 'proforma' AND proforma_status IN ('draft', 'sent', 'viewed', 'accepted', 'rejected', 'expired', 'converted'))
  ),
  ADD CONSTRAINT invoices_expiry_date_check CHECK (expiry_date IS NULL OR expiry_date >= issue_date);

CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount NUMERIC(12,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  method TEXT NOT NULL DEFAULT 'bank_transfer',
  reference TEXT,
  payer TEXT NOT NULL,
  notes TEXT,
  attachment_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT payments_amount_check CHECK (amount > 0),
  CONSTRAINT payments_method_check CHECK (method IN ('bank_transfer', 'cash', 'card', 'cheque', 'wallet', 'other'))
);

CREATE TABLE IF NOT EXISTS public.payment_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE RESTRICT,
  amount NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT payment_allocations_amount_check CHECK (amount > 0),
  CONSTRAINT payment_allocations_unique UNIQUE (payment_id, invoice_id)
);

CREATE TABLE IF NOT EXISTS public.expense_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT expense_categories_name_check CHECK (btrim(name) <> ''),
  CONSTRAINT expense_categories_unique UNIQUE (user_id, name)
);

CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  category_id UUID REFERENCES public.expense_categories(id) ON DELETE SET NULL,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount NUMERIC(12,2) NOT NULL,
  tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  vendor TEXT NOT NULL,
  notes TEXT,
  receipt_path TEXT,
  is_recurring BOOLEAN NOT NULL DEFAULT false,
  recurrence_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT expenses_amount_check CHECK (amount > 0 AND tax_amount >= 0),
  CONSTRAINT expenses_vendor_check CHECK (btrim(vendor) <> '')
);

CREATE TABLE IF NOT EXISTS public.attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  record_type TEXT NOT NULL,
  record_id UUID,
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  file_size BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT attachments_record_type_check CHECK (record_type IN ('project', 'invoice', 'payment', 'expense'))
);

CREATE TABLE IF NOT EXISTS public.project_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  title TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.financial_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  action TEXT NOT NULL,
  old_data JSONB,
  new_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT financial_audit_action_check CHECK (action IN ('insert', 'update', 'delete'))
);

CREATE TABLE IF NOT EXISTS public.invoice_presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  items JSONB NOT NULL,
  tax_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  notes TEXT,
  payment_terms TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT invoice_presets_name_check CHECK (btrim(name) <> ''),
  CONSTRAINT invoice_presets_tax_check CHECK (tax_rate BETWEEN 0 AND 100),
  CONSTRAINT invoice_presets_items_check CHECK (public.invoice_items_are_valid(items))
);

CREATE OR REPLACE FUNCTION public.prepare_project_snapshot()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.billing_snapshot = '{}'::JSONB THEN
    NEW.billing_snapshot := jsonb_build_object(
      'billing_model', NEW.billing_model,
      'currency', NEW.currency,
      'budget', NEW.budget,
      'billing_rate', NEW.billing_rate
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prepare_project_snapshot ON public.projects;
CREATE TRIGGER prepare_project_snapshot BEFORE INSERT ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.prepare_project_snapshot();

CREATE OR REPLACE FUNCTION public.validate_payment_allocation()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE payment_total NUMERIC(12,2); allocated_total NUMERIC(12,2);
BEGIN
  SELECT amount INTO payment_total FROM public.payments
    WHERE id = NEW.payment_id AND user_id = NEW.user_id FOR UPDATE;
  IF payment_total IS NULL THEN RAISE EXCEPTION 'Payment not found'; END IF;
  SELECT COALESCE(sum(amount), 0) INTO allocated_total FROM public.payment_allocations
    WHERE payment_id = NEW.payment_id AND id <> NEW.id;
  IF allocated_total + NEW.amount > payment_total THEN
    RAISE EXCEPTION 'Allocations cannot exceed the payment amount' USING ERRCODE = '23514';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.invoices WHERE id = NEW.invoice_id AND user_id = NEW.user_id AND document_type = 'invoice') THEN
    RAISE EXCEPTION 'Allocations require an owned final invoice' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_payment_allocation ON public.payment_allocations;
CREATE TRIGGER validate_payment_allocation BEFORE INSERT OR UPDATE ON public.payment_allocations
  FOR EACH ROW EXECUTE FUNCTION public.validate_payment_allocation();

CREATE OR REPLACE FUNCTION public.sync_invoice_payment_status()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE target_invoice UUID; invoice_total NUMERIC(12,2); allocated NUMERIC(12,2);
BEGIN
  target_invoice := COALESCE(NEW.invoice_id, OLD.invoice_id);
  SELECT total INTO invoice_total FROM public.invoices WHERE id = target_invoice;
  SELECT COALESCE(sum(amount), 0) INTO allocated FROM public.payment_allocations WHERE invoice_id = target_invoice;
  UPDATE public.invoices
    SET status = CASE WHEN allocated >= invoice_total THEN 'paid' WHEN status = 'paid' THEN 'pending' ELSE status END
    WHERE id = target_invoice AND document_type = 'invoice';
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS sync_invoice_payment_status ON public.payment_allocations;
CREATE TRIGGER sync_invoice_payment_status AFTER INSERT OR UPDATE OR DELETE ON public.payment_allocations
  FOR EACH ROW EXECUTE FUNCTION public.sync_invoice_payment_status();

CREATE OR REPLACE FUNCTION public.validate_paid_invoice_status()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE allocated NUMERIC(12,2);
BEGIN
  IF NEW.document_type = 'invoice' THEN
    SELECT COALESCE(sum(amount), 0) INTO allocated FROM public.payment_allocations WHERE invoice_id = NEW.id;
    IF NEW.status = 'paid' AND (allocated < NEW.total OR allocated = 0) THEN
      RAISE EXCEPTION 'Paid status requires full payment allocation' USING ERRCODE = '23514';
    END IF;
    IF OLD.status = 'paid' AND NEW.status <> 'paid' AND allocated >= NEW.total AND allocated > 0 THEN
      RAISE EXCEPTION 'Remove or reduce payment allocations before reopening a paid invoice' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_paid_invoice_status ON public.invoices;
CREATE TRIGGER validate_paid_invoice_status BEFORE UPDATE OF status, total ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.validate_paid_invoice_status();

CREATE OR REPLACE FUNCTION public.audit_financial_record()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE actor UUID; record UUID; project UUID;
BEGIN
  actor := COALESCE(NEW.user_id, OLD.user_id);
  record := COALESCE(NEW.id, OLD.id);
  project := COALESCE(NEW.project_id, OLD.project_id);
  INSERT INTO public.financial_audit_log (user_id, table_name, record_id, action, old_data, new_data)
  VALUES (actor, TG_TABLE_NAME, record, lower(TG_OP), CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END, CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END);
  IF project IS NOT NULL THEN
    INSERT INTO public.project_events (user_id, project_id, event_type, title, details)
    VALUES (actor, project, lower(TG_OP) || '_' || TG_TABLE_NAME, initcap(lower(TG_OP)) || ' ' || TG_TABLE_NAME, jsonb_build_object('record_id', record));
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS audit_payments ON public.payments;
CREATE TRIGGER audit_payments AFTER INSERT OR UPDATE OR DELETE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.audit_financial_record();
DROP TRIGGER IF EXISTS audit_expenses ON public.expenses;
CREATE TRIGGER audit_expenses AFTER INSERT OR UPDATE OR DELETE ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.audit_financial_record();

CREATE OR REPLACE FUNCTION public.log_project_record_event()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE actor UUID; project UUID; record UUID;
BEGIN
  actor := COALESCE(NEW.user_id, OLD.user_id);
  project := COALESCE(NEW.project_id, OLD.project_id);
  record := COALESCE(NEW.id, OLD.id);
  IF project IS NOT NULL THEN
    INSERT INTO public.project_events (user_id, project_id, event_type, title, details)
    VALUES (actor, project, lower(TG_OP) || '_' || TG_TABLE_NAME, initcap(lower(TG_OP)) || ' ' || replace(TG_TABLE_NAME, '_', ' '), jsonb_build_object('record_id', record));
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DO $$
DECLARE table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['invoices','project_milestones','project_tasks','time_entries','attachments']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS log_%I_event ON public.%I', table_name, table_name);
    EXECUTE format('CREATE TRIGGER log_%I_event AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.log_project_record_event()', table_name, table_name);
  END LOOP;
END $$;

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
    issue_date, due_date, items, tax_rate, notes, payment_terms, late_fee_notes, footer_text,
    template_id, status, currency, seller_snapshot, document_type, converted_from_id
  ) VALUES (
    auth.uid(), candidate, source.client_id, source.project_id, source.client_name, source.client_email, source.client_address,
    CURRENT_DATE, CURRENT_DATE + profile.default_payment_terms, source.items, source.tax_rate, source.notes,
    source.payment_terms, source.late_fee_notes, source.footer_text, source.template_id, 'draft', source.currency,
    source.seller_snapshot, 'invoice', source.id
  ) RETURNING id INTO result_id;
  UPDATE public.invoices SET proforma_status = 'converted' WHERE id = source.id;
  RETURN result_id;
END;
$$;

REVOKE ALL ON FUNCTION public.convert_proforma(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.convert_proforma(UUID) TO authenticated;

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
    issue_date, due_date, expiry_date, items, tax_rate, notes, payment_terms, late_fee_notes, footer_text,
    template_id, status, currency, seller_snapshot, document_type, proforma_status, source_invoice_id
  ) VALUES (
    auth.uid(), candidate, source.client_id, source.project_id, source.client_name, source.client_email, source.client_address,
    CURRENT_DATE, CURRENT_DATE + profile.default_payment_terms,
    CASE WHEN source.document_type = 'proforma' THEN CURRENT_DATE + profile.default_payment_terms ELSE NULL END,
    source.items, source.tax_rate, source.notes, source.payment_terms, source.late_fee_notes, source.footer_text,
    source.template_id, 'draft', source.currency, source.seller_snapshot, source.document_type,
    CASE WHEN source.document_type = 'proforma' THEN 'draft' ELSE NULL END, source.id
  ) RETURNING id INTO result_id;
  RETURN result_id;
END;
$$;

REVOKE ALL ON FUNCTION public.duplicate_invoice(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.duplicate_invoice(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_updated_at_phase_1()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DO $$
DECLARE table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['projects','project_milestones','project_tasks','time_entries','payments','payment_allocations','expenses','invoice_presets']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS update_%I_updated_at ON public.%I', table_name, table_name);
    EXECUTE format('CREATE TRIGGER update_%I_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_phase_1()', table_name, table_name);
  END LOOP;
END $$;

DO $$
DECLARE table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'projects','project_milestones','project_tasks','time_entries','payments','payment_allocations',
    'expense_categories','expenses','attachments','project_events','financial_audit_log','invoice_presets'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('DROP POLICY IF EXISTS "Users manage own %s" ON public.%I', table_name, table_name);
    EXECUTE format('CREATE POLICY "Users manage own %s" ON public.%I FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)', table_name, table_name);
  END LOOP;
END $$;

CREATE INDEX IF NOT EXISTS projects_user_status_idx ON public.projects (user_id, status);
CREATE INDEX IF NOT EXISTS projects_client_idx ON public.projects (client_id);
CREATE INDEX IF NOT EXISTS milestones_project_due_idx ON public.project_milestones (project_id, due_date);
CREATE INDEX IF NOT EXISTS tasks_project_status_idx ON public.project_tasks (project_id, status);
CREATE INDEX IF NOT EXISTS time_entries_project_invoice_idx ON public.time_entries (project_id, invoice_id);
CREATE INDEX IF NOT EXISTS invoices_project_idx ON public.invoices (project_id);
CREATE INDEX IF NOT EXISTS invoices_client_idx ON public.invoices (client_id);
CREATE UNIQUE INDEX IF NOT EXISTS invoices_one_conversion_idx ON public.invoices (converted_from_id) WHERE converted_from_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS payments_user_date_idx ON public.payments (user_id, payment_date DESC);
CREATE INDEX IF NOT EXISTS allocations_invoice_idx ON public.payment_allocations (invoice_id);
CREATE INDEX IF NOT EXISTS expenses_user_date_idx ON public.expenses (user_id, expense_date DESC);
CREATE INDEX IF NOT EXISTS expenses_project_idx ON public.expenses (project_id);
CREATE INDEX IF NOT EXISTS events_project_created_idx ON public.project_events (project_id, created_at DESC);

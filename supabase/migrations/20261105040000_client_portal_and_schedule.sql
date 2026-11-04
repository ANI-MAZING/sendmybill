-- Forward schedule on tasks, and one private link per client.
-- Anonymous visitors never read the tables. They call get_shared_client(),
-- which returns only that client's projects, scheduled work, and invoices.

ALTER TABLE public.project_tasks
  ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS estimated_minutes INTEGER NOT NULL DEFAULT 60;

ALTER TABLE public.project_tasks
  DROP CONSTRAINT IF EXISTS project_tasks_estimate_check;

ALTER TABLE public.project_tasks
  ADD CONSTRAINT project_tasks_estimate_check CHECK (estimated_minutes > 0);

CREATE INDEX IF NOT EXISTS tasks_user_schedule_idx
  ON public.project_tasks (user_id, scheduled_at);

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS share_token TEXT,
  ADD COLUMN IF NOT EXISTS shared_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS first_viewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_viewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS view_count INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS clients_share_token_unique
  ON public.clients (share_token) WHERE share_token IS NOT NULL;

CREATE OR REPLACE FUNCTION public.enable_client_share(p_client_id UUID, p_regenerate BOOLEAN DEFAULT false)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  token TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication is required' USING ERRCODE = '42501';
  END IF;

  UPDATE public.clients
  SET share_token = CASE
        WHEN share_token IS NULL OR p_regenerate
        THEN replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')
        ELSE share_token
      END,
      shared_at = CASE WHEN share_token IS NULL OR p_regenerate THEN now() ELSE shared_at END,
      first_viewed_at = CASE WHEN p_regenerate THEN NULL ELSE first_viewed_at END,
      last_viewed_at = CASE WHEN p_regenerate THEN NULL ELSE last_viewed_at END,
      view_count = CASE WHEN p_regenerate THEN 0 ELSE view_count END
  WHERE id = p_client_id AND user_id = auth.uid()
  RETURNING share_token INTO token;

  IF token IS NULL THEN
    RAISE EXCEPTION 'Client not found' USING ERRCODE = 'P0002';
  END IF;
  RETURN token;
END;
$$;

CREATE OR REPLACE FUNCTION public.disable_client_share(p_client_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication is required' USING ERRCODE = '42501';
  END IF;
  UPDATE public.clients
  SET share_token = NULL
  WHERE id = p_client_id AND user_id = auth.uid();
END;
$$;

CREATE OR REPLACE FUNCTION public.get_shared_client(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  client public.clients%ROWTYPE;
  company TEXT;
BEGIN
  IF p_token IS NULL OR length(p_token) < 32 THEN
    RETURN NULL;
  END IF;

  SELECT * INTO client FROM public.clients WHERE share_token = p_token;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF auth.uid() IS DISTINCT FROM client.user_id THEN
    UPDATE public.clients
    SET first_viewed_at = COALESCE(first_viewed_at, now()),
        last_viewed_at = now(),
        view_count = view_count + 1
    WHERE id = client.id;
  END IF;

  SELECT company_name INTO company FROM public.profiles WHERE id = client.user_id;

  RETURN jsonb_build_object(
    'client_name', client.client_name,
    'company_name', company,
    'projects', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', project.id,
        'name', project.name,
        'status', project.status,
        'description', project.description
      ) ORDER BY project.name)
      FROM public.projects AS project
      WHERE project.client_id = client.id
        AND project.status <> 'cancelled'
    ), '[]'::jsonb),
    'work', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', task.id,
        'project_id', task.project_id,
        'project_name', project.name,
        'title', task.title,
        'status', task.status,
        'scheduled_at', task.scheduled_at,
        'estimated_minutes', task.estimated_minutes,
        'is_deliverable', task.is_deliverable
      ) ORDER BY task.scheduled_at NULLS LAST, task.created_at)
      FROM public.project_tasks AS task
      JOIN public.projects AS project ON project.id = task.project_id
      WHERE project.client_id = client.id
        AND task.status <> 'cancelled'
    ), '[]'::jsonb),
    'invoices', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', invoice.id,
        'document_type', invoice.document_type,
        'invoice_number', invoice.invoice_number,
        'client_name', invoice.client_name,
        'client_email', invoice.client_email,
        'client_address', invoice.client_address,
        'issue_date', invoice.issue_date,
        'due_date', invoice.due_date,
        'expiry_date', invoice.expiry_date,
        'items', invoice.items,
        'discount_type', invoice.discount_type,
        'discount_value', invoice.discount_value,
        'tax_rate', invoice.tax_rate,
        'total', invoice.total,
        'notes', invoice.notes,
        'payment_terms', invoice.payment_terms,
        'late_fee_notes', invoice.late_fee_notes,
        'footer_text', invoice.footer_text,
        'template_id', invoice.template_id,
        'currency', invoice.currency,
        'status', invoice.status,
        'seller_snapshot', invoice.seller_snapshot,
        'amount_paid', COALESCE((
          SELECT sum(allocation.amount)
          FROM public.payment_allocations AS allocation
          WHERE allocation.invoice_id = invoice.id
        ), 0)
      ) ORDER BY invoice.issue_date DESC)
      FROM public.invoices AS invoice
      WHERE invoice.archived_at IS NULL
        AND (
          invoice.client_id = client.id
          OR (
            invoice.client_id IS NULL
            AND lower(invoice.client_email) = lower(client.client_email)
          )
        )
        AND (
          (invoice.document_type = 'invoice' AND invoice.status <> 'draft')
          OR (invoice.document_type = 'proforma' AND invoice.proforma_status IS DISTINCT FROM 'draft')
        )
    ), '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_shared_client(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_shared_client(TEXT) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.enable_client_share(UUID, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enable_client_share(UUID, BOOLEAN) TO authenticated;
REVOKE ALL ON FUNCTION public.disable_client_share(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.disable_client_share(UUID) TO authenticated;

-- Logos on the portal use the same private bucket rule as shared invoices.
CREATE OR REPLACE FUNCTION public.owner_has_shared_invoice(p_owner TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.invoices
    WHERE user_id::text = p_owner AND share_token IS NOT NULL AND archived_at IS NULL
  ) OR EXISTS (
    SELECT 1 FROM public.clients
    WHERE user_id::text = p_owner AND share_token IS NOT NULL
  );
$$;

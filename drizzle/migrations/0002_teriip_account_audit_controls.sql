ALTER TABLE public.user_roles
ADD COLUMN disabled_at timestamptz;

CREATE OR REPLACE FUNCTION public.has_role(_role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = (SELECT auth.uid())
      AND role = _role
      AND disabled_at IS NULL
  );
$$;

CREATE OR REPLACE FUNCTION public.current_user_centre()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT centre_id FROM public.user_roles
  WHERE user_id = (SELECT auth.uid()) AND disabled_at IS NULL
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.can_manage_user(_target_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    public.has_role('super_admin')
    OR EXISTS (
      SELECT 1
      FROM public.user_roles AS viewer
      JOIN public.user_roles AS target ON target.user_id = _target_user_id
      WHERE viewer.user_id = (SELECT auth.uid())
        AND viewer.role = 'centre_admin'
        AND viewer.disabled_at IS NULL
        AND target.role = 'centre_staff'
        AND target.centre_id = viewer.centre_id
    );
$$;

CREATE TABLE public.account_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid NOT NULL,
  subject_user_id uuid,
  centre_id text,
  event_type text NOT NULL CHECK (event_type IN ('account.invited', 'account.updated', 'account.disabled', 'account.enabled', 'account.deleted')),
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.account_audit_events TO authenticated;
GRANT ALL ON public.account_audit_events TO service_role;
ALTER TABLE public.account_audit_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Administrators can read account audit events in their scope"
ON public.account_audit_events
FOR SELECT
TO authenticated
USING (
  public.has_role('super_admin')
  OR (
    public.has_role('centre_admin')
    AND centre_id = public.current_user_centre()
  )
);
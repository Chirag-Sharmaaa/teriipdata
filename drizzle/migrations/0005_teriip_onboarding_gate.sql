CREATE OR REPLACE FUNCTION public.teriip_onboarding_complete()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE((SELECT auth.jwt()) -> 'app_metadata' ->> 'teriip_onboarding', '') = '';
$$;
REVOKE ALL ON FUNCTION public.teriip_onboarding_complete() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.teriip_onboarding_complete() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.has_role(_role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.teriip_onboarding_complete() AND EXISTS (
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
  WHERE user_id = (SELECT auth.uid())
    AND disabled_at IS NULL
    AND public.teriip_onboarding_complete()
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
    OR (public.teriip_onboarding_complete() AND EXISTS (
      SELECT 1
      FROM public.user_roles AS viewer
      JOIN public.user_roles AS target ON target.user_id = _target_user_id
      WHERE viewer.user_id = (SELECT auth.uid())
        AND viewer.role = 'centre_admin'
        AND viewer.disabled_at IS NULL
        AND target.role = 'centre_staff'
        AND target.centre_id = viewer.centre_id
    ));
$$;
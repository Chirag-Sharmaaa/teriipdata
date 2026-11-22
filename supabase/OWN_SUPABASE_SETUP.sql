-- TERIIP independent-Supabase setup
-- Run once in Supabase SQL Editor, in the new project's SQL Editor.
-- The app never needs this file at runtime.

DO $$
BEGIN
  CREATE TYPE public.app_role AS ENUM ('super_admin', 'centre_admin', 'centre_staff');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE,
  email text UNIQUE,
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  centre_id text,
  disabled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_roles_centre_assignment CHECK (
    (role = 'super_admin' AND centre_id IS NULL)
    OR
    (role IN ('centre_admin', 'centre_staff') AND centre_id IN (
      'AIIMS Bhopal', 'Bhatinda', 'Delhi', 'Guwahati', 'Jodhpur', 'Raipur',
      'Kalyani', 'Amrita Kochi', 'BCCI Guwahati', 'NIRRH Port Blair',
      'JSS Mysore', 'KGMU Lucknow', 'KIMS Bhubaneswar', 'KMC Manipal',
      'P D Hinduja', 'PGIMER Chandigarh'
    ))
  )
);

CREATE TABLE IF NOT EXISTS public.account_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid NOT NULL,
  subject_user_id uuid,
  centre_id text,
  event_type text NOT NULL CHECK (
    event_type IN (
      'account.invited',
      'account.updated',
      'account.disabled',
      'account.enabled',
      'account.deleted'
    )
  ),
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_audit_events ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
GRANT SELECT ON public.account_audit_events TO authenticated;
GRANT ALL ON public.account_audit_events TO service_role;

CREATE OR REPLACE FUNCTION public.teriip_onboarding_complete()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE((auth.jwt()) -> 'app_metadata' ->> 'teriip_onboarding', '') = '';
$$;

CREATE OR REPLACE FUNCTION public.has_role(_role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.teriip_onboarding_complete()
    AND EXISTS (
      SELECT 1
      FROM public.user_roles
      WHERE user_id = auth.uid()
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
  SELECT centre_id
  FROM public.user_roles
  WHERE user_id = auth.uid()
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
    OR (
      public.teriip_onboarding_complete()
      AND EXISTS (
        SELECT 1
        FROM public.user_roles AS viewer
        JOIN public.user_roles AS target ON target.user_id = _target_user_id
        WHERE viewer.user_id = auth.uid()
          AND viewer.role = 'centre_admin'
          AND viewer.disabled_at IS NULL
          AND target.role = 'centre_staff'
          AND target.centre_id = viewer.centre_id
      )
    );
$$;

REVOKE ALL ON FUNCTION public.teriip_onboarding_complete() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_role(public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.current_user_centre() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_manage_user(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.teriip_onboarding_complete() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_role(public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_user_centre() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_manage_user(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.create_teriip_profile_for_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    NULLIF(BTRIM(COALESCE(NEW.raw_user_meta_data ->> 'name', NEW.raw_user_meta_data ->> 'full_name')), '')
  )
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.create_teriip_profile_for_auth_user() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS teriip_profile_after_auth_user_created ON auth.users;
CREATE TRIGGER teriip_profile_after_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.create_teriip_profile_for_auth_user();

CREATE OR REPLACE FUNCTION public.sync_teriip_profile_auth_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.profiles SET email = NEW.email WHERE id = NEW.id;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.sync_teriip_profile_auth_email() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS teriip_profile_after_auth_email_changed ON auth.users;
CREATE TRIGGER teriip_profile_after_auth_email_changed
AFTER UPDATE OF email ON auth.users
FOR EACH ROW
WHEN (OLD.email IS DISTINCT FROM NEW.email)
EXECUTE FUNCTION public.sync_teriip_profile_auth_email();

REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (username, display_name) ON public.profiles TO authenticated;

DROP POLICY IF EXISTS "Users can read their own profile and administrators can read managed profiles" ON public.profiles;
CREATE POLICY "Users can read their own profile and administrators can read managed profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (id = auth.uid() OR public.can_manage_user(id));

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "Users can read their own role and administrators can read managed roles" ON public.user_roles;
CREATE POLICY "Users can read their own role and administrators can read managed roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR public.can_manage_user(user_id));

DROP POLICY IF EXISTS "Administrators can read account audit events in their scope" ON public.account_audit_events;
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

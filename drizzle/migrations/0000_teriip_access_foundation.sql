CREATE TYPE public.app_role AS ENUM ('super_admin', 'centre_admin', 'centre_staff');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE,
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  centre_id text,
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
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = (SELECT auth.uid()) AND role = _role
  );
$$;

CREATE OR REPLACE FUNCTION public.current_user_centre()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT centre_id FROM public.user_roles WHERE user_id = (SELECT auth.uid()) LIMIT 1;
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
        AND target.role = 'centre_staff'
        AND target.centre_id = viewer.centre_id
    );
$$;

REVOKE ALL ON FUNCTION public.has_role(public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.current_user_centre() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_manage_user(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_user_centre() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_manage_user(uuid) TO authenticated, service_role;

CREATE POLICY "Users can read their own profile and administrators can read managed profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (id = (SELECT auth.uid()) OR public.can_manage_user(id));

CREATE POLICY "Users can read their own role and administrators can read managed roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (user_id = (SELECT auth.uid()) OR public.can_manage_user(user_id));

CREATE OR REPLACE FUNCTION public.create_teriip_profile_for_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (
    NEW.id,
    NULLIF(BTRIM(COALESCE(NEW.raw_user_meta_data ->> 'name', NEW.raw_user_meta_data ->> 'full_name')), '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.create_teriip_profile_for_auth_user() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER teriip_profile_after_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.create_teriip_profile_for_auth_user();
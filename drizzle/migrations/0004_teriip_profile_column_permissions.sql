REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (username, display_name) ON public.profiles TO authenticated;

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

CREATE TRIGGER teriip_profile_after_auth_email_changed
AFTER UPDATE OF email ON auth.users
FOR EACH ROW
WHEN (OLD.email IS DISTINCT FROM NEW.email)
EXECUTE FUNCTION public.sync_teriip_profile_auth_email();
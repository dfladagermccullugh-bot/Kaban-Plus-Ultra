-- 0008_restore_auth_trigger_grants.sql
-- Followup to 0007. Revoking EXECUTE from PUBLIC on the auth-trigger functions
-- in 0007 inadvertently took `supabase_auth_admin` with it (no explicit grant
-- to that role + PUBLIC was the only path it had). Without EXECUTE,
-- supabase_auth_admin can't fire the triggers on auth.users INSERT/UPDATE, so
-- signups would fail.
--
-- Restore EXECUTE explicitly to `supabase_auth_admin` only. PUBLIC, anon, and
-- authenticated remain revoked, so the RPC surface stays closed.

grant execute on function public.on_auth_user_created() to supabase_auth_admin;
grant execute on function public.on_auth_user_email_updated() to supabase_auth_admin;

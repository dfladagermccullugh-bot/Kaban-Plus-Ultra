-- 0007_revoke_rpc_grants.sql
-- Lock down accidentally-exposed SECURITY DEFINER functions so they can't be
-- called as PostgREST RPCs by anon / authenticated clients.
--
-- The two auth-trigger functions (`on_auth_user_created`,
-- `on_auth_user_email_updated`) are only meant to fire as `auth.users`
-- triggers. They never need to be callable from anon/authenticated, and the
-- default PUBLIC grant let `/rest/v1/rpc/on_auth_user_*` reach them. Triggers
-- continue to fire as `supabase_auth_admin`, which retains EXECUTE.
--
-- The share-token RPCs (`rotate_share_token`, `revoke_share_token`) are only
-- meant to be called by authenticated server actions — the body of each
-- function already enforces `boards.owner_id = auth.uid()` — but the default
-- PUBLIC grant let anon also call them. Authenticated keeps its explicit
-- grant from migration 0005.
--
-- `has_board_access` / `has_share_access` are intentionally left as-is: they
-- are evaluated inline by RLS policies under both anon (share-token reads)
-- and authenticated roles, so revoking EXECUTE would break those policies.
-- The corresponding Supabase advisor lints
-- (0028_anon_security_definer_function_executable +
-- 0029_authenticated_security_definer_function_executable) for those two
-- helpers are accepted; see ADR 0020.

revoke execute on function public.on_auth_user_created() from public, anon, authenticated;
revoke execute on function public.on_auth_user_email_updated() from public, anon, authenticated;

revoke execute on function public.rotate_share_token(uuid) from public, anon;
revoke execute on function public.revoke_share_token(uuid) from public, anon;

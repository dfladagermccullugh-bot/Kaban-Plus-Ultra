import 'server-only';

import { createAdmin } from '@/lib/supabase/admin';

export type AuditKind =
  | 'collaborator.invite'
  | 'collaborator.role_update'
  | 'collaborator.remove'
  | 'share_link.rotate'
  | 'share_link.revoke';

type Payload = Record<string, unknown>;

/**
 * Append an audit-event row using the service-role client. The `audit_events`
 * table has no public INSERT policy by design — only server actions write to
 * it. Audit-write failures are logged but never bubble up to the caller, so a
 * successful invite/role-change is never blocked by an audit hiccup.
 */
export async function recordAuditEvent(
  boardId: string,
  actorId: string,
  kind: AuditKind,
  payload: Payload = {},
): Promise<void> {
  try {
    const admin = createAdmin();
    const { error } = await admin
      .from('audit_events')
      .insert({ board_id: boardId, actor_id: actorId, kind, payload: payload as never });
    if (error) console.error('audit_events insert failed', { kind, error: error.message });
  } catch (err) {
    console.error('audit_events insert threw', { kind, err });
  }
}

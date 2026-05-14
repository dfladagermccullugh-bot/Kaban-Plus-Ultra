import { ThemeToggle } from '@/components/theme-toggle';
import { LayoutGrid } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy Policy — Kaban Plus Ultra',
  description:
    'How Kaban Plus Ultra collects, stores, and protects your data. Stub draft — requires human review before publication.',
};

const LAST_UPDATED = '2026-05-14';

export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-8">
      <header className="flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <LayoutGrid size={20} strokeWidth={1.5} className="text-accent" aria-hidden />
          <span className="text-sm font-semibold">Kaban Plus Ultra</span>
        </Link>
        <ThemeToggle />
      </header>

      <article className="prose prose-sm mt-12 max-w-none text-text">
        <h1 className="text-3xl font-semibold">Privacy Policy</h1>
        <p className="text-xs uppercase tracking-wide text-text-muted">
          Draft — last updated {LAST_UPDATED}. Pending legal review before v1.0 ships.
        </p>

        <Section heading="1. Who runs this service">
          <p>
            Kaban Plus Ultra (&ldquo;KPU&rdquo;, &ldquo;we&rdquo;, &ldquo;the service&rdquo;) is an
            open-source kanban board app. The hosted version at the canonical KPU domain is operated
            by the project maintainers. The same codebase can also be self-hosted under the
            operator&rsquo;s own domain &mdash; in which case the operator becomes the data
            controller and this policy is a template they may adapt.
          </p>
        </Section>

        <Section heading="2. What we collect">
          <ul>
            <li>
              <strong>Account data.</strong> Your email address (required for magic-link sign-in
              and, if enabled, Google OAuth), a display name, and an optional accent color and
              avatar image.
            </li>
            <li>
              <strong>Board content.</strong> Boards, rows, columns, cards, card bodies (Markdown),
              labels, and any images you upload. This is the data you came here to store; we treat
              it as yours.
            </li>
            <li>
              <strong>Collaboration metadata.</strong> Who has access to which board, role
              assignments, share-link tokens, and an <code>audit_events</code> log of
              membership-changing actions (invite, role update, share-link rotate/revoke).
            </li>
            <li>
              <strong>Technical data.</strong> Session cookies (HTTP-only,
              <code>SameSite=Lax</code>), short-lived refresh tokens, the standard request metadata
              logged by Supabase (IP, user agent, timestamp) for security and abuse prevention.
            </li>
          </ul>
          <p>
            We do <strong>not</strong> log card bodies or image contents. Card bodies can contain
            anything, and we treat their bitstream as opaque.
          </p>
        </Section>

        <Section heading="3. What we do not collect">
          <ul>
            <li>No third-party analytics, ad networks, or tracking pixels.</li>
            <li>No fingerprinting beyond the session cookie required to keep you signed in.</li>
            <li>
              No reading or scanning of card contents for profiling, training, or advertising.
            </li>
          </ul>
        </Section>

        <Section heading="4. How we use what we collect">
          <ul>
            <li>To authenticate you and keep your session active.</li>
            <li>To render your boards and route changes to your collaborators in real time.</li>
            <li>
              To enforce access control. Every authorization decision is made by Postgres Row-Level
              Security; the client never holds a credential that can bypass it.
            </li>
            <li>
              To investigate abuse or security incidents (using the audit log and Supabase request
              logs).
            </li>
          </ul>
        </Section>

        <Section heading="5. Where the data lives">
          <p>
            The hosted KPU service stores data in Supabase (managed Postgres + object storage).
            Self-hosted deployments store data in whichever Postgres + object store the operator
            wires up &mdash; by default, the upstream <code>supabase/supabase</code> compose stack
            running on the operator&rsquo;s own server.
          </p>
          <p>
            Images you upload land in the <code>card-images</code> bucket and are served via signed
            URLs with a 7-day expiry; the storage path is scoped per board and access is checked by
            RLS on every read.
          </p>
        </Section>

        <Section heading="6. Sharing and disclosure">
          <ul>
            <li>
              <strong>Collaborators you invite.</strong> Anyone you invite to a board sees the
              boards, rows, columns, cards, labels, and images on that board, plus the display names
              and avatars of other collaborators on it.
            </li>
            <li>
              <strong>Public share links.</strong> When you generate a share link, anyone with the
              link can read that board until you rotate or revoke the link. Share links are
              read-only.
            </li>
            <li>
              <strong>Service providers.</strong> Supabase (hosted DB + storage + auth) and our
              transactional email provider for magic links. We don&rsquo;t sell or rent your data to
              anyone.
            </li>
            <li>
              <strong>Legal.</strong> We disclose data only when required by a valid legal process,
              and we challenge overbroad requests where we can.
            </li>
          </ul>
        </Section>

        <Section heading="7. Retention">
          <ul>
            <li>
              <strong>Account &amp; board data:</strong> kept as long as your account exists. Delete
              an item to remove it; delete your account to remove everything.
            </li>
            <li>
              <strong>Session cookies:</strong> until you sign out or they expire (refresh tokens
              are short-lived; sign-out revokes them server-side).
            </li>
            <li>
              <strong>Supabase request logs:</strong> 7&ndash;30 days depending on the hosting tier.
            </li>
            <li>
              <strong>Audit events:</strong> retained for the lifetime of the workspace so
              membership changes remain inspectable.
            </li>
          </ul>
        </Section>

        <Section heading="8. Your rights">
          <p>You can, at any time:</p>
          <ul>
            <li>
              <strong>Access</strong> &mdash; export your boards via the in-app &ldquo;Export&rdquo;
              button. You receive a <code>.zip</code> of Markdown files that round-trips back into
              the app.
            </li>
            <li>
              <strong>Correct</strong> &mdash; edit any of your boards, cards, or profile fields
              in-app.
            </li>
            <li>
              <strong>Delete</strong> &mdash; delete boards individually, or request full account
              deletion by emailing the address below.
            </li>
            <li>
              <strong>Object / restrict / portability</strong> &mdash; the Markdown export is the
              portability path. For anything else, reach out at the address below.
            </li>
          </ul>
        </Section>

        <Section heading="9. Children">
          <p>
            KPU is not directed at children under 13 (or under 16 in jurisdictions where that is the
            applicable threshold). We do not knowingly collect data from children.
          </p>
        </Section>

        <Section heading="10. Security">
          <ul>
            <li>All traffic is HTTPS; the self-host stack ships with Caddy auto-HTTPS.</li>
            <li>Authorization is enforced in Postgres via RLS, not in client code.</li>
            <li>The service-role key never leaves the server.</li>
            <li>Uploaded images are validated (MIME, dimensions, EXIF-stripped) before storage.</li>
            <li>
              See <code>docs/SECURITY.md</code> in the source tree for the full threat model.
            </li>
          </ul>
        </Section>

        <Section heading="11. Changes to this policy">
          <p>
            We&rsquo;ll update the &ldquo;last updated&rdquo; date at the top of this page when
            anything material changes. Significant changes will be announced in-app before they take
            effect.
          </p>
        </Section>

        <Section heading="12. Contact">
          <p>
            For privacy questions or account-deletion requests, email{' '}
            <code>privacy@kabanplusultra.app</code>. For security disclosures, email{' '}
            <code>security@kabanplusultra.app</code>. Self-hosted operators should substitute their
            own contact addresses.
          </p>
        </Section>

        <p className="mt-12 rounded-sm border border-border bg-surface-2 p-4 text-xs text-text-muted">
          <strong>Stub status:</strong> this draft is derived from <code>docs/SECURITY.md</code> and
          the v1 product surface. It needs human legal review before the App Store / Play Store
          submission. Replace the contact addresses and the operator name in &sect;1 with the real
          ones before linking from store listings.
        </p>
      </article>

      <footer className="mt-12 pt-8 text-xs text-text-muted">
        <Link href="/" className="hover:text-text">
          ← Back to home
        </Link>
      </footer>
    </main>
  );
}

function Section({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold">{heading}</h2>
      <div className="mt-2 space-y-3 text-sm text-text-muted">{children}</div>
    </section>
  );
}

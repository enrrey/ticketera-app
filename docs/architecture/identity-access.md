# Clerk and PostgreSQL access

The user corrected the designated super-admin email to **ronaldreyesramirez@gmail.com** (with z). Earlier emails are not bootstrap targets. That exact verified account has been synchronized from Clerk and pinned in `super_admin_assignment`.

Clerk owns credentials and sessions. Every authenticated page request resolves the current Clerk user on the server, upserts the local profile by `clerk_user_id`, preserves assigned roles and retrieves effective permissions from PostgreSQL. Verified current Clerk emails claim only guest orders whose `user_id` is still null. The application never grants privileges from client metadata or a form-submitted email.

## Managing staff

Sign in with the designated account and open `/administracion/usuarios`. The header exposes Administración for a super admin and Organizador for users with `events.manage`.

The super admin invites administrators/organizers by email using Clerk application invitations. The admin supplies name, email, roles and individual permissions; no password is requested. Clerk sends a seven-day invitation linking to `APP_URL` (local default `http://localhost:3000`). The home page recognizes Clerk's invitation ticket and displays its existing authentication UI, returning registration/login to `/`. Pending access lives in PostgreSQL and is applied once after canonical Clerk acceptance with matching verified email. Existing accounts are managed through the CRUD instead of being recreated. See [staff invitations](./staff-invitations.md) for recovery and trust boundaries.

The management screen edits administrator/organizer assignments and per-user overrides: inherit from roles, explicitly allow, or explicitly deny. Only super admin can use `staff.manage`; that permission cannot be delegated through an override. The super-admin identity is pinned to its stable local user UUID, protected from accidental removal, and is not reassigned when another Clerk identity later matches the configured email.

Default permissions:

| Role | Permissions |
| --- | --- |
| customer | Read own tickets |
| organizer | Manage/publish events, check in tickets, read own tickets |
| admin | Organizer permissions plus refunds and settlements |
| super_admin | All permissions and staff management |

Admin/organizer scope is global, as established in the system design. Permission checks happen on the server; navigation visibility is only a convenience. Staff mutations additionally validate their origin and input and record an audit entry. `GET /api/me` exposes only the authenticated user's application access. Staff management APIs require super admin. `/organizador` requires `events.manage`; `/mis-entradas` requires `tickets.read_own`. Those pre-existing business screens still show demonstration data.

## Clerk lifecycle

`POST /api/webhooks/clerk` verifies signatures with `CLERK_WEBHOOK_SIGNING_SECRET`, fetches the canonical current Clerk profile and reconciles it atomically with a deduplicated `webhook_event`. Subscribe to `user.created`, `user.updated`, `user.deleted` in the Clerk Dashboard and set that endpoint's signing secret for external webhook delivery. Local synchronization on authenticated requests works independently of webhook setup. No production endpoint or signing secret is fabricated.

Deleted Clerk accounts are deactivated locally, not deleted in cascade. Deactivation advances the identity timestamp under the same advisory lock as profile synchronization, so an older profile snapshot cannot resurrect the account. Banned/locked Clerk accounts are inactive and receive no effective permissions. Role/permission changes take effect on the next protected request; they are not cached in browser claims.

## Commands and seed restriction

`npm run db:bootstrap:super-admin` retrieves only the exact verified designated Clerk identity and synchronizes it. It does not create that identity or create events. Access-schema migration seeds the role/permission catalogs only.

The separate [event seed](./event-seed.md) remains unexecuted. It requires an explicit active organizer UUID and creates draft events only. No event seed is called by migration, bootstrap, authentication, build or application startup.

Verification uses real SQL migrations in isolated PGlite databases, canonical-Clerk/signature/API tests, staff UI tests and `node scripts/verify-access.mjs` for local HTTP denial, real super-admin state and proof that the real event/session/inventory tables remain empty. The script is a one-time development assertion; after an explicitly authorized future event seed its empty-table assertion is intentionally no longer applicable.

References: [Clerk user reading](https://clerk.com/docs/nextjs/guides/users/reading), [Clerk invitations](https://clerk.com/docs/reference/backend/invitations/create-invitation), [Clerk webhook synchronization](https://clerk.com/docs/guides/development/webhooks/syncing).

# User management

The approved responsive panel is available at `/administracion/usuarios`. Its shared navigation also wraps `/organizador`; links follow the authenticated user's effective PostgreSQL permissions. Pending operational sections are clearly labeled and do not navigate to placeholder routes.

Only the active pinned super admin can call these endpoints. Every mutation checks the same-origin header and validates its body; the database rechecks actor and target access under row locks.

- `GET /api/admin/users`: literal case-insensitive name/email search (`search`), role/status filters (`role`, `status`), team/customer grouping (`kind`), deterministic server pagination (`page`, `pageSize`, maximum 50). Returns `users`, `total`, `page`, `pageSize`, permission descriptions.
- `POST /api/admin/users`: sends a Clerk email invitation with pending admin/organizer roles and individual permissions. Passwords are entered by the invitee in Clerk. Existing accounts are edited rather than recreated. See [staff invitations](./staff-invitations.md).
- `GET /api/admin/users/:id`: reads one non-archived profile and its access.
- `PATCH /api/admin/users/:id`: edits name through Clerk, and roles/overrides/administrative status through PostgreSQL. Preserves the customer's base role. Email is read-only, managed by Clerk's ownership-verification flow.
- `DELETE /api/admin/users/:id`: archives the application profile, blocks Ticketera permissions and records an audit event. Does not delete Clerk identity, purchases, organizer relations or financial history. Archived profiles disappear from CRUD results and cannot be reactivated through this panel.

Migration `0002_fast_red_wolf.sql` adds `identity_disabled`, `admin_disabled` and `deleted_at` without removing data. Migration `0003_preserve_legacy_suspension.sql` conservatively initializes existing inactive profiles as administratively suspended. Canonical Clerk updates refresh provider status but cannot override administrative suspension or archival. Reactivating a locally suspended profile does not override a Clerk ban or lock. Every super-admin account is protected from changes; only the pinned primary assignment receives user-management permission.

Client interactions reuse shadcn Sheet for keyboard focus, dismissal and mobile navigation. Filters debounce requests and abort stale responses; pagination is bounded and clamps when the last row is removed. Mutations retain input and display provider/API errors. The invitation form collects no passwords, and none are stored in PostgreSQL or audit metadata.

Operational recovery: name changes may succeed in Clerk before an access update fails. Reload the profile, then retry access settings; synchronization preserves the provider name. Invitation retries reconcile delivery with Clerk using the persisted invitation ID rather than creating a second account. No event seed or live test account is executed by verification.

# Clerk identity, staff access and prepared event seed

Status: implementation authorized by the user-provided active goal. This specifies the requested scope; it does not authorize running the event seed.

Clerk owns accounts, passwords, Google sign-in and verified emails. PostgreSQL owns application profiles, roles, per-role permissions and per-user allow/deny overrides. Only super admin can create administrators/organizers and edit their roles or permissions. The designated verified Clerk email is `ronaldreyesramirez@gmail.com`; bootstrap pins its stable local user identity once, never trusts browser metadata and never grants super admin by a submitted email.

Signed-in requests resolve the Clerk user in the backend and synchronize the local profile idempotently. New users are customers. Existing assigned roles remain intact. Verified emails link guest orders without replacing existing owners. Signed Clerk webhooks reconcile canonical current user data; deleted accounts are deactivated without deleting financial history. Revocations are checked in PostgreSQL on each protected request.

The super-admin UI at `/administracion/usuarios` can create Clerk accounts with supplied initial passwords (kept only in Clerk), assign administrator/organizer roles, and configure explicit permission overrides. Account creation uses reserved/unverified email identifiers, not an invented verification. It does not send email invitations automatically. Existing accounts can also be assigned roles. Passwords never appear in responses, audit metadata or PostgreSQL. Failure between Clerk creation and DB assignment is surfaced and recoverable by syncing/assigning the existing account.

Global organizer/admin roles follow the approved system design. Server protection covers organizer routes, personal tickets, staff APIs and management UI. A regular customer cannot escalate, forge roles or manage privileged accounts. Super admin is protected from accidental removal and only the pinned account receives that role automatically.

Event seed: reuse existing static catalog, require an explicit active organizer, insert drafts, preserve known dates, mark provisional times clearly, avoid invented inventory/prices, and rerun without duplication. Prepare scripts and tests; do not run against the configured database.

Acceptance evidence: isolated PostgreSQL tests for idempotent sync, verified-email bootstrap, immutable identity pin, preserved roles, permissions and revocation, authorized staff management, guest ownership, webhook failures/deletions/duplicates; route checks proving unauthenticated/forbidden access; frontend tests for staff creation and permissions; migration applied/verified and actual designated Clerk identity synchronized if present; seed tests only with isolated data and proof real events remain unchanged.

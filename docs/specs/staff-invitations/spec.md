# Staff invitations

Status: APPROVED — user requested email invitations accepted through Clerk and returning to localhost:3000, 2026-10-02.

Replace direct staff-account/password creation with Clerk application invitations. Only the designated active super admin can invite admin/organizer roles. Use `notify: true`, seven-day expiry, and server-configured app origin (`APP_URL`, default `http://localhost:3000`), without accepting redirect URLs from request bodies.

The home route must embed the existing Clerk SignIn/sign-up UI when the provider invitation ticket is present, then force successful authentication back to `/`. Passwords are collected by Clerk, never by the admin. Existing users are managed through their existing CRUD instead of being recreated.

Persist invitation intent and access settings before sending, reference only its local ID in backend-controlled Clerk public metadata. Grant its stored roles/overrides once, transactionally, only from a canonical Clerk profile with matching verified email and invitation ID, unexpired local invitation and an authorized inviter. Do not allow client metadata, unrelated verified users, expired invitations, archived accounts or repeated synchronization to grant access. Signed Clerk webhooks and authenticated requests both reconcile acceptance.

API and UI show invitation sent/pending feedback; the profile enters the user list after registration. Preserve duplicate-send protection and recover provider/database partial failures on retry. Do not send test emails to real recipients during verification.

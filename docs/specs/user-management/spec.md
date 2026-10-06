# User management

Status: APPROVED — user requested implementation of the reviewed CRUD prototype on 2026-10-02.

Implement the approved responsive user list with shared panel navigation, name/email search, role/status filters, all/team/customer tabs, server pagination, detail/create/edit sheets and confirmed logical deletion. Only the pinned active super admin may manage accounts. Creation supports administrators and organizers; customers already synchronized from Clerk can be viewed, edited and assigned staff access. Preserve customer assignments and protect all super-admin identities from updates/deletion.

Edit name through Clerk and role/permission/status through PostgreSQL. Email is read-only: do not bypass Clerk ownership verification. A manually inactive or deleted account must remain blocked after request/webhook synchronization. Logical deletion preserves purchases, organizer references and audit history; it removes the account from lists and cannot be undone through this CRUD. Do not execute the event seed or create test accounts in the configured Clerk project.

Acceptance: anonymous/unauthorized requests fail; origin checks and strict validation apply to writes; protected identities cannot be modified; list queries filter before paging with stable ordering and bounded page size; errors remain visible; forms retain input on failure; mobile navigation and sheets are keyboard-accessible using existing shadcn Sheet, Button and Input. Verify with isolated database/API/component tests, full tests, typecheck and lint.

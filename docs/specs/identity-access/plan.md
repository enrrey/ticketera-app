# Identity access implementation plan

1. Add permission, role_permission, user_permission and singleton super_admin_assignment tables; generate additive migration with role/permission defaults. Do not run any event seed.
2. Implement transactional synchronization and authorization using canonical Clerk identity, verified email ownership and PostgreSQL assignments. Add isolated integration tests before implementation.
3. Implement backend Clerk request resolver, signed webhook reconciliation, staff management APIs and protected pages; add super-admin UI and tests.
4. Prepare independent organizer-required draft-event seed (delegated with exclusive file ownership).
5. Apply only access-schema migration, synchronize the designated existing verified Clerk identity, run typecheck/lint/full tests and HTTP authorization checks. Review security against the objective and retain unresolved work in the active goal.

## Verification completed

- Applied the access migration and bootstrapped the verified Clerk account `ronaldreyesramirez@gmail.com` as the pinned, active super admin (user-corrected address).
- Full suite: 19 files, 89 tests passed. Typecheck and lint passed.
- Security review found a case-sensitive guest-email comparison; corrected it and reran all six identity-store tests, typecheck and lint successfully.
- Verified anonymous API requests return 401 and the administration page redirects to sign-in.
- Confirmed the configured database still contains zero events, event sessions and ticket types; the organizer-required seed remains unexecuted.
- Clerk webhook code and signed-request tests are ready; Dashboard endpoint registration and its signing secret are documented separately. Authenticated requests synchronize profiles without depending on that setup.

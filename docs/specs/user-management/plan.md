# Implementation plan

1. Add isolated regression tests for paginated filters, persistent administrative suspension, logical deletion and protected CRUD endpoints.
2. Add additive user suspension/deletion fields and migration; extend identity synchronization, store queries and staff APIs without weakening server authorization.
3. Replace the current forms with the approved responsive panel, filtered/paginated real list and accessible management sheets. Reuse existing UI components; expose module client entry points.
4. Apply the additive migration, verify records and seed remain preserved, run focused and full verification. Do not mutate real Clerk accounts during testing.

## Completed verification

- Responsive shared panel navigation integrated into administration and organizer layouts. Users use server-filtered pagination and accessible create/detail/edit/delete sheets.
- Migrations 0002 and 0003 applied successfully. Read-only database checks confirmed all three new fields, the active designated super admin and zero seeded events/sessions/inventory.
- Independent security review identified unpinned super-role management and legacy inactive-account resurrection. Both were reproduced in isolated failing tests and corrected; the follow-up review found no blockers.
- Final suite: 20 files and 100 tests passed. Typecheck, lint and optimized Next.js production build passed.
- Real anonymous GET/POST collection requests and GET/PATCH/DELETE detail requests returned 401; administration redirected to sign-in.
- No test identities created or deleted in the real Clerk project, no event seed executed, and no unrelated local changes reverted.

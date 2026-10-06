# Plan

1. Write regressions for email invitation response without password, root Clerk ticket handling and one-time verified identity acceptance.
2. Add invitation-intent table/migration; implement Clerk email invitation service and canonical-identity acceptance in existing synchronization.
3. Update API/form labels, remove admin password entry and render existing Clerk UI at the root invitation callback.
4. Apply additive migration; verify isolated tests, full suite, lint/typecheck/build and anonymous HTTP authorization. Avoid live email sends or seed execution.

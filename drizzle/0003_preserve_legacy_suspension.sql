-- Preserve existing suspension conservatively: provider synchronization cannot
-- determine whether an old inactive row was disabled by a local administrator.
UPDATE "user" SET "admin_disabled" = true WHERE "status" = 'inactive';

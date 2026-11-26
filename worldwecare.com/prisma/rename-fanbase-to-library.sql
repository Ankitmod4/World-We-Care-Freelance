-- Fanbase → Library: rename the tables and columns IN PLACE.
--
-- WHY THIS EXISTS. `prisma db push` does not know a rename from a
-- deletion. Faced with a schema that no longer mentions `fanbases`, it
-- drops that table and creates `library_themes` — and every
-- collection, follow and clip link goes with it. Running this first
-- means db push finds the tables already named correctly and has
-- nothing destructive left to do.
--
-- Run it BEFORE `npx prisma db push`:
--   mysql -u <user> -p <database> < prisma/rename-fanbase-to-library.sql
--
-- Safe to run once. Running it twice fails on the first statement
-- because the old table is gone by then, which is the correct outcome —
-- it means the rename already happened.
--
-- If you would rather not bother: the alternative is to let db push
-- drop them and re-run `npm run db:seed-library`. That is fine if the
-- only data there is seeded, and wrong the moment a real member has
-- followed a theme.

-- 1. The themes themselves.
RENAME TABLE `fanbases` TO `library_themes`;

-- 2. The follows: table, then the column that points at a theme.
RENAME TABLE `fanbase_follows` TO `theme_follows`;
ALTER TABLE `theme_follows`
  CHANGE COLUMN `fanbaseId` `themeId` VARCHAR(191) NOT NULL;

-- 3. The clips' link back to their theme.
ALTER TABLE `clips`
  CHANGE COLUMN `fanbaseId` `themeId` VARCHAR(191) NOT NULL;

-- Indexes and foreign keys follow their columns automatically in
-- MySQL, so there is nothing to rebuild. `db push` will reconcile the
-- index NAMES afterwards if it cares to; the data is what matters and
-- it has not moved.

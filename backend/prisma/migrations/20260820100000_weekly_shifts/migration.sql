-- Постоянный недельный график вместо календарных дат.
--
-- Смена привязывалась к дате, и график приходилось расставлять заново каждую
-- неделю. На участке он повторяется: храним день недели, 0 — понедельник.
--
-- Записей в таблице нет ни одной, поэтому переносить нечего.
DELETE FROM "PlannedShift";
DROP INDEX IF EXISTS "PlannedShift_siteId_date_idx";
DROP INDEX IF EXISTS "PlannedShift_userId_date_key";
ALTER TABLE "PlannedShift" DROP COLUMN "date";
ALTER TABLE "PlannedShift" ADD COLUMN "weekday" INTEGER NOT NULL;
CREATE UNIQUE INDEX "PlannedShift_userId_weekday_key" ON "PlannedShift"("userId", "weekday");
CREATE INDEX "PlannedShift_siteId_weekday_idx" ON "PlannedShift"("siteId", "weekday");

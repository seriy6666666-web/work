-- План на смену у операции и день у назначения.
--
-- Раньше дня в системе не было вовсе: назначение висело бессрочно, доска
-- показывала вчерашние вперемешку с сегодняшними, а у отметки выработки лимит в
-- два исправления — то есть на многодневном назначении рабочий упирался в него
-- на третий день и больше не мог отчитаться. Задание изначально задумывалось на
-- смену, теперь это закреплено в данных.

-- Сколько участок должен сделать за смену. Пусто у существующих операций:
-- планировщик проставит сам, до тех пор всё работает как раньше.
ALTER TABLE "Operation" ADD COLUMN "dailyQuantity" INTEGER;

-- День назначения. Существующим проставляем день их создания, чтобы история не
-- поехала: назначение, выданное вчера, вчерашним и останется.
ALTER TABLE "Assignment" ADD COLUMN "date" DATE;
UPDATE "Assignment" SET "date" = ("createdAt" AT TIME ZONE 'UTC')::date WHERE "date" IS NULL;
ALTER TABLE "Assignment" ALTER COLUMN "date" SET NOT NULL;

-- Один человек на операции — одна запись за день. Без дня в ключе того же
-- сборщика нельзя было бы поставить на ту же операцию завтра.
ALTER TABLE "Assignment" DROP CONSTRAINT IF EXISTS "Assignment_operationId_userId_key";
DROP INDEX IF EXISTS "Assignment_operationId_userId_key";
CREATE UNIQUE INDEX "Assignment_operationId_userId_date_key" ON "Assignment"("operationId", "userId", "date");
CREATE INDEX "Assignment_date_idx" ON "Assignment"("date");

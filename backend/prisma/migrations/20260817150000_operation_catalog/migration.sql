-- Справочник операций: разводим «что делаем» и «что человек умеет».
--
-- Раньше операция заказа ссылалась прямо на навык и называлась его именем.
-- Теперь у операции есть своя запись в справочнике, а навык у неё необязателен.
--
-- Существующие данные переносим без потерь: на каждый навык, который где-то
-- используется как операция, заводим одноимённую операцию справочника и
-- сохраняем за ней требование того же навыка. Дальше пользователь сам решит,
-- какие из этих записей были операциями, а какие настоящими квалификациями.

CREATE TABLE "OperationType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "norm" DOUBLE PRECISION,
    "skillId" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OperationType_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OperationType_name_key" ON "OperationType"("name");

ALTER TABLE "OperationType" ADD CONSTRAINT "OperationType_skillId_fkey"
    FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Операция справочника на каждый навык, который уже используется в работе.
-- Норму забираем у навыка: там она и была, и по смыслу это норма операции.
INSERT INTO "OperationType" ("id", "name", "norm", "skillId", "createdAt")
SELECT s.id, s.name, s.norm, s.id, s."createdAt"
FROM "Skill" s
WHERE EXISTS (SELECT 1 FROM "Operation" o WHERE o."skillId" = s.id)
   OR EXISTS (SELECT 1 FROM "ProductOperation" p WHERE p."skillId" = s.id);

-- Переводим операции заказов на справочник.
ALTER TABLE "Operation" ADD COLUMN "operationTypeId" TEXT;
UPDATE "Operation" SET "operationTypeId" = "skillId";
ALTER TABLE "Operation" ALTER COLUMN "operationTypeId" SET NOT NULL;
ALTER TABLE "Operation" DROP CONSTRAINT "Operation_skillId_fkey";
ALTER TABLE "Operation" DROP COLUMN "skillId";
ALTER TABLE "Operation" ADD CONSTRAINT "Operation_operationTypeId_fkey"
    FOREIGN KEY ("operationTypeId") REFERENCES "OperationType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- То же для шагов техкарты.
ALTER TABLE "ProductOperation" ADD COLUMN "operationTypeId" TEXT;
UPDATE "ProductOperation" SET "operationTypeId" = "skillId";
ALTER TABLE "ProductOperation" ALTER COLUMN "operationTypeId" SET NOT NULL;
ALTER TABLE "ProductOperation" DROP CONSTRAINT "ProductOperation_skillId_fkey";
ALTER TABLE "ProductOperation" DROP COLUMN "skillId";
ALTER TABLE "ProductOperation" ADD CONSTRAINT "ProductOperation_operationTypeId_fkey"
    FOREIGN KEY ("operationTypeId") REFERENCES "OperationType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Норма уехала на операцию, у навыка ей делать нечего.
ALTER TABLE "Skill" DROP COLUMN "norm";

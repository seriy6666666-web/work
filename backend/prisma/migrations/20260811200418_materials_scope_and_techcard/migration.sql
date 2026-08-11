-- Material becomes a catalog (stock moves to MaterialStock)
ALTER TABLE "Material" DROP COLUMN "quantity",
DROP COLUMN "lowStockThreshold";

-- Order gets project + platform (to know which stock to consume)
ALTER TABLE "Order" ADD COLUMN     "platformId" TEXT,
ADD COLUMN     "projectId" TEXT;

-- CreateTable
CREATE TABLE "MaterialStock" (
    "id" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lowStockThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "materialId" TEXT NOT NULL,
    "platformId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,

    CONSTRAINT "MaterialStock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperationMaterial" (
    "id" TEXT NOT NULL,
    "quantityPerUnit" DOUBLE PRECISION NOT NULL,
    "productOperationId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,

    CONSTRAINT "OperationMaterial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperationMaterialReq" (
    "id" TEXT NOT NULL,
    "quantityPerUnit" DOUBLE PRECISION NOT NULL,
    "operationId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,

    CONSTRAINT "OperationMaterialReq_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MaterialStock_platformId_projectId_idx" ON "MaterialStock"("platformId", "projectId");

-- CreateIndex
CREATE UNIQUE INDEX "MaterialStock_materialId_platformId_projectId_key" ON "MaterialStock"("materialId", "platformId", "projectId");

-- CreateIndex
CREATE UNIQUE INDEX "OperationMaterial_productOperationId_materialId_key" ON "OperationMaterial"("productOperationId", "materialId");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_platformId_fkey" FOREIGN KEY ("platformId") REFERENCES "Platform"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialStock" ADD CONSTRAINT "MaterialStock_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialStock" ADD CONSTRAINT "MaterialStock_platformId_fkey" FOREIGN KEY ("platformId") REFERENCES "Platform"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialStock" ADD CONSTRAINT "MaterialStock_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperationMaterial" ADD CONSTRAINT "OperationMaterial_productOperationId_fkey" FOREIGN KEY ("productOperationId") REFERENCES "ProductOperation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperationMaterial" ADD CONSTRAINT "OperationMaterial_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperationMaterialReq" ADD CONSTRAINT "OperationMaterialReq_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "Operation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperationMaterialReq" ADD CONSTRAINT "OperationMaterialReq_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

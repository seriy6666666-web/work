-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductOperation" (
    "id" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "productId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "secondarySiteId" TEXT,

    CONSTRAINT "ProductOperation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Product_name_key" ON "Product"("name");

-- AddForeignKey
ALTER TABLE "ProductOperation" ADD CONSTRAINT "ProductOperation_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductOperation" ADD CONSTRAINT "ProductOperation_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductOperation" ADD CONSTRAINT "ProductOperation_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductOperation" ADD CONSTRAINT "ProductOperation_secondarySiteId_fkey" FOREIGN KEY ("secondarySiteId") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;

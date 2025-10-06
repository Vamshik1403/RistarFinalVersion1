-- AlterTable
ALTER TABLE "BillofLading" ADD COLUMN     "cbmWt" TEXT,
ADD COLUMN     "hasNonNegotiableBlGenerated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hasRfsBlGenerated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "shippersealNo" TEXT,
ADD COLUMN     "tareWt" TEXT,
ADD COLUMN     "unit" TEXT,
ALTER COLUMN "consigneeName" DROP NOT NULL,
ALTER COLUMN "notifyPartyName" DROP NOT NULL,
ALTER COLUMN "sealNo" DROP NOT NULL,
ALTER COLUMN "grossWt" DROP NOT NULL,
ALTER COLUMN "netWt" DROP NOT NULL,
ALTER COLUMN "deliveryAgentName" DROP NOT NULL,
ALTER COLUMN "shippersName" DROP NOT NULL;

-- AlterTable
ALTER TABLE "EmptyRepoJob" ALTER COLUMN "gsDate" DROP NOT NULL,
ALTER COLUMN "etaTopod" DROP NOT NULL,
ALTER COLUMN "estimateDate" DROP NOT NULL;

-- AlterTable
ALTER TABLE "MovementHistory" ADD COLUMN     "maintenanceStatus" TEXT;

-- AlterTable
ALTER TABLE "Shipment" ALTER COLUMN "etaTopod" DROP NOT NULL,
ALTER COLUMN "estimateDate" DROP NOT NULL;

-- CreateTable
CREATE TABLE "BlAssignment" (
    "id" SERIAL NOT NULL,
    "shipmentId" INTEGER NOT NULL,
    "blType" TEXT NOT NULL,
    "blIndex" INTEGER NOT NULL,
    "containerNumbers" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BlAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillManagement" (
    "id" SERIAL NOT NULL,
    "invoiceNo" TEXT,
    "invoiceAmount" DOUBLE PRECISION NOT NULL,
    "paidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "dueAmount" DOUBLE PRECISION NOT NULL,
    "shipmentId" INTEGER,
    "billingStatus" TEXT NOT NULL DEFAULT 'Pending',
    "paymentStatus" TEXT NOT NULL DEFAULT 'Unpaid',
    "shipmentNumber" TEXT,
    "shipmentDate" TIMESTAMP(3),
    "customerName" TEXT,
    "portDetails" TEXT,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillManagement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BlAssignment_shipmentId_blType_blIndex_key" ON "BlAssignment"("shipmentId", "blType", "blIndex");

-- CreateIndex
CREATE INDEX "BillManagement_shipmentId_idx" ON "BillManagement"("shipmentId");

-- CreateIndex
CREATE INDEX "BillManagement_invoiceNo_idx" ON "BillManagement"("invoiceNo");

-- AddForeignKey
ALTER TABLE "BlAssignment" ADD CONSTRAINT "BlAssignment_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillManagement" ADD CONSTRAINT "BillManagement_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

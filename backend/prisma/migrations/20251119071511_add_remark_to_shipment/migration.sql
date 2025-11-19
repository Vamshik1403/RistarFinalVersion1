-- DropForeignKey
ALTER TABLE "MovementHistory" DROP CONSTRAINT "MovementHistory_portId_fkey";

-- AlterTable
ALTER TABLE "EmptyRepoJob" ADD COLUMN     "remark" TEXT,
ADD COLUMN     "status" TEXT DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "MovementHistory" ALTER COLUMN "portId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Shipment" ADD COLUMN     "remark" TEXT;

-- AddForeignKey
ALTER TABLE "MovementHistory" ADD CONSTRAINT "MovementHistory_portId_fkey" FOREIGN KEY ("portId") REFERENCES "Ports"("id") ON DELETE SET NULL ON UPDATE CASCADE;

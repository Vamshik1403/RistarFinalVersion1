import { Module } from '@nestjs/common';
import { ShipmentController } from './shipment.controller';
import { ShipmentService } from './shipment.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { BillManagementModule } from '../bill-management/bill-management.module';

@Module({
  imports: [PrismaModule, BillManagementModule],
  controllers: [ShipmentController],
  providers: [ShipmentService]
})
export class ShipmentModule {}

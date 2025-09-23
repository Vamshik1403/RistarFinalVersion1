import { Module } from '@nestjs/common';
import { BillManagementService } from './bill-management.service';
import { BillManagementController } from './bill-management.controller';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [BillManagementController],
  providers: [BillManagementService],
  exports: [BillManagementService],
})
export class BillManagementModule {}

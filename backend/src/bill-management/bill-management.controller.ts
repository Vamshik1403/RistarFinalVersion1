import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
} from '@nestjs/common';
import { BillManagementService } from './bill-management.service';
import { CreateBillManagementDto } from './dto/create-bill-management.dto';
import { UpdateBillManagementDto } from './dto/update-bill-management.dto';

@Controller('bill-management')
export class BillManagementController {
  constructor(private readonly billManagementService: BillManagementService) {}

  @Post()
  create(@Body() createBillManagementDto: CreateBillManagementDto) {
    return this.billManagementService.create(createBillManagementDto);
  }

  @Get()
  findAll() {
    return this.billManagementService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.billManagementService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateBillManagementDto: UpdateBillManagementDto,
  ) {
    return this.billManagementService.update(id, updateBillManagementDto);
  }

  @Patch(':id/billing-status')
  updateBillingStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { billingStatus: string },
  ) {
    return this.billManagementService.updateBillingStatus(id, body.billingStatus);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.billManagementService.remove(id);
  }

  @Get('shipment/:shipmentId')
  findByShipmentId(@Param('shipmentId', ParseIntPipe) shipmentId: number) {
    return this.billManagementService.findByShipmentId(shipmentId);
  }

  @Patch(':id/invoice-details')
  updateInvoiceDetails(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: {
      invoiceNo?: string;
      invoiceAmount?: number;
      paidAmount?: number;
    },
  ) {
    return this.billManagementService.updateInvoiceDetails(id, body);
  }
}

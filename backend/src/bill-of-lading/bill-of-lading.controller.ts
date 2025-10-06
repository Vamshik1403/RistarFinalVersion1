import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  ParseIntPipe,
} from '@nestjs/common';
import { BillOfLadingService } from './bill-of-lading.service';
import { CreateBillOfLadingDto } from './dto/create-bill-of-lading.dto';
import { UpdateBillOfLadingDto } from './dto/update-bill-of-lading.dto';

@Controller('bill-of-lading')
export class BillOfLadingController {
  constructor(private readonly billOfLadingService: BillOfLadingService) {}

  @Post()
  create(@Body() createBillOfLadingDto: CreateBillOfLadingDto) {
    return this.billOfLadingService.create(createBillOfLadingDto);
  }

  @Get()
  findAll() {
    return this.billOfLadingService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.billOfLadingService.findOne(id);
  }

  @Get('shipment/:shipmentId')
  findByShipmentId(@Param('shipmentId', ParseIntPipe) shipmentId: number) {
    return this.billOfLadingService.findByShipmentId(shipmentId);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateBillOfLadingDto: UpdateBillOfLadingDto,
  ) {
    return this.billOfLadingService.update(id, updateBillOfLadingDto);
  }

  @Post('generate/:shipmentId')
  createOrUpdateWithGeneration(
    @Param('shipmentId', ParseIntPipe) shipmentId: number,
    @Body() blData: Omit<CreateBillOfLadingDto, 'shipmentId'>,
  ) {
    return this.billOfLadingService.createOrUpdateWithGeneration(shipmentId, blData);
  }

  @Post('mark-original-generated/:shipmentId')
  markOriginalBLGenerated(@Param('shipmentId', ParseIntPipe) shipmentId: number) {
    return this.billOfLadingService.markOriginalBLGenerated(shipmentId);
  }

  @Post('mark-non-negotiable-generated/:shipmentId')
  markNonNegotiableBLGenerated(@Param('shipmentId', ParseIntPipe) shipmentId: number) {
    return this.billOfLadingService.markNonNegotiableBLGenerated(shipmentId);
  }

  @Post('mark-rfs-generated/:shipmentId')
  markRfsBLGenerated(@Param('shipmentId', ParseIntPipe) shipmentId: number) {
    return this.billOfLadingService.markRfsBLGenerated(shipmentId);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.billOfLadingService.remove(id);
  }
}

import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
  UseGuards,
  Put,
} from '@nestjs/common';
import { ShipmentService } from './shipment.service';
import { CreateShipmentDto } from './dto/create-shipment.dto';
import { UpdateShipmentDto } from './dto/update-shipment.dto';
import { AuthGuard } from '@nestjs/passport';

@Controller('shipment')
export class ShipmentController {
  constructor(private readonly shipmentService: ShipmentService) {}

     @UseGuards(AuthGuard('jwt'))  
  @Post()
  create(@Body() createShipmentDto: CreateShipmentDto) {
    return this.shipmentService.create(createShipmentDto);
  }

  @Get('next-job-number')
  async getNextJobNumber() {
    const jobNumber = await this.shipmentService.getNextJobNumber();
    return { jobNumber };
  }

  @Get(':id/can-edit')
async canEdit(@Param('id') id: string) {
  return this.shipmentService.canEditInventory(Number(id));
}

  
  @Get()
  findAll() {
    return this.shipmentService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.shipmentService.findOne(+id);
  }

  @UseGuards(AuthGuard('jwt'))          
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateShipmentDto: UpdateShipmentDto) {
    return this.shipmentService.update(+id, updateShipmentDto);
  }

   @UseGuards(AuthGuard('jwt'))  
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.shipmentService.remove(+id);
  }

  @Get('quotation/:refNumber')
  getQuotation(@Param('refNumber') refNumber: string) {
    return this.shipmentService.getQuotationDataByRef(refNumber);
  }

     @UseGuards(AuthGuard('jwt'))  
  @Post('mark-cro-generated/:id')
  markCroGenerated(@Param('id', ParseIntPipe) id: number) {
    return this.shipmentService.markCroGenerated(id);
  }

 // --- assignments endpoints (optionally guarded) ---
  @UseGuards(AuthGuard('jwt')) // optional for GET, recommended for PUT
  @Get('assignments/:shipmentId/:blType')
  async getAssignments(
    @Param('shipmentId', ParseIntPipe) shipmentId: number,
    @Param('blType') blType: 'draft' | 'original' | 'seaway',
  ) {
    return this.shipmentService.getBlAssignments(shipmentId, blType);
  }

  @UseGuards(AuthGuard('jwt'))
  @Put('assignments/:shipmentId/:blType')
  async putAssignments(
    @Param('shipmentId', ParseIntPipe) shipmentId: number,
    @Param('blType') blType: 'draft' | 'original' | 'seaway',
    @Body() body: { groups: string[][] },
  ) {
    return this.shipmentService.saveBlAssignments(shipmentId, blType, body.groups || []);
  }
}

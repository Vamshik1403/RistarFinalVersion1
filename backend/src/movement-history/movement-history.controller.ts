import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { MovementHistoryService } from './movement-history.service';
import { AuthGuard } from '@nestjs/passport';

@Controller('movement-history')
export class MovementHistoryController {
  constructor(
    private readonly movementHistoryService: MovementHistoryService,
  ) {}

  @Get('except-available')
  findAllExceptAvailable() {
    return this.movementHistoryService.findAllExceptAvailable();
  }

  @Get()
  async getAllMovementHistory() {
    return this.movementHistoryService.findAll();
  }

  @Get('latest')
  getLatestPerContainer() {
    return this.movementHistoryService.findLatestPerContainer();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.movementHistoryService.findOne(id);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('bulk-create')
  async bulkCreateStatus(
    @Body()
    body: {
      ids: number[];
      newStatus: string;
      jobNumber: string;
      portId?: number;
      addressBookId?: number;
      remarks?: string;
      maintenanceStatus?: string;
      vesselName?: string;
    },
  ) {
    console.log('🚀 Received payload:', body);
    const {
      ids,
      newStatus,
      portId,
      addressBookId,
      remarks,
      maintenanceStatus,
      vesselName,
    } = body;

    const results = await Promise.all(
      ids.map((id) =>
        this.movementHistoryService.createNewStatusEntry(
          id,
          newStatus,
          portId ?? null,
          addressBookId ?? null,
          remarks?.trim() || undefined,
          maintenanceStatus ?? undefined,
          vesselName?.trim() || undefined,
        ),
      ),
    );

    return { message: 'New status entries created', results };
  }

  @Get('by-shipment/:id')
async getByShipment(@Param('id', ParseIntPipe) id: number) {
  return this.movementHistoryService.findAllByShipment(id);
}


  @UseGuards(AuthGuard('jwt'))
@Post('bulk-update')
async bulkUpdate(@Body() dto: any) {
  return this.movementHistoryService.bulkUpdateStatus(
    dto.ids,
    dto.newStatus,
    dto.jobNumber,
    dto.remarks,
    dto.maintenanceStatus,
    dto.vesselName,
    dto.addressBookIdFromClient || dto.addressBookId || null, // ✅ pass depot id
  );
}



  @UseGuards(AuthGuard('jwt'))
  @Patch(':id')
  updateMovement(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: any,
  ) {
    return this.movementHistoryService.updateMovement(id, body);
  }
}

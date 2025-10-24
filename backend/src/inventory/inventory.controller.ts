import { Controller, Get, Post, Body, Patch, Param, Delete, UseInterceptors, UploadedFiles } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { CreateInventoryDto } from './dto/create-inventory.dto';
import { UpdateInventoryDto } from './dto/update-inventory.dto';

@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Post()
create(@Body() data: CreateInventoryDto) {
  return this.inventoryService.create(data);
}

  @Get()
  findAll() {
    return this.inventoryService.findAll();
  }

  @Get('by-status/:status')
  findByStatus(@Param('status') status: string) {
    return this.inventoryService.findByStatus(status);
  }

  @Get('companies/:ownershipType')
  getCompaniesByOwnershipType(@Param('ownershipType') ownershipType: string) {
    return this.inventoryService.getCompaniesByOwnershipType(ownershipType);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.inventoryService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateInventoryDto: UpdateInventoryDto) {
    return this.inventoryService.update(+id, updateInventoryDto);
  }

  @Get(':id/can-delete')
  canDelete(@Param('id') id: string) {
    return this.inventoryService.canDeleteContainer(id);
  }

  @Get(':id/can-edit')
  canEdit(@Param('id') id: string) {
    return this.inventoryService.canEditContainer(id);
  }

  @Post('bulk-edit-status')
  async getBulkEditStatus(@Body() body: { containerIds: number[] }) {
    return this.inventoryService.getBulkEditStatus(body.containerIds);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.inventoryService.remove(id);
  }
}

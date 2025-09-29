// src/leasing-info/leasing-info.service.ts
import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { UpdateLeasingInfoDto } from './dto/update-leasingInfo.dto';
import { LeasingInfoDto } from './dto/create-leasingInfo.dto';


@Injectable()
export class LeasingInfoService {
  constructor(private readonly prisma: PrismaService) {}

async create(data: LeasingInfoDto) {
  try {
    if (
      !data.leasoraddressbookId ||
      !data.onHireDepotaddressbookId ||
      !data.portId ||
      !data.inventoryId
    ) {
      throw new Error("Missing required IDs for creating leasing info.");
    }

    if (!data.onHireDate) {
      throw new Error("Missing onHireDate for creating leasing info.");
    }

    // 🛑 First Guard: Block if container has progressed in movement status (after ALLOTTED)
    // Check only the current/latest status, not the entire movement history
    const movements = await this.prisma.movementHistory.findMany({
      where: { inventoryId: data.inventoryId },
      select: { status: true },
      orderBy: { date: 'asc' },
    });
    const statuses = movements.map(m => m.status);
    const currentStatus = statuses.length > 0 ? statuses[statuses.length - 1] : null;
    
    if (currentStatus && currentStatus !== 'AVAILABLE' && currentStatus !== 'ALLOTTED') {
      // Block if current status is beyond ALLOTTED (EMPTY PICKED UP, LADEN GATE-IN, SOB, LADEN DISCHARGE(ATA), EMPTY RETURNED)
      throw new ConflictException(
        'Cannot change inventory details as the container has progressed in movement status.'
      );
    }

    // 🛑 Second Guard: Block creating/changing on-hire when shipment or empty repo job exists
    const shipmentExists = await this.prisma.shipmentContainer.findFirst({
      where: { inventoryId: data.inventoryId },
      select: { id: true },
    });
    
    const emptyRepoJobExists = await this.prisma.repoShipmentContainer.findFirst({
      where: { inventoryId: data.inventoryId },
      select: { id: true },
    });
    
    if (shipmentExists) {
      throw new ConflictException(
        'Remove the container or Delete the shipment first, then you can change the inventory data.'
      );
    }
    
    if (emptyRepoJobExists) {
      throw new ConflictException(
        'Remove the container or Delete the empty repo job first, then you can change the inventory data.'
      );
    }

    return await this.prisma.leasingInfo.create({
      data: {
        ownershipType: data.ownershipType,
        leasingRefNo: data.leasingRefNo,
        leasoraddressbookId: data.leasoraddressbookId,
        onHireDepotaddressbookId: data.onHireDepotaddressbookId,
        portId: data.portId,
        onHireDate: new Date(data.onHireDate), // ✅ now guaranteed to be a string
        leaseRentPerDay: data.leaseRentPerDay,
        remarks: data.remarks,
        offHireDate: data.offHireDate ? new Date(data.offHireDate) : undefined,
        inventoryId: data.inventoryId,
      },
    });
  } catch (err) {
    console.error("❌ Error in create leasingInfo:", err);
    throw err;
  }
}

  
  findAll() {
    return this.prisma.leasingInfo.findMany({
      include: {
        addressBook: true,
        onHireDepotAddressBook: true,
        port: true,
      },
    });
  }

  findOne(id: number) {
    return this.prisma.leasingInfo.findUnique({
      where: { id },
      include: {
        addressBook: true,
        onHireDepotAddressBook: true,
        port: true,
      },
    });
  }

 async update(id: number, data: UpdateLeasingInfoDto) {
  const existing = await this.prisma.leasingInfo.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new NotFoundException(`LeasingInfo with id ${id} not found`);
  }

  // 🛑 First Guard: Block if container has progressed in movement status (after ALLOTTED)
  // Check only the current/latest status, not the entire movement history
  const movements = await this.prisma.movementHistory.findMany({
    where: { inventoryId: existing.inventoryId },
    select: { status: true },
    orderBy: { date: 'asc' },
  });
  const statuses = movements.map(m => m.status);
  const currentStatus = statuses.length > 0 ? statuses[statuses.length - 1] : null;
  
  if (currentStatus && currentStatus !== 'AVAILABLE' && currentStatus !== 'ALLOTTED') {
    // Block if current status is beyond ALLOTTED (EMPTY PICKED UP, LADEN GATE-IN, SOB, LADEN DISCHARGE(ATA), EMPTY RETURNED)
    throw new ConflictException(
      'Cannot change inventory details as the container has progressed in movement status.'
    );
  }

  // 🛑 Second Guard: Block changing on-hire depot/port if any shipment or empty repo job exists for this inventory
  const shipmentExists = await this.prisma.shipmentContainer.findFirst({
    where: { inventoryId: existing.inventoryId },
    select: { id: true },
  });
  
  const emptyRepoJobExists = await this.prisma.repoShipmentContainer.findFirst({
    where: { inventoryId: existing.inventoryId },
    select: { id: true },
  });
  
  const intendsToChangeOnHire =
    typeof data.portId !== 'undefined' || typeof data.onHireDepotaddressbookId !== 'undefined';
  if (intendsToChangeOnHire && shipmentExists) {
    throw new ConflictException(
      'Remove the container or Delete the shipment first, then you can change the inventory data.'
    );
  }
  
  if (intendsToChangeOnHire && emptyRepoJobExists) {
    throw new ConflictException(
      'Remove the container or Delete the empty repo job first, then you can change the inventory data.'
    );
  }

  return this.prisma.leasingInfo.update({
    where: { id },
    data,
  });
}


  async remove(id: number) {
  const existing = await this.prisma.leasingInfo.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new NotFoundException(`LeasingInfo with id ${id} not found`);
  }

  return this.prisma.leasingInfo.delete({
    where: { id },
  });
}

// Helpers
private hasAnyLifecycleAfterAllotted(statuses: string[]): boolean {
  const lifecycleStatuses = [
    'EMPTY PICKED UP',
    'LADEN GATE-IN',
    'SOB',
    'LADEN DISCHARGE(ATA)',
    'EMPTY RETURNED',
  ];
  const unique = Array.from(new Set(statuses));
  const hasAllotted = unique.includes('ALLOTTED');
  const hasAnyAfter = lifecycleStatuses.some(s => unique.includes(s));
  return hasAllotted && hasAnyAfter;
}

private hasCompleteCycle(statuses: string[]): boolean {
  if (!Array.isArray(statuses) || statuses.length === 0) return false;
  const last = statuses[statuses.length - 1];
  // Treat as complete when container is effectively available again
  return last === 'EMPTY RETURNED' || last === 'AVAILABLE';
}

}

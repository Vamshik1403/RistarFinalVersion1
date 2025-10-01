import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { MovementHistory } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class MovementHistoryService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.movementHistory.findMany({
      include: {
        inventory: true,
        port: true,
        addressBook: true,
        shipment: {
          select: { jobNumber: true, vesselName: true },
        },
        emptyRepoJob: {
          select: { jobNumber: true, vesselName: true },
        },
      },
      orderBy: { date: 'desc' },
    });
  }

  async findOne(id: number) {
    const movement = await this.prisma.movementHistory.findUnique({
      where: { id },
      include: {
        inventory: true,
        port: true,
        addressBook: true,
        shipment: true,
        emptyRepoJob: true,
      },
    });

    if (!movement) {
      throw new NotFoundException(`MovementHistory with ID ${id} not found`);
    }
    return movement;
  }

  async findAllExceptAvailable() {
    return this.prisma.movementHistory.findMany({
      where: { NOT: { status: 'AVAILABLE' } },
      include: {
        inventory: true,
        port: true,
        addressBook: true,
        shipment: true,
        emptyRepoJob: true,
      },
      orderBy: { date: 'desc' },
    });
  }

  /**
   * Shared logic for handling status transitions including maintenance statuses
   */
  private async resolveStatusTransition(
    status: string,
    prev: MovementHistory,
    shipment?: any | null,
    emptyRepoJob?: any | null,
    addressBookIdFromFrontend?: number,
    remarks?: string,
    vesselName?: string,
  ) {
    let portId: number | null = prev.portId;
    let addressBookId: number | null =
      addressBookIdFromFrontend ?? prev.addressBookId ?? null;

    const statusUpper = status.toUpperCase();

    switch (statusUpper) {
      case 'EMPTY PICKED UP':
        portId =
          prev.portId ?? shipment?.polPortId ?? emptyRepoJob?.polPortId ?? null;
        addressBookId = prev.addressBookId ?? null;
        break;

      case 'LADEN GATE-IN':
      case 'EMPTY GATE-IN':
        if (emptyRepoJob) {
          status = 'EMPTY GATE-IN';
          portId = emptyRepoJob.polPortId!;
          addressBookId = null;
        } else {
          status = 'LADEN GATE-IN';
          portId = shipment?.polPortId ?? null;
          addressBookId = null;
        }
        break;

      case 'SOB':
        portId =
          shipment?.podPortId ??
          shipment?.polPortId ??
          emptyRepoJob?.podPortId ??
          emptyRepoJob?.polPortId ??
          null;
        addressBookId =
          addressBookIdFromFrontend ??
          shipment?.carrierAddressBookId ??
          emptyRepoJob?.carrierAddressBookId ??
          null;
        break;

      case 'LADEN DISCHARGE(ATA)':
        if (emptyRepoJob) {
          status = 'EMPTY DISCHARGE';
          portId = emptyRepoJob.podPortId ?? null;
        } else {
          status = 'LADEN DISCHARGE(ATA)';
          portId = shipment?.podPortId ?? null;
        }
        addressBookId = null;
        break;

      case 'EMPTY DISCHARGE':
        status = 'EMPTY DISCHARGE';
        portId = emptyRepoJob?.podPortId ?? null;
        addressBookId = null;
        break;

      case 'EMPTY RETURNED':
        portId = shipment?.podPortId ?? emptyRepoJob?.podPortId ?? null;
        addressBookId =
          shipment?.emptyReturnDepotAddressBookId ??
          emptyRepoJob?.emptyReturnDepotAddressBookId ??
          null;
        break;

      case 'UNDER CLEANING':
      case 'UNDER SURVEY':
      case 'UNDER REPAIR/UNDER TESTING':
      case 'AVAILABLE':
      case 'UNAVAILABLE':
      case 'DAMAGED':
      case 'CANCELLED':
      case 'RETURNED TO DEPOT':
        if (!portId) portId = prev.portId;
        if (!addressBookId) addressBookId = prev.addressBookId;
        break;

      default:
        throw new BadRequestException(
          `Unsupported status transition: ${status}`,
        );
    }

    return {
      portId,
      addressBookId,
      remarks: remarks?.trim() || null,
      vesselName: vesselName?.trim() || null,
      status: statusUpper,
    };
  }

  async bulkUpdateStatus(
    ids: number[],
    newStatus: string,
    jobNumber: string,
    remarks?: string,
    maintenanceStatus?: string,
    vesselName?: string,
    addressBookIdFromFrontend?: number,
  ) {
    const shipment = await this.prisma.shipment.findFirst({
      where: { jobNumber },
      include: { polPort: true, podPort: true, carrierAddressBook: true },
    });

    const emptyRepoJob = !shipment
      ? await this.prisma.emptyRepoJob.findFirst({
          where: { jobNumber },
          select: {
            id: true,
            polPortId: true,
            podPortId: true,
            carrierAddressBookId: true,
            emptyReturnDepotAddressBookId: true,
          },
        })
      : null;

    const status = newStatus.toUpperCase();

    const movementsData = await Promise.all(
      ids.map(async (id) => {
        const prev = await this.prisma.movementHistory.findUnique({
          where: { id },
        });
        if (!prev) throw new NotFoundException(`MovementHistory ${id} not found`);

        const {
          portId,
          addressBookId,
          remarks: finalRemarks,
          vesselName: finalVesselName,
          status: finalStatus,
        } = await this.resolveStatusTransition(
          status,
          prev,
          shipment,
          emptyRepoJob,
          addressBookIdFromFrontend,
          remarks,
          vesselName,
        );

        const createData: any = {
          inventoryId: prev.inventoryId,
          status: finalStatus,
          date: new Date(),
        };

        if (portId !== null && portId !== undefined) createData.portId = portId;
        if (addressBookId !== null && addressBookId !== undefined)
          createData.addressBookId = addressBookId;
       if (prev.shipmentId != null) {
  createData.shipmentId = prev.shipmentId;
} else if (shipment?.id != null) {
  createData.shipmentId = shipment.id;
}

     if (prev.emptyRepoJobId != null) {
  createData.emptyRepoJobId = prev.emptyRepoJobId;
} else if (emptyRepoJob?.id != null) {
  createData.emptyRepoJobId = emptyRepoJob.id;
}


        if (finalRemarks !== null) createData.remarks = finalRemarks;
        if (finalVesselName !== null) createData.vesselName = finalVesselName;

        // ✅ save maintenance status if provided
        if (maintenanceStatus) createData.maintenanceStatus = maintenanceStatus;

        return createData;
      }),
    );

    return this.prisma.$transaction(
      movementsData.map((data) => this.prisma.movementHistory.create({ data })),
    );
  }

  async updateMovement(id: number, data: Partial<MovementHistory>) {
    const updatedData: any = { ...data };
    if (data.date) updatedData.date = new Date(data.date);

    Object.keys(updatedData).forEach((key) => {
      if (updatedData[key] === undefined) delete updatedData[key];
    });

    return this.prisma.movementHistory.update({
      where: { id },
      data: updatedData,
    });
  }

  async createNewStatusEntry(
    prevId: number,
    newStatus: string,
    portId?: number | null,
    addressBookId?: number | null,
    remarks?: string,
    maintenanceStatus?: string,
    vesselName?: string,
  ) {
    const previous = await this.prisma.movementHistory.findUnique({
      where: { id: prevId },
    });

    if (!previous) {
      throw new NotFoundException(`MovementHistory with ID ${prevId} not found`);
    }

    let shipment: any | null = null;
    let emptyRepoJob: any | null = null;

    if (previous.shipmentId) {
      shipment = await this.prisma.shipment.findUnique({
        where: { id: previous.shipmentId },
        select: {
          polPortId: true,
          podPortId: true,
          carrierAddressBookId: true,
          emptyReturnDepotAddressBookId: true,
        },
      });
    } else if (previous.emptyRepoJobId) {
      emptyRepoJob = await this.prisma.emptyRepoJob.findUnique({
        where: { id: previous.emptyRepoJobId },
        select: {
          polPortId: true,
          podPortId: true,
          carrierAddressBookId: true,
          emptyReturnDepotAddressBookId: true,
        },
      });
    }

    const status = newStatus.toUpperCase();

    const {
      portId: finalPortId,
      addressBookId: finalAddressBookId,
      remarks: finalRemarks,
      vesselName: finalVesselName,
      status: finalStatus,
    } = await this.resolveStatusTransition(
      status,
      previous,
      shipment,
      emptyRepoJob,
      addressBookId ?? undefined,
      remarks,
      vesselName,
    );

    const createData: any = {
      inventoryId: previous.inventoryId,
      status: finalStatus,
      date: new Date(),
    };

    if (finalPortId !== null) createData.portId = finalPortId;
    if (finalAddressBookId !== null) createData.addressBookId = finalAddressBookId;
    if (previous.shipmentId !== null) createData.shipmentId = previous.shipmentId;
    if (previous.emptyRepoJobId !== null) createData.emptyRepoJobId = previous.emptyRepoJobId;
    if (finalRemarks !== null) createData.remarks = finalRemarks;
    if (finalVesselName !== null) createData.vesselName = finalVesselName;

    // ✅ save maintenance status
    if (maintenanceStatus) createData.maintenanceStatus = maintenanceStatus;

    return this.prisma.movementHistory.create({ data: createData });
  }

  async findLatestPerContainer() {
    const latestMovements = await this.prisma.$queryRaw<
      MovementHistory[]
    >`SELECT DISTINCT ON ("inventoryId") * 
       FROM "MovementHistory" 
       ORDER BY "inventoryId", "date" DESC`;

    const ids = latestMovements.map((m) => m.id);

    return this.prisma.movementHistory.findMany({
      where: { id: { in: ids } },
      include: {
        inventory: true,
        port: true,
        addressBook: true,
        shipment: true,
        emptyRepoJob: true,
      },
      orderBy: { date: 'desc' },
    });
  }
}

import { Injectable } from '@nestjs/common';
import { CreateShipmentDto } from './dto/create-shipment.dto';
import { UpdateShipmentDto } from './dto/update-shipment.dto';
import { BillManagementService } from '../bill-management/bill-management.service';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class ShipmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly billManagementService: BillManagementService
  ) {}

async create(data: CreateShipmentDto) {
  if (!data.polPortId || !data.podPortId) {
    throw new Error('POL and POD port IDs are required');
  }

  const currentYear = new Date().getFullYear().toString().slice(-2); // e.g. "25"

  // ✅ Fetch port codes
  const [polPort, podPort] = await Promise.all([
    this.prisma.ports.findUnique({
      where: { id: data.polPortId },
      select: { portCode: true },
    }),
    this.prisma.ports.findUnique({
      where: { id: data.podPortId },
      select: { portCode: true },
    }),
  ]);

  const polCode = polPort?.portCode || 'XXX';
  const podCode = podPort?.portCode || 'XXX';

  const prefix = `RST/${polCode}${podCode}/${currentYear}/`;

  // ✅ Find latest shipment for sequence
  const latestShipment = await this.prisma.shipment.findFirst({
    where: {
      houseBL: { startsWith: prefix },
    },
    orderBy: { houseBL: 'desc' },
  });

  let nextSequence = 1;
  if (latestShipment?.houseBL) {
    const parts = latestShipment.houseBL.split('/');
    const lastNumber = parseInt(parts[3]);
    if (!isNaN(lastNumber)) {
      nextSequence = lastNumber + 1;
    }
  }

  const paddedSequence = String(nextSequence).padStart(5, '0');
  const generatedHouseBL = `${prefix}${paddedSequence}`;

  const { containers, ...rest } = data;


  // ✅ Parse dates
  const parseDate = (d: string | Date | null | undefined) =>
    d && d !== '' ? new Date(d) : null;

  // ✅ Generate jobNumber before transaction
  const generatedJobNumber = await this.getNextJobNumber();

  return this.prisma.$transaction(async (tx) => {
    // Build base shipment data
    const shipmentData: any = {
      quotationRefNumber: rest.quotationRefNumber ?? null,
      date: parseDate(rest.date),
      jobNumber: generatedJobNumber,

      refNumber: rest.refNumber ?? '',
      masterBL: rest.masterBL ?? '',
      houseBL: generatedHouseBL,
      shippingTerm: rest.shippingTerm ?? '',
      polFreeDays: rest.polFreeDays ?? '0',
      podFreeDays: rest.podFreeDays ?? '0',
      polDetentionRate: rest.polDetentionRate ?? '0',
      podDetentionRate: rest.podDetentionRate ?? '0',
      quantity: rest.quantity ?? '0',
      vesselName: rest.vesselName ?? '',
      gsDate: parseDate(rest.gsDate),
      etaTopod: parseDate(rest.etaTopod),
      estimateDate: parseDate(rest.estimateDate),
      sob: parseDate(rest.sob),
    };

    // ✅ Map FK IDs into Prisma relations
    if (rest.custAddressBookId) {
      shipmentData.customerAddressBook = {
        connect: { id: rest.custAddressBookId },
      };
    }
    if (rest.consigneeAddressBookId) {
      shipmentData.consigneeAddressBook = {
        connect: { id: rest.consigneeAddressBookId },
      };
    }
    if (rest.shipperAddressBookId) {
      shipmentData.shipperAddressBook = {
        connect: { id: rest.shipperAddressBookId },
      };
    }
    if (rest.expHandlingAgentAddressBookId) {
      shipmentData.expHandlingAgentAddressBook = {
        connect: { id: rest.expHandlingAgentAddressBookId },
      };
    }
    if (rest.impHandlingAgentAddressBookId) {
      shipmentData.impHandlingAgentAddressBook = {
        connect: { id: rest.impHandlingAgentAddressBookId },
      };
    }
    if (rest.emptyReturnDepotAddressBookId) {
      shipmentData.emptyReturnDepotAddressBook = {
        connect: { id: rest.emptyReturnDepotAddressBookId },
      };
    }
    if (rest.carrierAddressBookId) {
      shipmentData.carrierAddressBook = {
        connect: { id: rest.carrierAddressBookId },
      };
    }
    if (rest.productId) {
      shipmentData.product = {
        connect: { id: rest.productId },
      };
    }
    if (rest.polPortId) {
      shipmentData.polPort = {
        connect: { id: rest.polPortId },
      };
    }
    if (rest.podPortId) {
      shipmentData.podPort = {
        connect: { id: rest.podPortId },
      };
    }
    if (rest.transhipmentPortId) {
      shipmentData.transhipmentPort = {
        connect: { id: rest.transhipmentPortId },
      };
    }

    // ✅ Create shipment
    const createdShipment = await tx.shipment.create({
      data: shipmentData,
    });

    // ✅ Handle containers if provided
    if (containers?.length) {
      await tx.shipmentContainer.createMany({
        data: containers.map((c) => ({
          containerNumber: c.containerNumber,
          capacity: c.capacity,
          tare: c.tare,
          portId: c.portId ?? undefined,
          depotName: c.depotName ?? undefined,
          inventoryId: c.inventoryId ?? undefined,
          shipmentId: createdShipment.id,
        })),
      });

      // ✅ Update inventory + movement history
      for (const container of containers) {
        if (!container.containerNumber) continue;

        const inventory = await tx.inventory.findFirst({
          where: { containerNumber: container.containerNumber },
        });

        if (inventory) {
          const leasingInfo = await tx.leasingInfo.findFirst({
            where: { inventoryId: inventory.id },
            orderBy: { createdAt: 'desc' },
          });

          if (leasingInfo) {
            await tx.movementHistory.create({
              data: {
                inventoryId: inventory.id,
                portId: leasingInfo.portId,
                addressBookId: leasingInfo.onHireDepotaddressbookId,
                shipmentId: createdShipment.id,
                status: 'ALLOTTED',
                date: new Date(),
                jobNumber: createdShipment.jobNumber,
              },
            });
          }
        }
      }
    }

    // ✅ Create bill management record automatically
    await tx.billManagement.create({
      data: {
        invoiceNo: '', // Null initially, user will fill it manually
        invoiceAmount: 0, // Start with 0, user will fill in the actual amount
        paidAmount: 0,
        dueAmount: 0,
        shipmentId: createdShipment.id,
        billingStatus: 'Pending',
        paymentStatus: 'Unpaid',
      },
    });

    return createdShipment;
  });
}

  async getNextJobNumber(): Promise<string> {
    const currentYear = new Date().getFullYear().toString().slice(-2); // "25"
    const prefix = `${currentYear}/`;

    const latestShipment = await this.prisma.shipment.findFirst({
      where: {
        jobNumber: {
          startsWith: prefix,
        },
      },
      orderBy: {
        jobNumber: 'desc',
      },
    });

    let nextSequence = 1;
    if (latestShipment?.jobNumber) {
      const parts = latestShipment.jobNumber.split('/');
      const lastNumber = parseInt(parts[1]);
      if (!isNaN(lastNumber)) {
        nextSequence = lastNumber + 1;
      }
    }

    const paddedSequence = String(nextSequence).padStart(5, '0');
    return `${prefix}${paddedSequence}`; // e.g., "25/00003"
  }

  findAll() {
    return this.prisma.shipment.findMany({
      include: {
        customerAddressBook: true,
        consigneeAddressBook: true,
        shipperAddressBook: true,
        polPort: true,
        podPort: true,
        product: true,
        transhipmentPort: true,
        expHandlingAgentAddressBook: true,
        impHandlingAgentAddressBook: true,
        carrierAddressBook: true,
        emptyReturnDepotAddressBook: true,
        containers: true,
      },
      orderBy: [
        { date: 'desc' },
        { jobNumber: 'desc' },
        { id: 'desc' }
      ],
    });
  }

  findOne(id: number) {
    return this.prisma.shipment.findUnique({
      where: { id },
      include: {
        customerAddressBook: true,
        consigneeAddressBook: true,
        shipperAddressBook: true,
        polPort: true,
        podPort: true,
        product: true,
        transhipmentPort: true,
        expHandlingAgentAddressBook: true,
        impHandlingAgentAddressBook: true,
        carrierAddressBook: true,
        emptyReturnDepotAddressBook: true,
        containers: true,
      },
    });
  }

  async update(id: number, data: UpdateShipmentDto) {
    const { containers, ...shipmentData } = data;

    // Fetch the current shipment to get the jobNumber
    const currentShipment = await this.prisma.shipment.findUnique({
      where: { id },
      select: { jobNumber: true },
    });
    const jobNumber = currentShipment?.jobNumber || 'UNKNOWN';

    return this.prisma.$transaction(async (tx) => {
      // 1. Fetch existing containers for this shipment
      const existingContainers = await tx.shipmentContainer.findMany({
        where: { shipmentId: id },
      });

      const existingInventoryIds = existingContainers
        .map((c) => c.inventoryId)
        .filter((id): id is number => id !== null && id !== undefined);

      const newInventoryIds = (containers || [])
        .map((c) => c.inventoryId)
        .filter((id): id is number => id !== null && id !== undefined);

      // 2. Identify removed inventoryIds (no longer in the new list)
      const removedInventoryIds = existingInventoryIds.filter(
        (oldId) => !newInventoryIds.includes(oldId),
      );

      // 3. Handle removed containers
      for (const inventoryId of removedInventoryIds) {
        const leasingInfo = await tx.leasingInfo.findFirst({
          where: { inventoryId },
          orderBy: { createdAt: 'desc' },
        });

        // Skip containers with incomplete leasing info instead of throwing error
        if (
          !leasingInfo ||
          leasingInfo.portId == null ||
          leasingInfo.onHireDepotaddressbookId == null
        ) {
          console.warn(`Skipping movement history for inventoryId ${inventoryId} - incomplete leasing info`);
          continue;
        }

        await tx.movementHistory.create({
          data: {
            inventoryId,
            portId: leasingInfo.portId,
            addressBookId: leasingInfo.onHireDepotaddressbookId,
            status: 'AVAILABLE',
            date: new Date(),
            remarks: `Removed from shipment - ${jobNumber}`,
            shipmentId: null,
            emptyRepoJobId: null,
          },
        });
      }

      // 4. Update shipment main data
      const updatedShipment = await tx.shipment.update({
        where: { id },
        data: {
          ...shipmentData,
          date: shipmentData.date ? new Date(shipmentData.date) : undefined,
          gsDate: shipmentData.gsDate ? new Date(shipmentData.gsDate) : undefined,
          etaTopod: shipmentData.etaTopod ? new Date(shipmentData.etaTopod) : undefined,
          estimateDate: shipmentData.estimateDate
            ? new Date(shipmentData.estimateDate)
            : undefined,
          sob: shipmentData.sob ? new Date(shipmentData.sob) : null,
        },
      });

      // 5. Delete old containers
      await tx.shipmentContainer.deleteMany({
        where: { shipmentId: id },
      });

      // 6. Re-create container records
      if (containers && containers.length > 0) {
        await tx.shipmentContainer.createMany({
          data: containers.map((container) => ({
            containerNumber: container.containerNumber,
            capacity: container.capacity,
            tare: container.tare,
            portId: container.portId ?? undefined,
            depotName: container.depotName ?? undefined,
            inventoryId: container.inventoryId ?? undefined,
            shipmentId: id,
          })),
        });

        // 7. Log movement history for new containers
        for (const container of containers) {
          if (!container.inventoryId) continue;

          const leasingInfo = await tx.leasingInfo.findFirst({
            where: { inventoryId: container.inventoryId },
            orderBy: { createdAt: 'desc' },
          });

          // Skip containers with incomplete leasing info instead of throwing error
          if (
            !leasingInfo ||
            leasingInfo.portId == null ||
            leasingInfo.onHireDepotaddressbookId == null
          ) {
            console.warn(`Skipping movement history for inventoryId ${container.inventoryId} - incomplete leasing info`);
            continue;
          }

          await tx.movementHistory.create({
            data: {
              inventoryId: container.inventoryId,
              portId: leasingInfo.portId,
              addressBookId: leasingInfo.onHireDepotaddressbookId,
              status: 'ALLOTTED',
              date: new Date(),
              shipmentId: id,
              emptyRepoJobId: null,
            },
          });
        }
      }

      return updatedShipment;
    });
  }

  async getBlAssignments(shipmentId: number, blType: 'draft'|'original'|'seaway') {
    const rows = await this.prisma.blAssignment.findMany({
      where: { shipmentId, blType },
      orderBy: { blIndex: 'asc' },
      select: { blIndex: true, containerNumbers: true },
    });

    // build groups as string[][]
    const groups: string[][] = rows.map(r => (r.containerNumbers as string[]));
    return { shipmentId, blType, groups };
  }

  async saveBlAssignments(
    shipmentId: number,
    blType: 'draft'|'original'|'seaway',
    groups: string[][],
  ) {
    return this.prisma.$transaction(async (tx) => {
      // clear existing for this shipment + type
      await tx.blAssignment.deleteMany({
        where: { shipmentId, blType },
      });

      if (!groups?.length) return { shipmentId, blType, groups: [] };

      // create one row per BL index
      await tx.blAssignment.createMany({
        data: groups.map((g, idx) => ({
          shipmentId,
          blType,
          blIndex: idx,
          containerNumbers: g,
        })),
      });

      return { shipmentId, blType, groups };
    });
  }

  async remove(id: number) {
    const shipment = await this.prisma.shipment.findUniqueOrThrow({
      where: { id },
      select: {
        id: true,
        jobNumber: true,
        date: true,
        customerAddressBook: { select: { companyName: true } },
        polPort: { select: { portName: true } },
        podPort: { select: { portName: true } },
      },
    });

    const containers = await this.prisma.shipmentContainer.findMany({
      where: { shipmentId: id },
    });

    return this.prisma.$transaction(async (tx) => {
      // ✅ Update bill management record to mark shipment as deleted and store details
      const portDetails = shipment.polPort?.portName && shipment.podPort?.portName 
        ? `${shipment.polPort.portName} → ${shipment.podPort.portName}`
        : null;

      await tx.billManagement.updateMany({
        where: { shipmentId: id },
        data: {
          remarks: 'Shipment Deleted',
          shipmentId: null as any, // Remove foreign key reference to allow shipment deletion
          shipmentNumber: shipment.jobNumber,
          shipmentDate: shipment.date,
          customerName: shipment.customerAddressBook?.companyName,
          portDetails: portDetails,
        } as any,
      });

      for (const container of containers) {
        const inventoryId = container.inventoryId;
        if (!inventoryId) continue;

        const leasingInfo = await tx.leasingInfo.findFirst({
          where: { inventoryId },
          orderBy: { createdAt: 'desc' },
        });

        // Skip containers with incomplete leasing info instead of throwing error
        if (!leasingInfo || !leasingInfo.portId || !leasingInfo.onHireDepotaddressbookId) {
          console.warn(`Skipping movement history for inventoryId ${inventoryId} - incomplete leasing info`);
          continue;
        }

        await tx.movementHistory.create({
          data: {
            inventoryId,
            portId: leasingInfo.portId,
            addressBookId: leasingInfo.onHireDepotaddressbookId,
            status: 'AVAILABLE',
            date: new Date(),
            remarks: `Shipment cancelled - ${shipment.jobNumber}`,
            shipmentId: shipment.id,
            emptyRepoJobId: null,
          },
        });
      }

      await tx.shipmentContainer.deleteMany({
        where: { shipmentId: id },
      });

    await tx.blAssignment.deleteMany({
      where: { shipmentId: id },
    });

      return tx.shipment.delete({
        where: { id },
      });
    });
  }

  async getQuotationDataByRef(refNumber: string) {
    return this.prisma.quotation.findUnique({
      where: { quotationRefNumber: refNumber },
      include: {
        custAddressBook: true,
        polPort: true,
        podPort: true,
        product: true,
      },
    });
  }

  async markCroGenerated(id: number) {
    try {
      const existingShipment = await this.prisma.shipment.findUnique({
        where: { id },
      });

      if (!existingShipment) {
        throw new Error('Shipment not found');
      }

      const currentDate = new Date();
      const updateData: any = {};

      if (!existingShipment.hasCroGenerated) {
        updateData.hasCroGenerated = true;
      }

      if (!existingShipment.firstCroGenerationDate) {
        updateData.firstCroGenerationDate = currentDate;
      }

      if (Object.keys(updateData).length > 0) {
        return await this.prisma.shipment.update({
          where: { id },
          data: updateData,
        });
      }

      return existingShipment;
    } catch (error) {
      console.error('❌ Failed to mark CRO as generated:', error);
      throw new Error('CRO generation tracking failed. See logs for details.');
    }
  }
}

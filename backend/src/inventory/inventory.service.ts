import { Injectable, ConflictException } from '@nestjs/common';
import { CreateInventoryDto } from './dto/create-inventory.dto';
import { UpdateInventoryDto } from './dto/update-inventory.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class InventoryService {
  constructor(private prisma: PrismaService) {}

  async create(data: CreateInventoryDto) {
    try {
      const createdInventory = await this.prisma.inventory.create({
        data: {
          status: data.status,
          containerNumber: data.containerNumber,
          containerCategory: data.containerCategory,
          containerType: data.containerType,
          containerSize: data.containerSize,
          containerClass: data.containerClass,
          containerCapacity: data.containerCapacity,
          capacityUnit: data.capacityUnit,
          manufacturer: data.manufacturer ?? '',
          buildYear: data.buildYear ?? '',
          grossWeight: data.grossWeight ?? '',
          tareWeight: data.tareWeight ?? '',
          InitialSurveyDate: data.InitialSurveyDate
            ? new Date(data.InitialSurveyDate).toISOString()
            : new Date().toISOString(),

            periodicTankCertificates: {
        create: data.periodicTankCertificates?.map((cert) => ({
          inspectionDate: cert.inspectionDate ? new Date(cert.inspectionDate) : new Date(),
          inspectionType: cert.inspectionType,
          nextDueDate: cert.nextDueDate ? new Date(cert.nextDueDate) : new Date(),
          certificate: typeof cert.certificate === 'string' ? cert.certificate : '',
        })) || [],
      },

          leasingInfo: {
            create:
              data.leasingInfo?.map((info) => ({
                ownershipType: info.ownershipType,
                leasingRefNo: info.leasingRefNo,
                leasoraddressbookId: info.leasoraddressbookId,
                onHireDate: info.onHireDate
                  ? new Date(info.onHireDate)
                  : new Date(),
                portId: info.portId,
                leaseRentPerDay: info.leaseRentPerDay ?? '0',
                remarks: info.remarks ?? '',
                onHireDepotaddressbookId: info.onHireDepotaddressbookId,
                offHireDate: info.offHireDate
                  ? new Date(info.offHireDate)
                  : null,
              })) || [],
          },

          onHireReport: {
            create:
              data.onHireReport?.map((report) => ({
                reportDate: report.reportDate
                  ? new Date(report.reportDate)
                  : new Date(),
                reportDocument:
                  typeof report.reportDocument === 'object'
                    ? JSON.stringify(report.reportDocument)
                    : (report.reportDocument ?? ''),
              })) || [],
          },
        },
        include: {
          leasingInfo: true,
        },
      });

      // After creation, prepare movement history
      const leasing = createdInventory.leasingInfo?.[0];

      let portId: number | null = null;
      let addressBookId: number | null = null;

      if (leasing) {
        portId = leasing.portId;
        addressBookId = leasing.onHireDepotaddressbookId;
      } else if (
        data['ownership'] === 'Own' &&
        data['portId'] &&
        data['onHireDepotaddressbookId']
      ) {
        portId =
          typeof data['portId'] === 'string'
            ? parseInt(data['portId'], 10)
            : data['portId'];
        addressBookId =
          typeof data['onHireDepotaddressbookId'] === 'string'
            ? parseInt(data['onHireDepotaddressbookId'], 10)
            : data['onHireDepotaddressbookId'];
      }

      if (portId && addressBookId) {
        await this.prisma.movementHistory.create({
          data: {
            inventoryId: createdInventory.id,
            portId,
            addressBookId,
            status: 'AVAILABLE',
            date: new Date(),
            shipmentId: null,
          },
        });
      }

      return createdInventory;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Container with this number already exists');
      }
      console.error('Error creating inventory:', error);
      throw error;
    }
  }

  findAll() {
    return this.prisma.inventory
      .findMany({
        include: {
          leasingInfo: true,
          periodicTankCertificates: true,
          onHireReport: true,
        },
      })
      .then((inventories) => {
        return inventories.map((inventory) => {
          const ownershipType =
            inventory.leasingInfo && inventory.leasingInfo.length > 0
              ? 'Lease'
              : 'Own';

          return {
            ...inventory,
            ownershipType,
          };
        });
      });
  }

  findOne(id: number) {
    return this.prisma.inventory
      .findUnique({
        where: { id },
        include: {
          leasingInfo: true,
          periodicTankCertificates: true,
          onHireReport: true,
        },
      })
      .then((inventory) => {
        if (!inventory) return null;

        const ownershipType =
          inventory.leasingInfo && inventory.leasingInfo.length > 0
            ? 'Lease'
            : 'Own';

        return {
          ...inventory,
          ownershipType,
        };
      });
  }

 async update(id: number, data: UpdateInventoryDto) {
  const {
    periodicTankCertificates,
    leasingInfo,
    onHireReport,
    ...inventoryData
  } = data;

  // ✅ Update inventory base data
  await this.prisma.inventory.update({
    where: { id },
    data: inventoryData,
  });

  // ✅ Update/create periodic tank certificates
  if (periodicTankCertificates?.length) {
    for (const cert of periodicTankCertificates) {
      const inspectionDate = cert.inspectionDate
        ? new Date(cert.inspectionDate)
        : undefined;
      const nextDueDate = cert.nextDueDate
        ? new Date(cert.nextDueDate)
        : undefined;

      if (cert.id) {
        await this.prisma.periodicTankCertificates.update({
          where: { id: cert.id },
          data: {
            inspectionDate,
            inspectionType: cert.inspectionType,
            nextDueDate,
            certificate: cert.certificate ?? '',
          },
        });
      } else {
        await this.prisma.periodicTankCertificates.create({
          data: {
            inspectionDate,
            inspectionType: cert.inspectionType,
            nextDueDate,
            certificate: cert.certificate ?? '',
            inventoryId: id,
          },
        });
      }
    }
  }

  // ✅ Handle leasing info
  if (leasingInfo?.length) {
    for (const lease of leasingInfo) {
      const leasingData: any = {
        ownershipType: lease.ownershipType,
        leasingRefNo: lease.leasingRefNo,
        leasoraddressbookId: lease.leasoraddressbookId,
        onHireDepotaddressbookId: lease.onHireDepotaddressbookId,
        portId: lease.portId,
        leaseRentPerDay: lease.leaseRentPerDay ?? '0',
        remarks: lease.remarks ?? '',
        onHireDate: lease.onHireDate ? new Date(lease.onHireDate) : undefined,
        offHireDate: lease.offHireDate
          ? new Date(lease.offHireDate)
          : undefined,
      };

      if (lease.id) {
        const existingLease = await this.prisma.leasingInfo.findUnique({
          where: { id: lease.id },
        });

        if (existingLease) {
          await this.prisma.leasingInfo.update({
            where: { id: lease.id },
            data: leasingData,
          });
        } else {
          await this.prisma.leasingInfo.create({
            data: {
              ...leasingData,
              inventoryId: id,
            },
          });
        }
      } else {
        await this.prisma.leasingInfo.create({
          data: {
            ...leasingData,
            inventoryId: id,
          },
        });
      }
    }
  }

  // ✅ Update on-hire reports
  if (onHireReport?.length) {
    for (const report of onHireReport) {
      const reportData = {
        reportDate: report.reportDate
          ? new Date(report.reportDate)
          : undefined,
        reportDocument:
          typeof report.reportDocument === 'object'
            ? JSON.stringify(report.reportDocument)
            : report.reportDocument,
      };

      if (report.id) {
        const existingReport = await this.prisma.onHireReport.findUnique({
          where: { id: report.id },
        });

        if (existingReport) {
          await this.prisma.onHireReport.update({
            where: { id: report.id },
            data: reportData,
          });
        } else {
          await this.prisma.onHireReport.create({
            data: {
              ...reportData,
              inventoryId: id,
            },
          });
        }
      } else {
        await this.prisma.onHireReport.create({
          data: {
            ...reportData,
            inventoryId: id,
          },
        });
      }
    }
  }

  // ✅ Return updated record
  return this.findOne(id);
}


  async canDeleteContainer(id: string) {
    const numId = +id;

    // Get all movement history records for this container
    const movementHistory = await this.prisma.movementHistory.findMany({
      where: { inventoryId: numId },
      orderBy: { date: 'asc' },
    });

    // If no movement history, it's a new container that can be deleted
    if (movementHistory.length === 0) {
      return { canDelete: true, reason: null };
    }

    // Check if container is currently allocated (has a shipment or empty repo job)
    const currentRecord = movementHistory[movementHistory.length - 1];
    
    if (currentRecord.shipmentId || currentRecord.emptyRepoJobId) {
      return { 
        canDelete: false, 
        reason: 'Container is currently allocated to a shipment and cannot be deleted.' 
      };
    }

    // Check if container has been through any status lifecycle after ALLOTTED
    const statuses = movementHistory.map(record => record.status);
    const hasAnyLifecycleAfterAllotted = this.hasAnyLifecycleAfterAllotted(statuses);

    if (hasAnyLifecycleAfterAllotted) {
      return { 
        canDelete: false, 
        reason: 'Container has completed 1 status lifecycle and cannot be deleted.' 
      };
    }

    // If container is available and hasn't completed any lifecycle, it can be deleted
    return { canDelete: true, reason: null };
  }

  private hasAnyLifecycleAfterAllotted(statuses: string[]): boolean {
    // Define the statuses that come after ALLOTTED in the lifecycle
    const lifecycleStatuses = [
      'EMPTY PICKED UP',
      'LADEN GATE-IN',
      'SOB',
      'LADEN DISCHARGE(ATA)',
      'EMPTY RETURNED'
    ];

    // Check if container has been ALLOTTED and then has any lifecycle status
    const uniqueStatuses = [...new Set(statuses)];
    const hasAllotted = uniqueStatuses.includes('ALLOTTED');
    const hasAnyLifecycleStatus = lifecycleStatuses.some(status => 
      uniqueStatuses.includes(status)
    );

    // Container cannot be deleted if it has been ALLOTTED and has any lifecycle status
    return hasAllotted && hasAnyLifecycleStatus;
  }

  private hasCompleteCycle(statuses: string[]): boolean {
    // Define the key statuses that indicate a complete shipment cycle
    // A container has completed a cycle if it has gone through:
    // ALLOTTED -> EMPTY PICKED UP -> LADEN GATE-IN -> SOB -> LADEN DISCHARGE(ATA) -> EMPTY RETURNED
    const keyCycleStatuses = [
      'ALLOTTED',
      'EMPTY PICKED UP',
      'LADEN GATE-IN',
      'SOB',
      'LADEN DISCHARGE(ATA)',
      'EMPTY RETURNED'
    ];

    // Check if all key cycle statuses have been encountered at least once
    const uniqueStatuses = [...new Set(statuses)];
    const hasAllKeyStatuses = keyCycleStatuses.every(status => 
      uniqueStatuses.includes(status)
    );

    return hasAllKeyStatuses;
  }

  async remove(id: string) {
    const numId = +id;

    // Check if container can be deleted
    const deletionCheck = await this.canDeleteContainer(id);
    if (!deletionCheck.canDelete) {
      throw new ConflictException(deletionCheck.reason);
    }

    await this.prisma.$transaction([
      // Delete movement history records that reference this inventory
      this.prisma.movementHistory.deleteMany({
        where: { inventoryId: numId },
      }),
      // Delete shipment containers that reference this inventory
      this.prisma.shipmentContainer.deleteMany({
        where: { inventoryId: numId },
      }),
      // Delete repo shipment containers that reference this inventory
      this.prisma.repoShipmentContainer.deleteMany({
        where: { inventoryId: numId },
      }),
      // Delete periodic tank certificates
      this.prisma.periodicTankCertificates.deleteMany({
        where: { inventoryId: numId },
      }),
      // Delete on hire reports
      this.prisma.onHireReport.deleteMany({
        where: { inventoryId: numId },
      }),
      // Delete leasing info
      this.prisma.leasingInfo.deleteMany({
        where: { inventoryId: numId },
      }),
      // Finally delete the inventory record itself
      this.prisma.inventory.delete({
        where: { id: numId },
      }),
    ]);

    return { id: numId };
  }
}
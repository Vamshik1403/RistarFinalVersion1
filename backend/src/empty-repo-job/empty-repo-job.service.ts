import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateEmptyRepoJobDto } from './dto/create-emptyRepoJob.dto';
import { UpdateEmptyRepoJobDto } from './dto/update-emptyRepoJob.dto';

@Injectable()
export class EmptyRepoJobService {
  constructor(private readonly prisma: PrismaService) { }






  async create(data: CreateEmptyRepoJobDto) {
    const { containers, polPortId, podPortId, ...jobData } = data;

    if (!polPortId || !podPortId) {
      throw new Error('polPortId and podPortId are required');
    }

    const [polPort, podPort] = await Promise.all([
      this.prisma.ports.findUnique({ where: { id: polPortId } }),
      this.prisma.ports.findUnique({ where: { id: podPortId } }),
    ]);

    if (!polPort || !podPort) {
      throw new Error('Invalid port IDs provided');
    }

    const jobNumber = await this.generateJobNumber(polPort.portCode, podPort.portCode);
    const houseBL = jobNumber;

    const parseDateOrNull = (d: string | Date | undefined) =>
      d ? new Date(d).toISOString() : null;

    return this.prisma.$transaction(async (tx) => {
      const jobDataForCreate: any = {
        ...jobData,
        jobNumber,
        houseBL,
        polPortId,
        podPortId,
        date: jobData.date ? new Date(jobData.date).toISOString() : new Date().toISOString(),
        gsDate: parseDateOrNull(jobData.gsDate),
        etaTopod: parseDateOrNull(jobData.etaTopod),
        estimateDate: parseDateOrNull(jobData.estimateDate),
      };

      if (jobData.sob) {
        jobDataForCreate.sob = new Date(jobData.sob).toISOString();
      }

      const createdJob = await tx.emptyRepoJob.create({
        data: jobDataForCreate,
      });

      // Create containers
      if (containers && containers.length > 0) {
        await tx.repoShipmentContainer.createMany({
          data: containers.map((c) => ({
            shipmentId: createdJob.id,
            containerNumber: c.containerNumber,
            capacity: c.capacity,
            tare: c.tare,
            portId: c.portId,
            inventoryId: c.inventoryId,
            depotName: c.depotName,
          })),
        });

        for (const container of containers) {
          const inventory = await tx.inventory.findFirst({
            where: { containerNumber: container.containerNumber },
          });

          if (!inventory) continue;

          await tx.movementHistory.updateMany({
            where: { inventoryId: inventory.id, status: 'AVAILABLE' },
            data: {
              remarks: `Container allocated to Empty Repo ${createdJob.jobNumber}`,
            },
          });

          if (inventory) {
            const leasingInfo = await tx.leasingInfo.findFirst({
              where: { inventoryId: inventory.id },
              orderBy: { createdAt: 'desc' },
            });

            if (leasingInfo) {
              // Find latest movement entry to get current depot and port
              const lastMovement = await tx.movementHistory.findFirst({
                where: { inventoryId: inventory.id },
                orderBy: { date: 'desc' },
              });

              // Determine correct source port and depot
              const sourcePortId =
                lastMovement?.portId ??
                createdJob.polPortId ??
                leasingInfo?.portId ??
                null;

              const sourceDepotId =
                lastMovement?.addressBookId ??
                leasingInfo?.onHireDepotaddressbookId ??
                null;

              // Create new movement entry for the Empty Repo Job
              await tx.movementHistory.create({
                data: {
                  inventoryId: inventory.id,
                  portId: sourcePortId,
                  addressBookId: sourceDepotId,
                  shipmentId: null,
                  emptyRepoJobId: createdJob.id,
                  status: 'ALLOTTED',
                  date: new Date(),
                  jobNumber: createdJob.jobNumber,
                  remarks: `Empty Repo created - ${createdJob.jobNumber}`,
                },
              });




              console.log(
                `✅ Movement recorded for ${container.containerNumber}: Port ${createdJob.polPortId}, Depot ${createdJob.emptyReturnDepotAddressBookId}`
              );
            }
          }
        }
      }

      return createdJob;
    });
  }


  private async generateJobNumber(polCode: string, podCode: string): Promise<string> {
    // GLOBAL sequence across all EmptyRepoJobs irrespective of ports
    const year = new Date().getFullYear().toString().slice(-2);
    const prefix = `RST/${polCode}${podCode}/${year}/`;

    // Fetch all job numbers and compute the global max ER sequence
    const allJobs = await this.prisma.emptyRepoJob.findMany({ select: { jobNumber: true } });
    let maxSeq = 0;
    for (const j of allJobs) {
      const match = j.jobNumber?.match(/ER(\d{5})$/);
      if (match) {
        const n = parseInt(match[1], 10);
        if (!isNaN(n)) maxSeq = Math.max(maxSeq, n);
      }
    }

    const nextSeq = maxSeq + 1;
    const paddedSeq = String(nextSeq).padStart(5, '0');
    return `${prefix}ER${paddedSeq}`;
  }

  /**
   * Preview-only: returns a dummy job number template
   */
  async getNextJobNumber(): Promise<{ jobNumber: string; houseBL: string }> {
    const year = new Date().getFullYear().toString().slice(-2);
    const prefix = `RST/`; // Match all RST/XXYYZZ/25/ER000xx patterns

    const jobs = await this.prisma.emptyRepoJob.findMany({
      where: {
        jobNumber: {
          startsWith: prefix,
        },
      },
      orderBy: {
        jobNumber: 'desc',
      },
    });

    let maxSeq = 0;

    for (const job of jobs) {
      const parts = job.jobNumber.split('/');
      if (parts.length === 4 && parts[3].startsWith('ER')) {
        const seq = parseInt(parts[3].replace('ER', ''), 10);
        if (!isNaN(seq)) {
          maxSeq = Math.max(maxSeq, seq);
        }
      }
    }

    const nextSeq = maxSeq + 1;
    const paddedSeq = String(nextSeq).padStart(5, '0');
    const placeholderPrefix = `RST/[POL][POD]/${year}/`;

    const jobNumber = `${placeholderPrefix}ER${paddedSeq}`;

    return {
      jobNumber,
      houseBL: jobNumber,
    };
  }



  async update(id: number, data: UpdateEmptyRepoJobDto) {
    const { containers, polPortId, podPortId, ...jobData } = data;

    return this.prisma.$transaction(async (tx) => {
      const existingJob = await tx.emptyRepoJob.findUnique({ where: { id } });
      if (!existingJob) throw new Error('Job not found');

      const updatedPolPortId = polPortId ?? existingJob.polPortId;
      const updatedPodPortId = podPortId ?? existingJob.podPortId;

      const [polPort, podPort] = await Promise.all([
        tx.ports.findUnique({ where: { id: updatedPolPortId ?? undefined } }),
        tx.ports.findUnique({ where: { id: updatedPodPortId ?? undefined } }),
      ]);

      if (!polPort || !podPort) throw new Error('Invalid port IDs');

      // Preserve existing ER sequence suffix globally, only change the prefix if ports changed
      const year = new Date().getFullYear().toString().slice(-2);
      const newPrefix = `RST/${polPort.portCode}${podPort.portCode}/${year}/`;
      const seqMatch = existingJob.jobNumber.match(/(ER\d{5})$/);
      const seqSuffix = seqMatch ? seqMatch[1] : undefined;
      const jobNumber = existingJob.jobNumber.startsWith(newPrefix) || !seqSuffix
        ? existingJob.jobNumber
        : `${newPrefix}${seqSuffix}`;

      const updatedJob = await tx.emptyRepoJob.update({
        where: { id },
        data: {
          ...jobData,
          jobNumber,
          houseBL: jobNumber,
          polPortId: updatedPolPortId,
          podPortId: updatedPodPortId,
          date: jobData.date ? new Date(jobData.date) : undefined,
          gsDate: jobData.gsDate ? new Date(jobData.gsDate) : undefined,
          sob: jobData.sob ? new Date(jobData.sob) : undefined,
          etaTopod: jobData.etaTopod ? new Date(jobData.etaTopod) : undefined,
          estimateDate: jobData.estimateDate
            ? new Date(jobData.estimateDate)
            : undefined,
        },
      });

      const existingContainers = await tx.repoShipmentContainer.findMany({
        where: { shipmentId: id },
      });

      await tx.repoShipmentContainer.deleteMany({
        where: { shipmentId: id },
      });

      const existingContainerNumbers = new Set(
        existingContainers.map((c) => c.containerNumber),
      );

      if (containers && containers.length > 0) {
        await tx.repoShipmentContainer.createMany({
          data: containers.map((container) => ({
            ...container,
            shipmentId: id,
          })),
        });

        for (const container of containers) {
          if (!existingContainerNumbers.has(container.containerNumber)) {
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
                    emptyRepoJobId: id,
                    status: 'ALLOTTED',
                    date: new Date(),
                  },
                });
              }
            }
          }
        }
      }

      return updatedJob;
    });
  }



  findAll() {
    return this.prisma.emptyRepoJob.findMany({
      include: {
        expHandlingAgentAddressBook: true,
        impHandlingAgentAddressBook: true,
        carrierAddressBook: true,
        emptyReturnDepotAddressBook: true,
        polPort: true,
        podPort: true,
        transhipmentPort: true,
        containers: true,
      },
    });
  }

  findOne(id: number) {
    return this.prisma.emptyRepoJob.findUnique({
      where: { id },
      include: {
        expHandlingAgentAddressBook: true,
        impHandlingAgentAddressBook: true,
        carrierAddressBook: true,
        emptyReturnDepotAddressBook: true,
        polPort: true,
        podPort: true,
        transhipmentPort: true,
        containers: true,
      },
    });
  }

  async cancelEmptyRepoJob(id: number, cancellationReason: string) {
    const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

    return this.prisma.$transaction(async (tx) => {
      // 1️⃣ Fetch empty repo job details (including polPortId)
      const emptyRepoJob = await tx.emptyRepoJob.findUniqueOrThrow({
        where: { id },
        select: {
          id: true,
          jobNumber: true,
          polPortId: true,
          containers: {
            select: { inventoryId: true },
          },
        },
      });

      // 2️⃣ Update empty repo job remark
      const updatedEmptyRepoJob = await tx.emptyRepoJob.update({
        where: { id },
        data: {
          remark: `[CANCELLED on ${timestamp}] ${cancellationReason}`,
          status: 'CANCELLED',
        },
      });

      // 3️⃣ Update movement history for all containers in this empty repo job
      for (const container of emptyRepoJob.containers) {
        const inventoryId = container.inventoryId;
        if (!inventoryId) continue;

        const leasingInfo = await tx.leasingInfo.findFirst({
          where: { inventoryId },
          orderBy: { createdAt: 'desc' },
        });

        // Skip containers with incomplete leasing info
        if (!leasingInfo || !leasingInfo.onHireDepotaddressbookId) {
          console.warn(
            `Skipping movement history for inventoryId ${inventoryId} - incomplete leasing info`
          );
          continue;
        }

        // 4️⃣ Create movement history entry — AVAILABLE at empty repo job’s POL (fromPort)
        await tx.movementHistory.create({
          data: {
            inventoryId,
            portId: emptyRepoJob.polPortId ?? leasingInfo.portId ?? null, // ✅ Prefer polPortId
            addressBookId: leasingInfo.onHireDepotaddressbookId ?? null,
            status: 'AVAILABLE',
            date: new Date(),
            remarks: `Empty Repo Job cancelled - ${emptyRepoJob.jobNumber}`,
            shipmentId: null,
            emptyRepoJobId: emptyRepoJob.id,
          },
        });
      }

      return updatedEmptyRepoJob;
    });
  }


  async remove(id: number) {
    return this.prisma.$transaction(async (tx) => {
      await tx.movementHistory.deleteMany({
        where: { emptyRepoJobId: id },
      });

      await tx.repoShipmentContainer.deleteMany({
        where: { shipmentId: id },
      });

      return tx.emptyRepoJob.delete({
        where: { id },
      });
    });
  }

  async markCroGenerated(id: number) {
    try {
      // Get the existing empty repo job
      const existingJob = await this.prisma.emptyRepoJob.findUnique({
        where: { id },
      });

      if (!existingJob) {
        throw new Error('Empty repo job not found');
      }

      const currentDate = new Date();
      const updateData: any = {};

      // Set hasCroGenerated to true if not already set
      if (!existingJob.hasCroGenerated) {
        updateData.hasCroGenerated = true;
      }

      // Set firstCroGenerationDate if not already set
      if (!existingJob.firstCroGenerationDate) {
        updateData.firstCroGenerationDate = currentDate;
      }

      // Only update if there's something to update
      if (Object.keys(updateData).length > 0) {
        return await this.prisma.emptyRepoJob.update({
          where: { id },
          data: updateData,
        });
      }

      return existingJob;
    } catch (error) {
      console.error('❌ Failed to mark empty repo CRO as generated:', error);
      throw new Error('Empty repo CRO generation tracking failed. See logs for details.');
    }
  }
}

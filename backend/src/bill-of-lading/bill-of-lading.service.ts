import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBillOfLadingDto } from './dto/create-bill-of-lading.dto';
import { UpdateBillOfLadingDto } from './dto/update-bill-of-lading.dto';

@Injectable()
export class BillOfLadingService {
  constructor(private prisma: PrismaService) {}

  async create(createBillOfLadingDto: CreateBillOfLadingDto) {
    try {
      const result = await this.prisma.billofLading.create({
        data: createBillOfLadingDto,
      });
      return result;
    } catch (error) {
      console.error('❌ Failed to create bill of lading:', error);
      throw new Error('Bill of lading creation failed. See logs for details.');
    }
  }

  async createOrUpdateWithGeneration(shipmentId: number, blData: Omit<CreateBillOfLadingDto, 'shipmentId'>) {
    try {
      // Check if BL already exists for this shipment
      const existingBl = await this.prisma.billofLading.findFirst({
        where: { shipmentId: shipmentId },
      });

      const currentDate = new Date();

      if (existingBl) {
        // Update existing BL
        const updateData: any = {
          ...blData,
          updatedAt: currentDate,
        };

        // Set hasDraftBlGenerated to true if not already set
        if (!existingBl.hasDraftBlGenerated) {
          updateData.hasDraftBlGenerated = true;
        }

        // Set firstGenerationDate if not already set
        if (!existingBl.firstGenerationDate) {
          updateData.firstGenerationDate = currentDate;
        }

        return await this.prisma.billofLading.update({
          where: { id: existingBl.id },
          data: updateData,
        });
      } else {
        // Create new BL with generation flags
        return await this.prisma.billofLading.create({
          data: {
            ...blData,
            shipmentId,
            hasDraftBlGenerated: true,
            firstGenerationDate: currentDate,
          },
        });
      }
    } catch (error) {
      console.error('❌ Failed to create/update bill of lading with generation:', error);
      throw new Error('Bill of lading generation failed. See logs for details.');
    }
  }

  async markOriginalBLGenerated(shipmentId: number) {
    try {
      // Check if BL already exists for this shipment
      const existingBl = await this.prisma.billofLading.findFirst({
        where: { shipmentId: shipmentId },
      });

      if (existingBl) {
        // Update existing BL to mark original BL as generated
        return await this.prisma.billofLading.update({
          where: { id: existingBl.id },
          data: {
            hasOriginalBLGenerated: true,
            updatedAt: new Date(),
          },
        });
      } else {
        throw new NotFoundException('Bill of lading not found for this shipment');
      }
    } catch (error) {
      console.error('❌ Failed to mark original BL as generated:', error);
      throw new Error('Failed to update original BL generation status. See logs for details.');
    }
  }

  async markNonNegotiableBLGenerated(shipmentId: number) {
    try {
      // Check if BL already exists for this shipment
      const existingBl = await this.prisma.billofLading.findFirst({
        where: { shipmentId: shipmentId },
      });

      if (existingBl) {
        // Update existing BL to mark non-negotiable BL as generated
        return await this.prisma.billofLading.update({
          where: { id: existingBl.id },
          data: {
            hasNonNegotiableBlGenerated: true,
            updatedAt: new Date(),
          },
        });
      } else {
        throw new NotFoundException('Bill of lading not found for this shipment');
      }
    } catch (error) {
      console.error('❌ Failed to mark non-negotiable BL as generated:', error);
      throw new Error('Failed to update non-negotiable BL generation status. See logs for details.');
    }
  }

  async markRfsBLGenerated(shipmentId: number) {
    try {
      // Check if BL already exists for this shipment
      const existingBl = await this.prisma.billofLading.findFirst({
        where: { shipmentId: shipmentId },
      });

      if (existingBl) {
        // Update existing BL to mark RFS BL as generated
        return await this.prisma.billofLading.update({
          where: { id: existingBl.id },
          data: {
            hasRfsBlGenerated: true,
            updatedAt: new Date(),
          },
        });
      } else {
        throw new NotFoundException('Bill of lading not found for this shipment');
      }
    } catch (error) {
      console.error('❌ Failed to mark RFS BL as generated:', error);
      throw new Error('Failed to update RFS BL generation status. See logs for details.');
    }
  }

  async findAll() {
    return this.prisma.billofLading.findMany({
      orderBy: { id: 'desc' },
    });
  }

  async findOne(id: number) {
    const billOfLading = await this.prisma.billofLading.findUnique({
      where: { id },
    });

    if (!billOfLading) {
      throw new NotFoundException('Bill of lading not found');
    }

    return billOfLading;
  }

  async findByShipmentId(shipmentId: number) {
    return this.prisma.billofLading.findFirst({
      where: { shipmentId: shipmentId },
      orderBy: { id: 'desc' },
    });
  }

  async update(id: number, updateBillOfLadingDto: UpdateBillOfLadingDto) {
    const existingBill = await this.prisma.billofLading.findUnique({
      where: { id },
    });

    if (!existingBill) {
      throw new NotFoundException('Bill of lading not found');
    }

    try {
      return await this.prisma.billofLading.update({
        where: { id },
        data: updateBillOfLadingDto,
      });
    } catch (error) {
      console.error('❌ Failed to update bill of lading:', error);
      throw new Error(`Bill of lading update failed: ${error.message}`);
    }
  }

  async remove(id: number) {
    const existingBill = await this.prisma.billofLading.findUnique({
      where: { id },
    });

    if (!existingBill) {
      throw new NotFoundException('Bill of lading not found');
    }

    return this.prisma.billofLading.delete({
      where: { id },
    });
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateBillManagementDto } from './dto/create-bill-management.dto';
import { UpdateBillManagementDto } from './dto/update-bill-management.dto';

@Injectable()
export class BillManagementService {
  constructor(private prisma: PrismaService) {}

  async create(createBillManagementDto: CreateBillManagementDto) {
    // Generate invoice number if not provided
    const invoiceNo = createBillManagementDto.invoiceNo || await this.generateInvoiceNumber();
    
    // Calculate due amount
    const dueAmount = createBillManagementDto.invoiceAmount - (createBillManagementDto.paidAmount || 0);
    
    // Calculate payment status
    const paymentStatus = this.calculatePaymentStatus(
      createBillManagementDto.invoiceAmount,
      createBillManagementDto.paidAmount || 0
    );

    return this.prisma.billManagement.create({
      data: {
        ...createBillManagementDto,
        invoiceNo,
        paidAmount: createBillManagementDto.paidAmount || 0,
        dueAmount,
        billingStatus: createBillManagementDto.billingStatus || 'Pending',
        paymentStatus,
      },
      include: {
        shipment: {
          include: {
            customerAddressBook: true,
            polPort: true,
            podPort: true,
          },
        },
      },
    });
  }

  async findAll() {
    return this.prisma.billManagement.findMany({
      include: {
        shipment: {
          include: {
            customerAddressBook: true,
            polPort: true,
            podPort: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(id: number) {
    const billManagement = await this.prisma.billManagement.findUnique({
      where: { id },
      include: {
        shipment: {
          include: {
            customerAddressBook: true,
            polPort: true,
            podPort: true,
          },
        },
      },
    });

    if (!billManagement) {
      throw new NotFoundException(`Bill management record with ID ${id} not found`);
    }

    return billManagement;
  }

  async update(id: number, updateBillManagementDto: UpdateBillManagementDto) {
    const existingRecord = await this.findOne(id);
    
    return this.prisma.billManagement.update({
      where: { id },
      data: updateBillManagementDto,
      include: {
        shipment: {
          include: {
            customerAddressBook: true,
            polPort: true,
            podPort: true,
          },
        },
      },
    });
  }

  async updateBillingStatus(id: number, billingStatus: string) {
    return this.update(id, { billingStatus });
  }

  async remove(id: number) {
    await this.findOne(id);
    
    return this.prisma.billManagement.delete({
      where: { id },
    });
  }

  async findByShipmentId(shipmentId: number) {
    return this.prisma.billManagement.findFirst({
      where: { shipmentId },
      include: {
        shipment: {
          include: {
            customerAddressBook: true,
            polPort: true,
            podPort: true,
          },
        },
      },
    });
  }

  async updateInvoiceDetails(id: number, updateData: {
    invoiceNo?: string;
    invoiceAmount?: number;
    paidAmount?: number;
  }) {
    const existingRecord = await this.findOne(id);
    
    // Validate amounts
    if (updateData.invoiceAmount !== undefined && updateData.invoiceAmount < 0) {
      throw new Error('Invoice amount cannot be negative');
    }
    
    if (updateData.paidAmount !== undefined && updateData.paidAmount < 0) {
      throw new Error('Paid amount cannot be negative');
    }
    
    if (updateData.invoiceAmount !== undefined && updateData.paidAmount !== undefined) {
      if (updateData.paidAmount > updateData.invoiceAmount) {
        throw new Error('Paid amount cannot be greater than invoice amount');
      }
    }

    // Calculate due amount
    const invoiceAmount = updateData.invoiceAmount ?? existingRecord.invoiceAmount;
    const paidAmount = updateData.paidAmount ?? existingRecord.paidAmount;
    const dueAmount = invoiceAmount - paidAmount;
    
    // Calculate payment status
    const paymentStatus = this.calculatePaymentStatus(invoiceAmount, paidAmount);
    
    // Update billing status to Generated only when invoice number is provided
    const billingStatus = updateData.invoiceNo && updateData.invoiceNo.trim() !== '' 
      ? 'Generated' 
      : existingRecord.billingStatus;

    return this.prisma.billManagement.update({
      where: { id },
      data: {
        ...updateData,
        dueAmount,
        paymentStatus,
        billingStatus,
      },
      include: {
        shipment: {
          include: {
            customerAddressBook: true,
            polPort: true,
            podPort: true,
          },
        },
      },
    });
  }

  async generateInvoiceNumber(): Promise<string> {
    const currentYear = new Date().getFullYear().toString().slice(-2);
    const prefix = `INV-${currentYear}-`;
    
    // Find the latest invoice number
    const latestInvoice = await this.prisma.billManagement.findFirst({
      where: {
        invoiceNo: {
          startsWith: prefix,
        },
      },
      orderBy: {
        invoiceNo: 'desc',
      },
    });

    let nextSequence = 1;
    if (latestInvoice?.invoiceNo) {
      const parts = latestInvoice.invoiceNo.split('-');
      const lastNumber = parseInt(parts[2]);
      if (!isNaN(lastNumber)) {
        nextSequence = lastNumber + 1;
      }
    }

    const paddedSequence = String(nextSequence).padStart(5, '0');
    return `${prefix}${paddedSequence}`;
  }

  private calculatePaymentStatus(invoiceAmount: number, paidAmount: number): string {
    if (paidAmount === 0) {
      return 'Unpaid';
    } else if (paidAmount >= invoiceAmount) {
      return 'Paid';
    } else {
      return 'Partial';
    }
  }
}

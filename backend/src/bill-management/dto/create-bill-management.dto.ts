import { IsString, IsNumber, IsOptional, IsInt } from 'class-validator';

export class CreateBillManagementDto {
  @IsString()
  invoiceNo: string;

  @IsNumber()
  invoiceAmount: number;

  @IsNumber()
  @IsOptional()
  paidAmount?: number;

  @IsNumber()
  dueAmount: number;

  @IsInt()
  shipmentId: number;

  @IsString()
  @IsOptional()
  billingStatus?: string;

  @IsString()
  @IsOptional()
  paymentStatus?: string;
}

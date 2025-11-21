import { IsString, IsOptional, IsNotEmpty, IsInt, IsBoolean, IsDate } from 'class-validator';

export class CreateBillOfLadingDto {
  @IsOptional()
  @IsInt()
  shipmentId?: number;

  @IsNotEmpty()
  @IsString()
  shippersName: string;

  @IsOptional()
  @IsString()
  shippersAddress?: string;

  @IsOptional()
  @IsString()
    shippedOnBoardDate?: string;

  @IsOptional()
  @IsString()
  dateOfIssue?: string;

  @IsOptional()
  @IsString()
  shippersContactNo?: string;

  @IsOptional()
  @IsString()
  shippersEmail?: string;

  @IsOptional()
  @IsString()
  shipperInfo?: string;

  @IsNotEmpty()
  @IsString()
  consigneeName: string;

  @IsOptional()
  @IsString()
  consigneeAddress?: string;

  @IsOptional()
  @IsString()
  consigneeContactNo?: string;

  @IsOptional()
  @IsString()
  consigneeEmail?: string;

  @IsOptional()
  @IsString()
  consigneeInfo?: string;

  @IsNotEmpty()
  @IsString()
  notifyPartyName: string;

  @IsOptional()
  @IsString()
  notifyPartyAddress?: string;

  @IsOptional()
  @IsString()
  notifyPartyContactNo?: string;

  @IsOptional()
  @IsString()
  notifyPartyEmail?: string;

  @IsOptional()
  @IsString()
  notifyPartyInfo?: string;

  @IsString()
  unit:string

  @IsNotEmpty()
  @IsString()
  sealNo: string;

  @IsOptional()
  @IsString()
  shippersealNo:string;


  @IsNotEmpty()
  @IsString()
  grossWt: string;

  @IsNotEmpty()
  @IsString()
  netWt: string;

  @IsOptional()
  @IsString()
  tareWt: string;

  @IsOptional()
  @IsOptional()
  cbmWt:string;

  @IsOptional()
  @IsString()
  billofLadingDetails?: string;

  @IsOptional()
  @IsString()
  freightPayableAt?: string;

  @IsNotEmpty()
  @IsString()
  deliveryAgentName: string;

  @IsOptional()
  @IsString()
  deliveryAgentAddress?: string;

  @IsOptional()
  @IsString()
  Vat?: string;

  @IsOptional()
  @IsString()
  deliveryAgentContactNo?: string;

  @IsOptional()
  @IsString()
  deliveryAgentEmail?: string;

  @IsOptional()
  @IsString()
  deliveryAgentInfo?: string;

  @IsOptional()
  @IsString()
  freightAmount?: string;

  @IsOptional()
  @IsString()
  portOfLoading?: string;

  @IsOptional()
  @IsString()
  portOfDischarge?: string;

  @IsOptional()
  @IsString()
  vesselNo?: string;

  @IsOptional()
  @IsString()
  chargesAndFees?: string;

  @IsOptional()
  @IsString()
  date?: string;

  @IsOptional()
  @IsBoolean()
  hasDraftBlGenerated?: boolean;

  @IsOptional()
  @IsDate()
  firstGenerationDate?: Date;
}

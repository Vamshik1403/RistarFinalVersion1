import { Type } from 'class-transformer';
import { IsInt, IsString, IsDateString, IsArray, ValidateNested, IsOptional, IsBoolean, IsDate } from 'class-validator';



class ShipmentContainerDto {
  @IsString()
  containerNumber: string;

  @IsString()
  capacity: string;

  @IsString()
  tare: string;

  @IsOptional()
  @IsInt()
  inventoryId?: number;

  @IsOptional()
  @IsInt()
  portId?: number;

  @IsString()
  depotName?: string;
}

export class CreateShipmentDto {
  @IsOptional()
  @IsString()
  quotationRefNumber?: string;

  @IsDateString()
  date: string;

  @IsString()
  refNumber: string;

  @IsString()
  masterBL: string;

  @IsString()
  shippingTerm: string;

  @IsString()
  remark?: string;

  @IsInt()
  custAddressBookId: number;

  @IsInt()
  productId: number;

  @IsOptional()
  @IsInt()
  consigneeAddressBookId?: number;

  @IsOptional()
  @IsInt()
  shipperAddressBookId?: number;

  @IsInt()
  polPortId: number;

  @IsInt()
  podPortId: number;

  @IsString()
  polFreeDays: string;

  @IsString()
  podFreeDays: string;

  @IsString()
  polDetentionRate: string;

  @IsString()
  podDetentionRate: string;

  @IsOptional()
  @IsInt()
  transhipmentPortId?: number;

  @IsInt()
  expHandlingAgentAddressBookId: number;

  @IsInt()
  impHandlingAgentAddressBookId: number;

  @IsString()
  quantity: string;



  @IsOptional()
  @IsInt()
  carrierAddressBookId?: number;

  @IsString()
  vesselName: string;

  @IsOptional()
  @IsDateString()
  gsDate?: string;

  @IsOptional()
  @IsDateString()
  sob?: string;

  @IsOptional()
  @IsDateString()
  etaTopod?: string;

  @IsInt()
  emptyReturnDepotAddressBookId: number;

  @IsOptional()
  @IsDateString()
  estimateDate?: string;

  @IsOptional()
  @IsString()
  tankPreparation?: string;

  @IsOptional()
  @IsBoolean()
  hasCroGenerated?: boolean;

  @IsOptional()
  @IsDate()
  firstCroGenerationDate?: Date;

    @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ShipmentContainerDto)
  containers: ShipmentContainerDto[];

}

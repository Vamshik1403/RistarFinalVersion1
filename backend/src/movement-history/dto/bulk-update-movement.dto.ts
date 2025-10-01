// src/movement-history/dto/bulk-update-movement.dto.ts
import {
  IsArray,
  IsInt,
  IsISO8601,
  IsOptional,
  IsPositive,
  IsString,
} from 'class-validator';

export class BulkUpdateMovementDto {
  @IsArray()
  ids: number[];

  @IsString()
  newStatus: string;

  @IsString()
  @IsOptional()
  jobNumber: string;

  @IsOptional()
  @IsInt()
  portId?: number;

  @IsOptional()
  @IsString()
  vesselName?: string;

  @IsOptional()
  @IsInt()
  @IsPositive()
  addressBookId?: number;
  @IsOptional()
  @IsString()
  remarks?: string;

  @IsOptional()
  @IsString()
  maintenanceStatus:string;

   @IsOptional()
  @IsInt()
  portIdFromClient?: number;

  @IsOptional()
  @IsInt()
  addressBookIdFromClient?: number;
  
  @IsOptional()
  @IsISO8601()
  date?: string;
}

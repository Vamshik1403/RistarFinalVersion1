import { PartialType } from '@nestjs/mapped-types';
import { CreateBillManagementDto } from './create-bill-management.dto';

export class UpdateBillManagementDto extends PartialType(CreateBillManagementDto) {}

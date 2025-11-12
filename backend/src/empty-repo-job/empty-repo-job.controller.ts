import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  ParseIntPipe
} from '@nestjs/common';
import { EmptyRepoJobService } from './empty-repo-job.service';
import { CreateEmptyRepoJobDto } from './dto/create-emptyRepoJob.dto';
import { UpdateEmptyRepoJobDto } from './dto/update-emptyRepoJob.dto';
import { AuthGuard } from '@nestjs/passport';


@Controller('empty-repo-job')
export class EmptyRepoJobController {
  constructor(private readonly service: EmptyRepoJobService) {}

  @UseGuards(AuthGuard('jwt'))
  @Post()
  create(@Body() dto: CreateEmptyRepoJobDto) {
    return this.service.create(dto);
  }

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get('job/next')
  async getNextJobNumber() {
    return this.service.getNextJobNumber();
  }

  @UseGuards(AuthGuard('jwt'))
   @Patch('cancel/:id')
  async cancel(
    @Param('id') id: string,
    @Body() body: { cancellationReason: string },
  ) {
    const { cancellationReason } = body;
    if (!cancellationReason || !cancellationReason.trim()) {
      throw new Error('Cancellation reason is required.');
    }
    return this.service.cancelEmptyRepoJob(+id, cancellationReason);
  }


  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(+id);
  }

     @UseGuards(AuthGuard('jwt'))  
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateEmptyRepoJobDto) {
    return this.service.update(+id, dto);
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(+id);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('mark-cro-generated/:id')
  markCroGenerated(@Param('id', ParseIntPipe) id: number) {
    return this.service.markCroGenerated(id);
  }
}

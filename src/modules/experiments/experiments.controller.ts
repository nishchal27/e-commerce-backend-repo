import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { ExperimentsService } from './experiments.service';
import { CreateExperimentDto } from './dto/create-experiment.dto';

@Controller('experiments')
export class ExperimentsController {
  constructor(private svc: ExperimentsService) {}

  // Protect this route (token) — replace UseGuards as per your auth setup
  @Post('report')
  async report(@Body() dto: CreateExperimentDto) {
    const saved = await this.svc.create(dto);
    return { ok: true, id: saved.id };
  }
}

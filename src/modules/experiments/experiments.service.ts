//This file is a service for the experiments feature.
//It is used to encapsulate the business logic for the experiments feature.
//It is also used to define the methods for the experiments feature.
//It is also used to define the dependencies for the experiments feature.
//It is also used to define the exports for the experiments feature.

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../lib/prisma/prisma.service'; 
import { CreateExperimentDto } from './dto/create-experiment.dto';
import { Decimal } from '@prisma/client/runtime/library';
import { Prisma } from '@prisma/client';

@Injectable()
export class ExperimentsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateExperimentDto) {
    return this.prisma.experiment.create({
      data: {
        name: dto.name,
        description: dto.notes || '',
        variant: 'baseline',
        metric: 'avg_response_time',
        value: new Decimal(dto.metricsSummary.avg_ms || 0),
        metadata: dto.rawFile ? JSON.parse(dto.rawFile) : null
      } as unknown as Prisma.ExperimentCreateInput
    });
  } 
}

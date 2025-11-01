//This file is a module for the experiments feature.
//It is used to encapsulate the experiments feature and provide a way to import and use it in other modules.
//It is also used to define the controllers and services for the experiments feature.
//It is also used to define the dependencies for the experiments feature.
//It is also used to define the exports for the experiments feature.
     

import { Module } from '@nestjs/common';
import { ExperimentsService } from './experiments.service';
import { ExperimentsController } from './experiments.controller';
import { PrismaService } from '../../lib/prisma/prisma.service';

@Module({
  imports: [],
  controllers: [ExperimentsController],
  providers: [ExperimentsService, PrismaService],
})
export class ExperimentsModule {}

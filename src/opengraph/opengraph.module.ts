import { Module } from '@nestjs/common';
import { OpenGraphController } from './opengraph.controller';
import { OpenGraphService } from './opengraph.service';

@Module({
  controllers: [OpenGraphController],
  providers: [OpenGraphService],
  exports: [OpenGraphService],
})
export class OpenGraphModule {}

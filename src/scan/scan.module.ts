import { Module } from '@nestjs/common';
import { ScanController } from './scan.controller';
import { ScanService } from './scan.service';
import { CrawlModule } from '../crawl/crawl.module';
import { TechCrawlModule } from '../tech-crawl/tech-crawl.module';
import { AIModule } from '../ai/ai.module';

@Module({
  imports: [CrawlModule, TechCrawlModule, AIModule],
  controllers: [ScanController],
  providers: [ScanService],
})
export class ScanModule {}

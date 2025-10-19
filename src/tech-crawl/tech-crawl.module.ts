import { Module } from '@nestjs/common';
import { TechCrawlService } from './tech-crawl.service';

@Module({
  providers: [TechCrawlService],
  exports: [TechCrawlService],
})
export class TechCrawlModule {}

import { Module } from '@nestjs/common';
import { ScanController } from './scan.controller';
import { ScanService } from './scan.service';
import { CrawlModule } from '../crawl/crawl.module';
import { TechCrawlModule } from '../tech-crawl/tech-crawl.module';

@Module({
  imports: [CrawlModule, TechCrawlModule],
  controllers: [ScanController],
  providers: [ScanService],
})
export class ScanModule {}

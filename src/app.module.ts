import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { CrawlModule } from './crawl/crawl.module';
import { TechCrawlModule } from './tech-crawl/tech-crawl.module';
import { ScanModule } from './scan/scan.module';

@Module({
  imports: [
    PrismaModule,
    CrawlModule,
    TechCrawlModule,
    ScanModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

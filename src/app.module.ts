import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { CrawlModule } from './crawl/crawl.module';
import { TechCrawlModule } from './tech-crawl/tech-crawl.module';
import { ScanModule } from './scan/scan.module';
import { OpenGraphModule } from './opengraph/opengraph.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    PrismaModule,
    CrawlModule,
    TechCrawlModule,
    ScanModule,
    OpenGraphModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

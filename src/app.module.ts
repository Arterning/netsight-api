import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { CrawlModule } from './crawl/crawl.module';
import { TechCrawlModule } from './tech-crawl/tech-crawl.module';
import { ScanModule } from './scan/scan.module';
import { OpenGraphModule } from './opengraph/opengraph.module';
import { KnowledgeModule } from './knowledge/knowledge.module';
import { AIModule } from './ai/ai.module';
import { ApiKeyGuard } from './common/guards/api-key.guard';

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
    KnowledgeModule,
    AIModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ApiKeyGuard,
    },
  ],
})
export class AppModule {}

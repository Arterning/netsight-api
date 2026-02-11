import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  // --- 全局忽略 SSL 证书验证配置 ---
  // 设置为 '0' 会禁用 Node.js 对所有 HTTPS 请求的证书验证
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);
  app.enableCors(); // 允许跨域请求
  const port = process.env.PORT || 3000;
  await app.listen(port);

  // --- 启动后的确认提示 ---
  logger.warn('=================================================');
  logger.warn('🚀 全局 SSL 证书忽略已启用 (NODE_TLS_REJECT_UNAUTHORIZED=0)');
  logger.warn(`📡 服务监听端口: ${port}`);
  logger.warn('=================================================');
}

bootstrap();
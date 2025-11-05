import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { Public } from './common/decorators/public.decorator';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Public() // 标记为公开接口，不需要 API key
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}

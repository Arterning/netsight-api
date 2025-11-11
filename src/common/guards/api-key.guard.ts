import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private configService: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    // 检查是否标记为 @Public()
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    let apiKey = request.headers['x-api-key'] || request.headers['authorization'];
    const validApiKey = this.configService.get<string>('API_KEY');

    if (!apiKey) {
      throw new UnauthorizedException('API key is missing');
    }

    // 去掉 Bearer 前缀
    if (apiKey.startsWith('Bearer ')) {
      apiKey = apiKey.slice('Bearer '.length);
    }

    if (apiKey !== validApiKey) {
      throw new UnauthorizedException('Invalid API key');
    }

    return true;
  }
}

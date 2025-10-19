import { IsString, IsBoolean, IsArray, IsOptional, IsEnum, IsNumber, MinLength, IsUrl } from 'class-validator';

export enum CrawlDepth {
  LEVEL1 = 'level1',
  LEVEL2 = 'level2',
  LEVEL3 = 'level3',
  FULL = 'full',
}

export enum ScanRate {
  SLOW = 'slow',
  NORMAL = 'normal',
  FAST = 'fast',
}

export enum ScheduleType {
  ONCE = 'once',
  DAILY = 'daily',
  WEEKLY = 'weekly',
  EVERY3DAYS = 'every3days',
  MONTHLY = 'monthly',
}

export class ScanDto {
  @IsOptional()
  @IsString()
  taskName?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  ipRange?: string;

  @IsString()
  @MinLength(1, { message: 'URL是必需的。' })
  @IsUrl({}, { message: '请输入有效的URL。' })
  url: string;

  @IsOptional()
  @IsEnum(CrawlDepth)
  crawlDepth?: CrawlDepth = CrawlDepth.LEVEL2;

  @IsOptional()
  @IsBoolean()
  extractImages?: boolean = true;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  valueKeywords?: string[] = ['政府', '国家', '金融监管'];

  @IsOptional()
  @IsEnum(ScanRate)
  scanRate?: ScanRate = ScanRate.NORMAL;

  @IsOptional()
  @IsBoolean()
  isScheduled?: boolean = false;

  @IsOptional()
  @IsEnum(ScheduleType)
  scheduleType?: ScheduleType;

  @IsOptional()
  @IsNumber()
  customCrawlDepth?: number;

  @IsOptional()
  @IsString()
  proxy?: string;
}

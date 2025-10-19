import { IsUrl, IsOptional, IsString } from 'class-validator';

export class OpenGraphDto {
  @IsUrl()
  url: string;

  @IsOptional()
  @IsString()
  proxy?: string;
}

export interface OpenGraphResult {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
  type: string | null;
  locale: string | null;
  favicon: string | null;
  twitterCard: string | null;
  twitterSite: string | null;
  twitterCreator: string | null;
  twitterTitle: string | null;
  twitterDescription: string | null;
  twitterImage: string | null;
  [key: string]: any;
}

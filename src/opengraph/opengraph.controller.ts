import { Controller, Post, Body, HttpException, HttpStatus, Get, Query } from '@nestjs/common';
import { OpenGraphService } from './opengraph.service';
import { OpenGraphDto } from './dto/opengraph.dto';

@Controller('opengraph')
export class OpenGraphController {
  constructor(private readonly openGraphService: OpenGraphService) {}

  /**
   * POST /opengraph
   * 爬取单个网站的 OpenGraph 信息
   */
  @Post()
  async scrapeOpenGraph(@Body() dto: OpenGraphDto) {
    try {
      const result = await this.openGraphService.scrapeOpenGraph(dto.url, dto.proxy);
      return {
        success: true,
        data: result,
      };
    } catch (error) {
      console.error('OpenGraph scraping error:', error);
      throw new HttpException(
        {
          success: false,
          error: error.message || 'Failed to scrape OpenGraph data',
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * GET /opengraph
   * 通过查询参数爬取单个网站的 OpenGraph 信息
   */
  @Get()
  async scrapeOpenGraphByQuery(
    @Query('url') url: string,
    @Query('proxy') proxy?: string,
  ) {
    if (!url) {
      throw new HttpException(
        {
          success: false,
          error: 'URL parameter is required',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const result = await this.openGraphService.scrapeOpenGraph(url, proxy);
      return {
        success: true,
        data: result,
      };
    } catch (error) {
      console.error('OpenGraph scraping error:', error);
      throw new HttpException(
        {
          success: false,
          error: error.message || 'Failed to scrape OpenGraph data',
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * POST /opengraph/batch
   * 批量爬取多个网站的 OpenGraph 信息
   */
  @Post('batch')
  async scrapeMultiple(@Body() body: { urls: string[]; proxy?: string }) {
    if (!body.urls || !Array.isArray(body.urls) || body.urls.length === 0) {
      throw new HttpException(
        {
          success: false,
          error: 'urls array is required and must not be empty',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const results = await this.openGraphService.scrapeMultiple(body.urls, body.proxy);
      return {
        success: true,
        data: results,
      };
    } catch (error) {
      console.error('Batch OpenGraph scraping error:', error);
      throw new HttpException(
        {
          success: false,
          error: error.message || 'Failed to scrape OpenGraph data',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}

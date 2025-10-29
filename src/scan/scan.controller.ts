import { Controller, Post, Body, HttpException, HttpStatus, Get, Param } from '@nestjs/common';
import { ScanService } from './scan.service';
import { ScanDto } from './dto/scan.dto';

@Controller('scan')
export class ScanController {
  constructor(private readonly scanService: ScanService) {}

  @Post()
  async scan(@Body() scanDto: ScanDto) {
    try {
      const result = await this.scanService.scanAndAnalyze(scanDto);

      if (result.error) {
        throw new HttpException({ error: result.error }, HttpStatus.BAD_REQUEST);
      }

      return result;
    } catch (error) {
      console.error('API Error:', error);
      if (error instanceof SyntaxError) {
        throw new HttpException({ error: 'Invalid JSON body' }, HttpStatus.BAD_REQUEST);
      }
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException({ error: 'An unexpected error occurred.' }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('task/:id')
  async getTaskExecution(@Param('id') id: string) {
    try {
      const result = await this.scanService.getTaskExecutionById(id);

      if (!result) {
        throw new HttpException({ error: 'Task execution not found' }, HttpStatus.NOT_FOUND);
      }

      return result;
    } catch (error) {
      console.error('API Error:', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException({ error: 'An unexpected error occurred.' }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}

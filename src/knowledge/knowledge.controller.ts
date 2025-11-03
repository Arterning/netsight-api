import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { KnowledgeService } from './knowledge.service';
import { CreateKnowledgeDto, UpdateKnowledgeDto } from './dto/knowledge.dto';

@Controller('knowledge')
export class KnowledgeController {
  constructor(private readonly knowledgeService: KnowledgeService) {}

  // 创建知识库条目
  @Post()
  async create(@Body() createKnowledgeDto: CreateKnowledgeDto) {
    try {
      return await this.knowledgeService.create(createKnowledgeDto);
    } catch (error) {
      console.error('创建知识库条目失败:', error);
      throw new HttpException(
        { error: '创建知识库条目失败' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // 获取所有知识库条目
  @Get()
  async findAll() {
    try {
      return await this.knowledgeService.findAll();
    } catch (error) {
      console.error('获取知识库列表失败:', error);
      throw new HttpException(
        { error: '获取知识库列表失败' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // 根据ID获取单个知识库条目
  @Get(':id')
  async findOne(@Param('id') id: string) {
    try {
      return await this.knowledgeService.findOne(id);
    } catch (error) {
      console.error('获取知识库条目失败:', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        { error: '获取知识库条目失败' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // 更新知识库条目
  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updateKnowledgeDto: UpdateKnowledgeDto,
  ) {
    try {
      return await this.knowledgeService.update(id, updateKnowledgeDto);
    } catch (error) {
      console.error('更新知识库条目失败:', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        { error: '更新知识库条目失败' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // 删除知识库条目
  @Delete(':id')
  async remove(@Param('id') id: string) {
    try {
      await this.knowledgeService.remove(id);
      return { message: '知识库条目删除成功' };
    } catch (error) {
      console.error('删除知识库条目失败:', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        { error: '删除知识库条目失败' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}

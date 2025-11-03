import {
  Controller,
  Post,
  Body,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { AIService } from './ai.service';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { ChatDto } from './dto/chat.dto';

@Controller('ai')
export class AIController {
  constructor(
    private readonly aiService: AIService,
    private readonly knowledgeService: KnowledgeService,
  ) {}

  // AI对话接口
  @Post('chat')
  async chat(@Body() chatDto: ChatDto) {
    try {
      // 获取所有知识库内容作为上下文
      const knowledgeContext =
        await this.knowledgeService.getAllKnowledgeAsContext();

      // 调用AI服务进行对话
      const result = await this.aiService.chat(
        chatDto.question,
        knowledgeContext,
      );

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      console.error('AI对话失败:', error);
      throw new HttpException(
        { error: 'AI对话失败，请稍后再试' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}

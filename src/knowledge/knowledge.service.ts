import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateKnowledgeDto, UpdateKnowledgeDto } from './dto/knowledge.dto';

@Injectable()
export class KnowledgeService {
  constructor(private readonly prisma: PrismaService) {}

  // 创建知识库条目
  async create(createKnowledgeDto: CreateKnowledgeDto) {
    return await this.prisma.knowledge.create({
      data: createKnowledgeDto,
    });
  }

  // 获取所有知识库条目
  async findAll() {
    return await this.prisma.knowledge.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  // 根据ID获取单个知识库条目
  async findOne(id: string) {
    const knowledge = await this.prisma.knowledge.findUnique({
      where: { id },
    });

    if (!knowledge) {
      throw new NotFoundException(`ID为 ${id} 的知识库条目不存在`);
    }

    return knowledge;
  }

  // 更新知识库条目
  async update(id: string, updateKnowledgeDto: UpdateKnowledgeDto) {
    // 先检查是否存在
    await this.findOne(id);

    return await this.prisma.knowledge.update({
      where: { id },
      data: updateKnowledgeDto,
    });
  }

  // 删除知识库条目
  async remove(id: string) {
    // 先检查是否存在
    await this.findOne(id);

    return await this.prisma.knowledge.delete({
      where: { id },
    });
  }

  // 获取所有知识库内容作为上下文（用于AI对话）
  async getAllKnowledgeAsContext(): Promise<string> {
    const knowledgeList = await this.prisma.knowledge.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (knowledgeList.length === 0) {
      return '当前知识库为空。';
    }

    // 将所有知识库条目格式化为文本
    const context = knowledgeList
      .map((item, index) => {
        return `【知识${index + 1}】标题: ${item.title}\n内容: ${item.content}`;
      })
      .join('\n\n');

    return context;
  }
}

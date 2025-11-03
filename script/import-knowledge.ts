import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface KnowledgeItem {
  title: string;
  content: string;
}

/**
 * 解析 markdown 文件，提取标题和内容
 * 如果文件有 # 标题，则按标题分割
 * 否则使用文件名作为标题
 */
function parseMarkdownFile(filePath: string): KnowledgeItem[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const fileName = path.basename(filePath, '.md');

  // 尝试按 markdown 标题分割
  const sections: KnowledgeItem[] = [];
  const lines = content.split('\n');

  let currentTitle = '';
  let currentContent: string[] = [];
  let hasH1 = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 检测 # 标题
    const h1Match = line.match(/^#\s+(.+)$/);
    if (h1Match) {
      hasH1 = true;
      // 保存前一个section
      if (currentTitle || currentContent.length > 0) {
        sections.push({
          title: currentTitle || fileName,
          content: currentContent.join('\n').trim(),
        });
      }

      // 开始新的section
      currentTitle = h1Match[1];
      currentContent = [];
      continue;
    }

    // 检测 ## 标题 (作为子标题，不分割)
    const h2Match = line.match(/^##\s+(.+)$/);
    if (h2Match && hasH1) {
      currentContent.push(line);
      continue;
    }

    // 普通内容
    currentContent.push(line);
  }

  // 保存最后一个section
  if (currentTitle || currentContent.length > 0) {
    sections.push({
      title: currentTitle || fileName,
      content: currentContent.join('\n').trim(),
    });
  }

  // 如果没有找到任何标题，使用整个文件作为一个条目
  if (sections.length === 0 || !hasH1) {
    return [{
      title: fileName.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      content: content.trim(),
    }];
  }

  return sections;
}

/**
 * 导入知识库到数据库
 */
async function importKnowledge() {
  try {
    console.log('开始导入知识库...\n');

    const knowledgeFilePath = path.join(__dirname, 'knowledge.md');

    if (!fs.existsSync(knowledgeFilePath)) {
      console.error(`错误: 找不到文件 ${knowledgeFilePath}`);
      process.exit(1);
    }

    console.log(`读取文件: ${knowledgeFilePath}`);

    const knowledgeItems = parseMarkdownFile(knowledgeFilePath);

    console.log(`解析到 ${knowledgeItems.length} 个知识库条目\n`);

    let successCount = 0;
    let errorCount = 0;

    for (const item of knowledgeItems) {
      try {
        const created = await prisma.knowledge.create({
          data: {
            title: item.title,
            content: item.content,
          },
        });

        console.log(`✅ 成功导入: ${item.title}`);
        console.log(`   ID: ${created.id}`);
        console.log(`   内容长度: ${item.content.length} 字符\n`);
        successCount++;
      } catch (error) {
        console.error(`❌ 导入失败: ${item.title}`);
        console.error(`   错误: ${error.message}\n`);
        errorCount++;
      }
    }

    console.log('\n导入完成！');
    console.log(`成功: ${successCount} 条`);
    console.log(`失败: ${errorCount} 条`);

  } catch (error) {
    console.error('导入过程中发生错误:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// 执行导入
importKnowledge();

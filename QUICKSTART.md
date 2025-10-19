# 快速启动指南

## 前置要求

- Node.js >= 20.x
- PostgreSQL >= 14
- pnpm (推荐) 或 npm

## 5分钟快速开始

### 1. 安装依赖

```bash
cd net-sight-api
pnpm install
```

### 2. 配置数据库

创建 `.env` 文件:

```bash
cp .env.example .env
```

编辑 `.env`,修改数据库连接:

```env
DATABASE_URL="postgresql://用户名:密码@localhost:5432/数据库名?schema=public"
```

### 3. 初始化数据库

```bash
# 生成 Prisma Client
npx prisma generate

# 推送数据库 schema
npx prisma db push
```

### 4. 启动服务

```bash
pnpm run start:dev
```

服务将在 `http://localhost:3000` 启动。

### 5. 测试扫描接口

```bash
curl -X POST http://localhost:3000/scan \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "crawlDepth": "level1"
  }'
```

你会得到类似这样的响应:

```json
{
  "taskExecutionId": "clxxx123456",
  "error": null
}
```

## 查看扫描结果

### 使用 Prisma Studio (推荐)

```bash
npx prisma studio
```

这会在浏览器中打开 `http://localhost:5555`,你可以在这里查看所有数据表:

- **TaskExecution**: 查看任务执行状态
- **Asset**: 查看扫描到的资产
- **Webpage**: 查看爬取的网页详情
- **ApiEndpoint**: 查看捕获的 API 请求

### 使用 SQL 查询

```sql
-- 查看最近的任务
SELECT * FROM "TaskExecution" ORDER BY "createdAt" DESC LIMIT 5;

-- 查看扫描到的资产
SELECT id, url, domain, name, status, "createdAt"
FROM "Asset"
ORDER BY "createdAt" DESC;

-- 查看某个资产的所有网页
SELECT url, title, "isHomepage"
FROM "Webpage"
WHERE "assetId" = '你的资产ID';
```

## 常见使用场景

### 场景1: 扫描单个网站首页

```bash
curl -X POST http://localhost:3000/scan \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-target-site.com",
    "crawlDepth": "level1",
    "taskName": "首页快速扫描"
  }'
```

### 场景2: 深度扫描网站(首页+2层)

```bash
curl -X POST http://localhost:3000/scan \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-target-site.com",
    "crawlDepth": "level3",
    "customCrawlDepth": 2,
    "taskName": "深度扫描"
  }'
```

### 场景3: 使用代理扫描

```bash
curl -X POST http://localhost:3000/scan \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-target-site.com",
    "proxy": "http://127.0.0.1:7890",
    "crawlDepth": "level2"
  }'
```

### 场景4: 创建定时任务(每天执行)

```bash
curl -X POST http://localhost:3000/scan \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-target-site.com",
    "isScheduled": true,
    "scheduleType": "daily",
    "taskName": "每日安全扫描"
  }'
```

## 下一步

### 1. 集成 AI 分析

编辑 `src/scan/scan.service.ts` 的 `performScan` 方法,找到这段代码:

```typescript
// 在第 169 行左右
const analysisResult = `网站分析: ${homepageTitle}`;
const businessValueResult = {
  valuePropositionScore: 50,
  analysis: '业务价值分析',
  keywords: '关键词1, 关键词2'
};
const associationResult = 'IP关联分析结果';
```

替换为你的 AI 服务调用:

```typescript
import { OpenAI } from 'openai';

// 在 constructor 中初始化
private openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 在 performScan 中调用
const analysisResult = await this.analyzeWithAI(content);

private async analyzeWithAI(content: string): Promise<string> {
  const completion = await this.openai.chat.completions.create({
    model: 'gpt-4',
    messages: [
      {
        role: 'system',
        content: '你是一个网站分析专家,请分析网站内容并提供简洁的摘要。'
      },
      {
        role: 'user',
        content: `请分析以下网站内容:\n\n${content.substring(0, 4000)}`
      }
    ],
  });

  return completion.choices[0].message.content || '分析失败';
}
```

### 2. 添加更多接口

你可以参考 `src/scan` 模块,创建更多功能:

- 查询任务状态: `GET /tasks/:id`
- 获取资产列表: `GET /assets`
- 导出扫描报告: `GET /reports/:assetId`

### 3. 添加认证

使用 NestJS 的 Guard 和 Passport 添加 JWT 认证:

```bash
pnpm add @nestjs/passport passport passport-jwt
pnpm add -D @types/passport-jwt
```

## 故障排除

### 问题1: 端口被占用

修改 `src/main.ts` 中的端口:

```typescript
await app.listen(3001); // 改为其他端口
```

### 问题2: Puppeteer 下载失败

使用国内镜像:

```bash
export PUPPETEER_DOWNLOAD_HOST=https://registry.npmmirror.com/-/binary/chromium-browser-snapshots
pnpm install
```

### 问题3: 数据库连接错误

确保 PostgreSQL 正在运行:

```bash
# Ubuntu/Debian
sudo systemctl status postgresql

# macOS
brew services list

# Windows
# 检查 服务 -> PostgreSQL
```

## 进阶配置

### 启用详细日志

在 `src/main.ts` 中添加:

```typescript
app.useLogger(['log', 'error', 'warn', 'debug', 'verbose']);
```

### 配置CORS

```typescript
app.enableCors({
  origin: '*',
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  credentials: true,
});
```

### 添加全局异常过滤器

```typescript
import { AllExceptionsFilter } from './filters/all-exceptions.filter';
app.useGlobalFilters(new AllExceptionsFilter());
```

## 获取帮助

- 查看完整文档: [README_CN.md](./README_CN.md)
- 查看 API Schema: `http://localhost:3000/api` (需要安装 @nestjs/swagger)
- 提交 Issue: GitHub Issues

祝使用愉快! 🚀

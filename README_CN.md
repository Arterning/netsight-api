# NetSight API - AI爬虫接口

基于 NestJS、Prisma 和 Puppeteer 的网站扫描和分析 API 服务。

## 功能特性

- 🔍 **网站爬取**: 使用 Puppeteer 进行深度网页爬取
- 🛡️ **安全扫描**: 自动检测常见安全漏洞(XSS, CSRF, Clickjacking 等)
- 🔧 **技术栈检测**: 识别网站使用的技术框架、CMS、库等
- 📊 **API 请求监控**: 捕获和分析网页中的 API 调用
- 🗺️ **网站地图生成**: 自动生成 sitemap.xml
- 🔗 **域名关联分析**: 追踪和记录跨域链接
- 📈 **定时任务**: 支持定时扫描任务

## 技术栈

- **NestJS**: 后端框架
- **Prisma**: ORM 数据库操作
- **Puppeteer**: 无头浏览器爬取
- **PostgreSQL**: 数据库
- **TypeScript**: 类型安全

## 安装

```bash
# 使用 pnpm 安装依赖
pnpm install
```

## 配置

### 1. 环境变量

复制 `.env.example` 为 `.env` 并配置:

```bash
cp .env.example .env
```

编辑 `.env` 文件:

```env
# 数据库连接
DATABASE_URL="postgresql://user:password@localhost:5432/netsight?schema=public"

# AI 服务配置 (可选,用于内容分析)
# OPENAI_API_KEY=your_openai_api_key
```

### 2. 数据库迁移

```bash
# 生成 Prisma Client
npx prisma generate

# 运行数据库迁移
npx prisma migrate dev --name init

# 或者直接推送 schema (开发环境)
npx prisma db push
```

## 运行

```bash
# 开发模式
pnpm run start:dev

# 生产模式
pnpm run build
pnpm run start:prod
```

服务将在 `http://localhost:3000` 启动。

## API 使用

### 扫描接口

**端点**: `POST /scan`

**请求体**:

```json
{
  "url": "https://example.com",
  "taskName": "扫描示例网站",
  "description": "这是一个测试扫描",
  "crawlDepth": "level2",
  "scanRate": "normal",
  "isScheduled": false,
  "proxy": ""
}
```

**参数说明**:

| 参数 | 类型 | 必填 | 说明 | 默认值 |
|------|------|------|------|--------|
| url | string | 是 | 要扫描的URL | - |
| taskName | string | 否 | 任务名称 | Scan_时间戳 |
| description | string | 否 | 任务描述 | - |
| crawlDepth | enum | 否 | 爬取深度: level1(首页), level2(首页+1层), level3(自定义), full(全站) | level2 |
| customCrawlDepth | number | 否 | 自定义爬取深度 | 2 |
| scanRate | enum | 否 | 扫描速率: slow, normal, fast | normal |
| isScheduled | boolean | 否 | 是否为定时任务 | false |
| scheduleType | enum | 否 | 定时类型: once, daily, weekly, every3days, monthly | - |
| proxy | string | 否 | 代理服务器 (格式: http://host:port) | - |
| valueKeywords | string[] | 否 | 业务价值关键词 | ['政府', '国家', '金融监管'] |

**响应**:

```json
{
  "taskExecutionId": "clxxx123456",
  "error": null
}
```

**使用示例**:

```bash
# 基础扫描
curl -X POST http://localhost:3000/scan \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "crawlDepth": "level2"
  }'

# 使用代理扫描
curl -X POST http://localhost:3000/scan \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "proxy": "http://127.0.0.1:7890",
    "crawlDepth": "full"
  }'
```

## 数据模型

### Asset (资产)
存储扫描到的网站资产信息,包括:
- 基本信息: URL, IP, 域名
- 技术信息: 技术栈报告、开放端口
- 安全信息: 敏感页面、漏洞
- 元数据: 图片、favicon、metadata

### Webpage (网页)
存储爬取的每个页面的详细信息:
- HTML 内容
- 可见文本内容
- 页面标题
- 漏洞信息
- 截图 (Base64)

### ApiEndpoint (API端点)
捕获到的 API 请求:
- 请求方法和 URL
- 请求/响应头
- 请求体和响应体
- 响应状态和耗时

### TaskExecution (任务执行)
任务执行记录:
- 执行状态
- 开始/结束时间
- 执行阶段
- 发现的资产数量

## AI 分析集成

当前版本中,AI 分析功能返回占位符数据。要启用真实的 AI 分析,你需要:

1. **配置 AI 服务**: 在 `.env` 中添加 API Key
2. **实现 AI 服务**: 在 `src/scan/scan.service.ts` 中找到以下部分并替换:

```typescript
// TODO: 实现 AI 分析
// 在 performScan 方法中找到这段代码:
const analysisResult = `网站分析: ${homepageTitle}`;
const businessValueResult = {
  valuePropositionScore: 50,
  analysis: '业务价值分析',
  keywords: '关键词1, 关键词2'
};
const associationResult = 'IP关联分析结果';

// 替换为你的 AI 服务调用,例如:
// const analysisResult = await this.aiService.analyzeWebsiteContent({ url, content });
// const businessValueResult = await this.aiService.determineBusinessValue({ url, content, valueKeywords });
// const associationResult = await this.aiService.ipAssociationAnalysis({ ip });
```

推荐的 AI 服务:
- OpenAI GPT API
- Anthropic Claude API
- Google Gemini API
- 自建 LLM 服务

## 项目结构

```
net-sight-api/
├── prisma/
│   └── schema.prisma          # 数据库模型
├── src/
│   ├── prisma/                # Prisma 服务
│   │   ├── prisma.module.ts
│   │   └── prisma.service.ts
│   ├── crawl/                 # 爬虫服务
│   │   ├── crawl.module.ts
│   │   └── crawl.service.ts
│   ├── tech-crawl/            # 技术栈检测
│   │   ├── tech-crawl.module.ts
│   │   └── tech-crawl.service.ts
│   ├── scan/                  # 扫描接口
│   │   ├── dto/
│   │   │   └── scan.dto.ts
│   │   ├── scan.controller.ts
│   │   ├── scan.service.ts
│   │   └── scan.module.ts
│   ├── app.module.ts          # 主模块
│   └── main.ts                # 入口文件
├── .env.example               # 环境变量示例
└── README.md
```

## 开发说明

### 添加新的扫描规则

在 `src/crawl/crawl.service.ts` 中的 `crawlPage` 方法里添加新的检测逻辑。

### 扩展技术栈检测

在 `src/tech-crawl/tech-crawl.service.ts` 中添加新的检测方法:
- `detectSoftware()`: 软件检测
- `detectFrameworks()`: 框架检测
- `detectCMS()`: CMS 检测

### 数据库查询

使用 Prisma Client 进行数据库操作:

```typescript
// 注入 PrismaService
constructor(private prisma: PrismaService) {}

// 查询资产
const assets = await this.prisma.asset.findMany({
  where: { status: 'Active' },
  include: { webpages: true }
});
```

## 常见问题

### 1. Puppeteer 无法启动

确保系统已安装必要的依赖:

```bash
# Ubuntu/Debian
sudo apt-get install -y gconf-service libasound2 libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgcc1 libgconf-2-4 libgdk-pixbuf2.0-0 libglib2.0-0 libgtk-3-0 libnspr4 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 ca-certificates fonts-liberation libappindicator1 libnss3 lsb-release xdg-utils wget
```

### 2. 数据库连接失败

检查 `DATABASE_URL` 是否正确,确保 PostgreSQL 服务运行中。

### 3. 代理设置不生效

代理格式应为: `http://host:port` 或 `https://host:port`

## 待办事项

- [ ] 集成 AI 分析服务
- [ ] 添加任务队列 (Bull/BullMQ)
- [ ] 实现定时任务调度器
- [ ] 添加 WebSocket 实时进度推送
- [ ] 实现 IP 范围扫描
- [ ] 添加扫描结果导出功能 (PDF/Excel)
- [ ] 实现用户认证和权限管理

## License

MIT

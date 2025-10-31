# AI 集成说明

本项目已集成 AI 网站内容分析功能，支持多个主流 AI 提供商。

## 支持的 AI 提供商

1. **OpenAI** (GPT-4, GPT-3.5-turbo 等)
2. **DeepSeek** (deepseek-chat, deepseek-coder)
3. **Claude** (Claude 3.5 Sonnet, Claude 3 Opus 等)

## 配置方式

### 1. 本地开发环境

编辑 `.env` 文件，添加以下配置：

```env
# 必需配置
AI_PROVIDER=openai              # 可选值: openai, deepseek, claude
AI_API_KEY=your_api_key_here    # 你的 API 密钥
AI_MODEL_NAME=gpt-4             # 模型名称

# 可选配置
AI_BASE_URL=                    # 自定义 API 端点（可选）
AI_MAX_TOKENS=4000              # 最大token数（默认4000）
AI_TEMPERATURE=0.7              # 温度参数（默认0.7）
```

### 2. Docker 部署环境

#### 方式一：通过环境变量文件

创建 `.env` 文件（推荐）：

```env
AI_PROVIDER=openai
AI_API_KEY=sk-your-api-key
AI_MODEL_NAME=gpt-4
```

然后启动：

```bash
docker-compose up -d
```

#### 方式二：通过命令行传递

```bash
AI_PROVIDER=deepseek \
AI_API_KEY=your-deepseek-key \
AI_MODEL_NAME=deepseek-chat \
docker-compose up -d
```

#### 方式三：修改 docker-compose.yml

直接在 `docker-compose.yml` 中修改环境变量的默认值。

## 各提供商配置示例

### OpenAI 配置

```env
AI_PROVIDER=openai
AI_API_KEY=sk-proj-xxxxxxxxxxxxx
AI_MODEL_NAME=gpt-4
# 可选：使用代理或自定义端点
# AI_BASE_URL=https://api.openai.com/v1
```

推荐模型：
- `gpt-4` - 最强性能
- `gpt-4-turbo` - 性能强且速度快
- `gpt-3.5-turbo` - 经济实惠

### DeepSeek 配置

```env
AI_PROVIDER=deepseek
AI_API_KEY=your-deepseek-api-key
AI_MODEL_NAME=deepseek-chat
AI_BASE_URL=https://api.deepseek.com/v1
```

推荐模型：
- `deepseek-chat` - 通用对话模型
- `deepseek-coder` - 代码分析专用

### Claude 配置

```env
AI_PROVIDER=claude
AI_API_KEY=sk-ant-xxxxxxxxxxxxx
AI_MODEL_NAME=claude-3-5-sonnet-20241022
AI_BASE_URL=https://api.anthropic.com/v1
```

推荐模型：
- `claude-3-5-sonnet-20241022` - 最新 Sonnet 版本
- `claude-3-opus-20240229` - 最强性能

## AI 分析功能

AI 服务会对爬取的网站内容进行以下分析：

### 分析维度

1. **网站整体分析** (`analysisResult`)
   - 网站主要功能
   - 目标用户群体
   - 核心价值主张
   - 业务类型识别
   - 安全风险等级评估

2. **业务价值分析** (`businessValueResult`)
   - `valuePropositionScore`: 0-100 的价值评分
   - `analysis`: 详细的业务价值分析
   - `keywords`: 提取的核心关键词（5-10个）

3. **关联分析** (`associationResult`)
   - 识别网站中提到的其他域名或服务

### 分析结果示例

```json
{
  "analysisResult": "这是一个电商平台...\n\n业务类型: 电商平台\n安全风险等级: Medium\n安全分析: 网站包含用户登录、支付功能...",
  "businessValueResult": {
    "valuePropositionScore": 85,
    "analysis": "该网站提供完整的在线购物体验，具有较高的商业价值...",
    "keywords": "电商, 在线购物, 支付, 用户评价, B2C"
  },
  "associationResult": "发现关联域名: payment.example.com, api.example.com"
}
```

## 错误处理

如果 AI 服务未配置或调用失败，系统会：
- 自动返回默认分析结果
- 记录错误日志
- 不会影响整个扫描流程的执行

## 性能优化建议

1. **模型选择**
   - 生产环境建议使用 `gpt-4-turbo` 或 `deepseek-chat`
   - 开发测试可使用 `gpt-3.5-turbo` 节省成本

2. **Token 控制**
   - 默认截取前 8000 字符的内容进行分析
   - 可通过 `AI_MAX_TOKENS` 调整响应长度

3. **超时设置**
   - 默认 60 秒超时
   - 如需调整可在 `src/ai/ai.service.ts` 中修改

## 安全注意事项

1. **API 密钥保护**
   - 切勿将 API 密钥提交到版本控制
   - 生产环境使用环境变量或密钥管理服务
   - `.env` 文件已在 `.gitignore` 中

2. **成本控制**
   - 监控 API 使用量
   - 设置合理的 `AI_MAX_TOKENS` 限制
   - 考虑实现请求缓存机制

## 故障排查

### 问题：AI 分析总是返回默认值

检查：
1. `.env` 文件中 `AI_API_KEY` 是否正确配置
2. 查看日志中是否有 API 调用错误信息
3. 验证网络是否能访问 AI 服务端点

### 问题：Docker 容器中 AI 不工作

检查：
1. 环境变量是否正确传递：`docker-compose config`
2. 容器日志：`docker-compose logs api`
3. 确认 `.env` 文件在 `docker-compose.yml` 同级目录

### 问题：API 调用超时

解决方案：
1. 检查网络连接
2. 如在国内，考虑配置代理
3. 增加超时时间（修改 `ai.service.ts`）

## 扩展开发

如需添加新的 AI 提供商，参考 `src/ai/ai.service.ts` 中的实现：

1. 在 `AIConfig` 接口中添加新的 provider 类型
2. 实现 `analyzeWithXXX` 方法
3. 在 `analyzeWebsite` 的 switch 中添加分支

## 技术架构

```
┌─────────────────┐
│  ScanService    │
└────────┬────────┘
         │ 调用
         ▼
┌─────────────────┐
│   AIService     │
└────────┬────────┘
         │ 选择提供商
    ┌────┴────┬─────────┐
    ▼         ▼         ▼
┌────────┐ ┌────────┐ ┌────────┐
│ OpenAI │ │DeepSeek│ │ Claude │
└────────┘ └────────┘ └────────┘
```

## 相关文件

- `src/ai/ai.service.ts` - AI 服务实现
- `src/ai/ai.module.ts` - AI 模块定义
- `src/ai/interfaces/ai-analysis.interface.ts` - 类型定义
- `src/scan/scan.service.ts` - 集成调用（第191行）
- `.env.example` - 配置示例
- `docker-compose.yml` - Docker 环境变量配置

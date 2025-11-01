# Puppeteer Docker 容器优化说明

## 问题描述

在 Docker 容器中运行 Puppeteer 时遇到超时问题：
- 访问网站时出现 `Navigation timeout of 30000 ms exceeded`
- 即使使用 `wget` 可以正常访问，Puppeteer 仍然超时

## 根本原因

1. **waitUntil 策略不当**: 使用 `networkidle0` 或 `networkidle2` 在容器环境中容易超时
   - 许多现代网站持续进行网络请求（analytics、websockets 等）
   - 容器中的网络环境可能导致这些策略无法满足

2. **Chrome 启动参数不足**: 容器环境需要更多的 Chrome 启动参数来稳定运行
   - 缺少 `--single-process` 等容器必需的参数
   - 没有禁用不必要的后台服务

## 解决方案

### 1. 修改页面加载策略

所有 `page.goto()` 调用从 `networkidle0/networkidle2` 改为 `domcontentloaded`:

```typescript
// 修改前
await page.goto(url, { waitUntil: 'networkidle0' });

// 修改后
await page.goto(url, {
  waitUntil: 'domcontentloaded',
  timeout: 60000
});

// 可选：等待额外时间加载资源
await page.waitForTimeout(2000);
```

**waitUntil 选项说明**:
- `load`: 等待 `load` 事件触发
- `domcontentloaded`: 等待 DOM 加载完成（推荐用于容器）
- `networkidle0`: 等待 500ms 内没有网络请求（不推荐）
- `networkidle2`: 等待 500ms 内不超过 2 个网络请求（不推荐）

### 2. 优化 Chrome 启动参数

添加更多针对 Docker 容器优化的启动参数:

```typescript
const args = [
  // 必需的安全参数
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',

  // 容器优化参数
  '--disable-gpu',
  '--disable-software-rasterizer',
  '--no-zygote',
  '--single-process',  // 单进程模式，避免容器中的进程管理问题

  // 禁用后台服务
  '--disable-background-networking',
  '--disable-background-timer-throttling',
  '--disable-backgrounding-occluded-windows',
  '--disable-breakpad',
  '--disable-component-extensions-with-background-pages',
  '--disable-renderer-backgrounding',

  // 其他优化
  '--disable-extensions',
  '--no-first-run',
  '--enable-features=NetworkService,NetworkServiceInProcess',
  '--force-color-profile=srgb',
  '--hide-scrollbars',
  '--metrics-recording-only',
  '--mute-audio',
];
```

### 3. 增加超时时间

将默认超时从 30 秒增加到 60 秒:

```typescript
await page.setDefaultNavigationTimeout(60000);
await page.setDefaultTimeout(60000);
```

## 修改的文件

### 1. `src/crawl/crawl.service.ts`
- ✅ 添加容器优化的 Chrome 启动参数
- ✅ `page.goto()` 改为使用 `domcontentloaded`
- ✅ 超时时间从 30s 增加到 60s

### 2. `src/tech-crawl/tech-crawl.service.ts`
- ✅ 添加容器优化的 Chrome 启动参数
- ✅ `page.goto()` 改为使用 `domcontentloaded`
- ✅ 添加 2 秒等待时间以加载更多资源

### 3. `src/opengraph/opengraph.service.ts`
- ✅ 添加容器优化的 Chrome 启动参数
- ✅ `page.goto()` 改为使用 `domcontentloaded`
- ✅ 添加 1 秒等待时间以加载 meta 标签
- ✅ 超时时间从 30s 增加到 60s

## 验证方法

### 1. 本地测试

```bash
# 重新构建镜像
docker-compose build api

# 启动服务
docker-compose up -d

# 查看日志
docker-compose logs -f api

# 测试访问
curl -X POST http://localhost:3000/scan \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.baidu.com"}'
```

### 2. 进入容器调试

```bash
# 进入容器
docker-compose exec api sh

# 测试网络连接
wget https://www.baidu.com -O -

# 查看 Chrome 进程
ps aux | grep chrome
```

## 性能影响

### 优势
- ✅ 大幅降低超时风险
- ✅ 更快的页面加载速度（不等待所有网络请求完成）
- ✅ 更稳定的容器运行

### 权衡
- ⚠️ 可能在页面完全加载前就开始分析
- ⚠️ 某些动态加载的内容可能未加载完成

### 缓解措施
- 使用 `page.waitForTimeout()` 等待额外时间
- 对于需要完全加载的场景，可以添加特定的 `waitForSelector()` 等待关键元素

## 最佳实践

### 1. 根据场景选择等待策略

```typescript
// 静态页面或 meta 标签
await page.goto(url, { waitUntil: 'domcontentloaded' });

// 需要等待特定元素
await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.main-content', { timeout: 10000 });

// 需要等待 AJAX 请求
await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000); // 等待 AJAX 完成
```

### 2. 合理设置超时时间

```typescript
// 快速响应的网站
{ timeout: 30000 }

// 较慢的网站或复杂页面
{ timeout: 60000 }

// 特别慢的网站（不推荐太高）
{ timeout: 90000 }
```

### 3. 错误处理

```typescript
try {
  await page.goto(url, {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  });
} catch (error) {
  if (error.name === 'TimeoutError') {
    // 降级策略：尝试使用更宽松的条件
    await page.goto(url, {
      waitUntil: 'load',
      timeout: 90000
    });
  } else {
    throw error;
  }
}
```

## 故障排查

### 问题：仍然超时

1. **检查网络连接**
```bash
docker-compose exec api wget https://target-site.com -O -
```

2. **检查 Chrome 是否正常启动**
```bash
docker-compose exec api pnpm exec puppeteer browsers list
```

3. **增加调试日志**
```typescript
const browser = await puppeteer.launch({
  args: args,
  dumpio: true,  // 输出浏览器进程的 stdout 和 stderr
});
```

### 问题：内容加载不完整

1. **增加等待时间**
```typescript
await page.waitForTimeout(5000);
```

2. **等待特定元素**
```typescript
await page.waitForSelector('.content-loaded', { timeout: 10000 });
```

3. **等待网络空闲（谨慎使用）**
```typescript
await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.waitForNetworkIdle({ timeout: 10000 });
```

### 问题：内存或 CPU 使用过高

1. **限制并发浏览器实例**
```typescript
// 使用队列或信号量限制并发数
const maxConcurrent = 3;
```

2. **及时关闭浏览器**
```typescript
try {
  // ... 使用浏览器
} finally {
  await browser.close();
}
```

3. **使用共享浏览器实例**（高级）
```typescript
// 复用浏览器实例，只创建新页面
const page = await browser.newPage();
// ... 使用页面
await page.close(); // 关闭页面而不是浏览器
```

## 相关资源

- [Puppeteer Docker 官方文档](https://pptr.dev/guides/docker)
- [Chrome 启动参数列表](https://peter.sh/experiments/chromium-command-line-switches/)
- [Puppeteer 等待策略](https://pptr.dev/api/puppeteer.puppeteerlifecycleevent)

## 更新日志

- **2025-11-01**: 初始版本，修复容器中 Puppeteer 超时问题
  - 更新所有服务的 Chrome 启动参数
  - 将 waitUntil 策略改为 domcontentloaded
  - 增加超时时间到 60 秒

# Docker 部署指南

本文档说明如何使用 Docker 部署 NetSight API 应用。

## 快速开始

### 1. 准备配置文件

复制环境变量示例文件：

```bash
cp .env.example .env
```

编辑 `.env` 文件，配置必要的参数：

```env
# 数据库配置（docker-compose会自动配置，无需修改）
DATABASE_URL="postgresql://netsight_user:netsight_password@postgres:5432/netsight?schema=public"

# AI 服务配置（必须配置）
AI_PROVIDER=openai
AI_API_KEY=your_api_key_here
AI_MODEL_NAME=gpt-4
```

### 2. 启动服务

```bash
# 构建并启动所有服务
docker-compose up -d

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f
```

### 3. 验证部署

访问 API：
```bash
curl http://localhost:3000
```

## 服务说明

### PostgreSQL 数据库

- **镜像**: postgres:16-alpine
- **端口**: 5432
- **容器名**: netsight-postgres
- **数据持久化**: postgres_data volume

默认配置：
- 用户名: `netsight_user`
- 密码: `netsight_password`
- 数据库: `netsight`

### NestJS API

- **端口**: 3000
- **容器名**: netsight-api
- **依赖**: postgres (健康检查通过后启动)

特性：
- 包含 Puppeteer 及 Chrome 浏览器
- 自动运行数据库迁移
- 支持热重启

## 配置选项

### 环境变量覆盖

可以通过多种方式传递环境变量：

#### 方式 1: .env 文件（推荐）

```env
AI_PROVIDER=deepseek
AI_API_KEY=your-key
AI_MODEL_NAME=deepseek-chat
```

#### 方式 2: 命令行

```bash
AI_PROVIDER=claude AI_API_KEY=sk-ant-xxx docker-compose up -d
```

#### 方式 3: 修改 docker-compose.yml

直接编辑 `docker-compose.yml` 中的 environment 部分。

### 修改数据库密码

编辑 `docker-compose.yml`:

```yaml
postgres:
  environment:
    POSTGRES_USER: your_user
    POSTGRES_PASSWORD: your_password
    POSTGRES_DB: your_database

api:
  environment:
    DATABASE_URL: postgresql://your_user:your_password@postgres:5432/your_database?schema=public
```

### 修改应用端口

编辑 `docker-compose.yml` 中的端口映射：

```yaml
api:
  ports:
    - "8080:3000"  # 外部端口:容器内部端口
```

## 常用命令

### 服务管理

```bash
# 启动服务
docker-compose up -d

# 停止服务
docker-compose down

# 重启服务
docker-compose restart

# 重新构建并启动
docker-compose up -d --build

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f

# 查看特定服务的日志
docker-compose logs -f api
docker-compose logs -f postgres
```

### 数据管理

```bash
# 进入数据库容器
docker-compose exec postgres psql -U netsight_user -d netsight

# 备份数据库
docker-compose exec postgres pg_dump -U netsight_user netsight > backup.sql

# 恢复数据库
docker-compose exec -T postgres psql -U netsight_user netsight < backup.sql

# 清除所有数据（包括数据卷）
docker-compose down -v
```

### 应用管理

```bash
# 进入应用容器
docker-compose exec api sh

# 运行 Prisma 迁移
docker-compose exec api npx prisma migrate deploy

# 查看 Prisma 数据库状态
docker-compose exec api npx prisma migrate status

# 重新生成 Prisma Client
docker-compose exec api npx prisma generate
```

## 生产环境部署建议

### 1. 安全加固

```yaml
# docker-compose.prod.yml
services:
  postgres:
    environment:
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    networks:
      - internal
    # 不暴露端口到主机
    # ports:
    #   - "5432:5432"

  api:
    environment:
      NODE_ENV: production
      AI_API_KEY: ${AI_API_KEY}
    networks:
      - internal
      - external

networks:
  internal:
    internal: true
  external:
```

### 2. 使用反向代理

推荐使用 Nginx 或 Traefik：

```yaml
# docker-compose.yml
services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - api

  api:
    # 不直接暴露端口
    expose:
      - "3000"
```

### 3. 资源限制

```yaml
services:
  api:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '1'
          memory: 1G
```

### 4. 健康检查

```yaml
services:
  api:
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

### 5. 日志管理

```yaml
services:
  api:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

## 性能优化

### 1. 使用多阶段构建（已实现）

Dockerfile 已使用优化的构建流程。

### 2. 增加 Node.js 内存限制

```yaml
api:
  environment:
    NODE_OPTIONS: "--max-old-space-size=4096"
```

### 3. Puppeteer 优化

在应用代码中配置 Puppeteer 使用更少的资源：

```typescript
// 在需要时配置
const browser = await puppeteer.launch({
  headless: 'new',
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
  ],
});
```

## 故障排查

### 问题 1: 数据库连接失败

```bash
# 检查数据库是否启动
docker-compose ps postgres

# 查看数据库日志
docker-compose logs postgres

# 测试数据库连接
docker-compose exec postgres pg_isready -U netsight_user
```

### 问题 2: Puppeteer 无法启动

```bash
# 查看应用日志
docker-compose logs api | grep -i chrome

# 进入容器检查
docker-compose exec api sh
npx puppeteer browsers list
```

### 问题 3: 构建失败

```bash
# 清理缓存重新构建
docker-compose build --no-cache api

# 检查 Docker 空间
docker system df
docker system prune
```

### 问题 4: 应用启动慢

这是正常的，因为：
1. 等待 PostgreSQL 健康检查通过
2. 运行数据库迁移
3. Puppeteer 初始化

通常需要 30-60 秒。查看日志确认进度：

```bash
docker-compose logs -f api
```

## 监控和维护

### 监控容器状态

```bash
# 查看资源使用
docker stats

# 查看容器详细信息
docker-compose exec api ps aux
```

### 定期维护

```bash
# 清理未使用的镜像和容器
docker system prune -a

# 备份数据
docker-compose exec postgres pg_dump -U netsight_user netsight > backup_$(date +%Y%m%d).sql

# 更新镜像
docker-compose pull
docker-compose up -d
```

## 扩展部署

### 使用 Docker Swarm

```bash
# 初始化 Swarm
docker swarm init

# 部署堆栈
docker stack deploy -c docker-compose.yml netsight

# 扩展服务
docker service scale netsight_api=3
```

### 使用 Kubernetes

需要转换 docker-compose.yml 为 Kubernetes 配置：

```bash
# 使用 kompose 转换
kompose convert

# 部署到 Kubernetes
kubectl apply -f .
```

## 相关文档

- [AI 集成说明](./AI_INTEGRATION.md)
- [Dockerfile](./Dockerfile)
- [docker-compose.yml](./docker-compose.yml)

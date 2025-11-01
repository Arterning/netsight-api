# 使用官方Node.js镜像作为基础镜像
FROM node:20-slim


# 替换 Debian 源为阿里云镜像
# RUN sed -i 's|deb.debian.org|mirrors.aliyun.com|g' /etc/apt/sources.list.d/debian.sources && \
#     sed -i 's|security.debian.org|mirrors.aliyun.com/debian-security|g' /etc/apt/sources.list.d/debian.sources

# 安装Puppeteer所需的依赖
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    procps \
    libxss1 \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libatspi2.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libwayland-client0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

# 启用 corepack 并安装 pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# 设置工作目录
WORKDIR /app

# 复制 package.json 和 pnpm-lock.yaml
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma/

# 安装依赖
RUN pnpm install --frozen-lockfile

# 安装Puppeteer的Chrome浏览器
RUN pnpm exec puppeteer browsers install chrome

# 复制应用代码
COPY . .

# 生成Prisma客户端
RUN pnpm exec prisma generate

# 构建应用
RUN pnpm run build

# 暴露端口（根据你的应用端口，默认NestJS是3000）
EXPOSE 3000

# 启动应用
CMD ["pnpm", "run", "start:prod"]

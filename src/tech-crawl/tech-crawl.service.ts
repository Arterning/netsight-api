import { Injectable } from '@nestjs/common';
import puppeteer, { Browser, Page, HTTPRequest, HTTPResponse } from 'puppeteer';

// 类型定义
interface TechItem {
  category: string;
  name: string;
  version: string;
  purpose: string;
  vendor: string;
}

export interface TechInfo {
  url: string;
  timestamp: string;
  software: TechItem[];
  webServices: TechItem[];
  frameworks: TechItem[];
  libraries: TechItem[];
  cms: TechItem[];
  analytics: TechItem[];
  security: TechItem[];
  hosting: TechItem[];
}

interface TechOptions {
  headless?: boolean;
  timeout?: number;
  userAgent?: string;
  proxy?: string;
}

interface NetworkRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  resourceType: string;
}

interface NetworkResponse {
  url: string;
  status: number;
  headers: Record<string, string>;
  fromCache: boolean;
}

@Injectable()
export class TechCrawlService {
  private networkRequests: NetworkRequest[] = [];
  private networkResponses: NetworkResponse[] = [];

  async getTechInfo(url: string, options: TechOptions = {}): Promise<TechInfo> {
    const config: Required<TechOptions> = {
      headless: true,
      timeout: 30000,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      proxy: '',
      ...options
    };

    let browser: Browser | null = null;

    try {
      const { browser: br, page } = await this.initBrowser(config);
      browser = br;

      await page.goto(url, {
        waitUntil: 'networkidle0',
        timeout: config.timeout
      });

      const techInfo: TechInfo = {
        url: url,
        timestamp: new Date().toISOString(),
        software: await this.detectSoftware(page),
        webServices: await this.detectWebServices(),
        frameworks: await this.detectFrameworks(page),
        libraries: await this.detectLibraries(page),
        cms: await this.detectCMS(page),
        analytics: await this.detectAnalytics(),
        security: await this.detectSecurity(),
        hosting: await this.detectHosting(),
      };

      return techInfo;
    } catch (error) {
      console.error('爬取技术信息时发生错误:', error);
      throw error;
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  private async initBrowser(config: Required<TechOptions>): Promise<{ browser: Browser; page: Page }> {
    const args = [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-web-security',
      '--disable-features=VizDisplayCompositor',
    ];

    if (config.proxy && config.proxy.trim() !== '') {
      args.push(`--proxy-server=${config.proxy}`);
    }

    const browser = await puppeteer.launch({
      headless: config.headless,
      args: args,
    });

    const page = await browser.newPage();
    await page.setUserAgent(config.userAgent);
    await page.setViewport({ width: 1920, height: 1080 });

    this.networkRequests = [];
    this.networkResponses = [];

    await page.setRequestInterception(true);
    page.on('request', (request: HTTPRequest) => {
      this.networkRequests.push({
        url: request.url(),
        method: request.method(),
        headers: request.headers(),
        resourceType: request.resourceType()
      });
      request.continue();
    });

    page.on('response', (response: HTTPResponse) => {
      this.networkResponses.push({
        url: response.url(),
        status: response.status(),
        headers: response.headers(),
        fromCache: response.fromCache()
      });
    });

    return { browser, page };
  }

  private async detectSoftware(page: Page): Promise<TechItem[]> {
    return await page.evaluate(() => {
      const software: any[] = [];

      const generatorMeta = document.querySelector('meta[name="generator"]') as HTMLMetaElement;
      if (generatorMeta) {
        const content = generatorMeta.content;
        const versionMatch = content.match(/\d+\.\d+[\.\d]*/);
        software.push({
          category: '内容管理系统',
          name: content.split(' ')[0],
          version: versionMatch ? versionMatch[0] : 'unknown',
          purpose: '网站内容管理',
          vendor: 'unknown'
        });
      }

      if ((window as any).jQuery) {
        software.push({
          category: 'JavaScript库',
          name: 'jQuery',
          version: (window as any).jQuery.fn.jquery || 'unknown',
          purpose: 'DOM操作和AJAX',
          vendor: 'jQuery Foundation'
        });
      }

      if ((window as any).React ||
        document.querySelector('[data-reactroot]') ||
        document.querySelector('script[src*="react"]')) {
        let version = 'unknown';
        if ((window as any).React && (window as any).React.version) {
          version = (window as any).React.version;
        }
        software.push({
          category: 'JavaScript框架',
          name: 'React',
          version: version,
          purpose: '用户界面构建',
          vendor: 'Meta (Facebook)'
        });
      }

      if ((window as any).Vue ||
        document.querySelector('[data-v-]') ||
        document.querySelector('[v-cloak]')) {
        let version = 'unknown';
        if ((window as any).Vue && (window as any).Vue.version) {
          version = (window as any).Vue.version;
        }
        software.push({
          category: 'JavaScript框架',
          name: 'Vue.js',
          version: version,
          purpose: '渐进式Web应用框架',
          vendor: 'Vue.js Team'
        });
      }

      return software;
    });
  }

  private async detectWebServices(): Promise<TechItem[]> {
    const services: TechItem[] = [];

    this.networkResponses.forEach(response => {
      const headers = response.headers;

      if (headers.server) {
        const serverInfo = this.parseServerHeader(headers.server);
        if (serverInfo) {
          services.push({
            category: 'Web服务器',
            name: serverInfo.name,
            version: serverInfo.version,
            purpose: 'HTTP服务',
            vendor: this.getVendorByServer(serverInfo.name)
          });
        }
      }

      if (headers['cf-ray'] || headers['cf-cache-status']) {
        services.push({
          category: 'CDN服务',
          name: 'Cloudflare',
          version: 'unknown',
          purpose: '内容分发网络',
          vendor: 'Cloudflare Inc.'
        });
      }
    });

    return this.deduplicateServices(services);
  }

  private async detectFrameworks(page: Page): Promise<TechItem[]> {
    return await page.evaluate(() => {
      const frameworks: any[] = [];

      if (document.querySelector('link[href*="bootstrap"]') ||
        document.querySelector('.container')) {
        frameworks.push({
          category: 'CSS框架',
          name: 'Bootstrap',
          version: 'unknown',
          purpose: '响应式UI框架',
          vendor: 'Bootstrap Team'
        });
      }

      if (document.querySelector('[class*="tw-"]') ||
        document.querySelector('[class*="bg-"]')) {
        frameworks.push({
          category: 'CSS框架',
          name: 'Tailwind CSS',
          version: 'unknown',
          purpose: 'utility-first CSS框架',
          vendor: 'Tailwind Labs'
        });
      }

      return frameworks;
    });
  }

  private async detectLibraries(page: Page): Promise<TechItem[]> {
    const libraries: TechItem[] = [];

    const pageLibraries = await page.evaluate(() => {
      const libs: any[] = [];

      if ((window as any).gtag || (window as any).ga) {
        libs.push({
          category: '分析工具',
          name: 'Google Analytics',
          version: 'unknown',
          purpose: '网站分析',
          vendor: 'Google'
        });
      }

      return libs;
    });

    libraries.push(...pageLibraries);
    return this.deduplicateServices(libraries);
  }

  private async detectCMS(page: Page): Promise<TechItem[]> {
    return await page.evaluate(() => {
      const cms: any[] = [];

      if (document.querySelector('link[href*="wp-content"]') ||
        document.querySelector('meta[name="generator"][content*="WordPress"]')) {
        cms.push({
          category: '内容管理系统',
          name: 'WordPress',
          version: 'unknown',
          purpose: '内容管理',
          vendor: 'Automattic'
        });
      }

      return cms;
    });
  }

  private async detectAnalytics(): Promise<TechItem[]> {
    const analytics: TechItem[] = [];

    this.networkRequests.forEach(request => {
      if (request.url.includes('google-analytics.com')) {
        analytics.push({
          category: '网站分析',
          name: 'Google Analytics',
          version: 'unknown',
          purpose: '用户行为分析',
          vendor: 'Google'
        });
      }
    });

    return this.deduplicateServices(analytics);
  }

  private async detectSecurity(): Promise<TechItem[]> {
    const security: TechItem[] = [];

    this.networkResponses.forEach(response => {
      const headers = response.headers;

      if (headers['strict-transport-security']) {
        security.push({
          category: '安全协议',
          name: 'HSTS',
          version: 'unknown',
          purpose: 'HTTPS强制',
          vendor: 'W3C Standard'
        });
      }

      if (headers['content-security-policy']) {
        security.push({
          category: '安全策略',
          name: 'CSP',
          version: 'unknown',
          purpose: 'XSS防护',
          vendor: 'W3C Standard'
        });
      }
    });

    return this.deduplicateServices(security);
  }

  private async detectHosting(): Promise<TechItem[]> {
    const hosting: TechItem[] = [];

    this.networkResponses.forEach(response => {
      const headers = response.headers;

      if (headers['x-vercel-id']) {
        hosting.push({
          category: '托管服务',
          name: 'Vercel',
          version: 'unknown',
          purpose: '前端部署平台',
          vendor: 'Vercel Inc.'
        });
      }
    });

    return this.deduplicateServices(hosting);
  }

  private parseServerHeader(serverHeader: string) {
    const patterns = [
      { regex: /nginx\/([0-9.]+)/i, name: 'Nginx' },
      { regex: /Apache\/([0-9.]+)/i, name: 'Apache' },
      { regex: /Microsoft-IIS\/([0-9.]+)/i, name: 'IIS' },
    ];

    for (const pattern of patterns) {
      const match = serverHeader.match(pattern.regex);
      if (match) {
        return {
          name: pattern.name,
          version: match[1]
        };
      }
    }

    return null;
  }

  private getVendorByServer(serverName: string): string {
    const vendors: Record<string, string> = {
      'Nginx': 'Nginx Inc.',
      'Apache': 'Apache Software Foundation',
      'IIS': 'Microsoft Corporation',
    };
    return vendors[serverName] || 'unknown';
  }

  private deduplicateServices(services: TechItem[]): TechItem[] {
    const seen = new Set();
    return services.filter(service => {
      const key = `${service.name}-${service.category}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  generateReport(techInfo: TechInfo): string {
    let report = `\n=== 网站技术分析报告 ===\n`;
    report += `网站: ${techInfo.url}\n`;
    report += `分析时间: ${techInfo.timestamp}\n\n`;

    const categories: { key: keyof TechInfo; name: string }[] = [
      { key: 'software', name: '软件系统' },
      { key: 'webServices', name: '网络服务' },
      { key: 'frameworks', name: '前端框架' },
      { key: 'libraries', name: '第三方库' },
      { key: 'cms', name: '内容管理系统' },
      { key: 'analytics', name: '分析工具' },
      { key: 'security', name: '安全特性' },
      { key: 'hosting', name: '托管服务' }
    ];

    categories.forEach(category => {
      const items = techInfo[category.key];
      if (Array.isArray(items) && items.length > 0) {
        report += `${category.name}:\n`;
        items.forEach(item => {
          report += `  - ${item.name} ${item.version !== 'unknown' ? `(v${item.version})` : ''}\n`;
          report += `    类别: ${item.category}\n`;
          report += `    用途: ${item.purpose}\n`;
          report += `    供应商: ${item.vendor}\n\n`;
        });
      }
    });

    return report;
  }
}

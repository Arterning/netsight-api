import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CrawlService } from '../crawl/crawl.service';
import { TechCrawlService } from '../tech-crawl/tech-crawl.service';
import { ScanDto, CrawlDepth } from './dto/scan.dto';
import { URL } from 'url';
import * as dns from 'dns/promises';
import * as net from 'net';

interface SensitivePage {
  url: string;
  type: string;
  description: string;
  riskLevel: 'Low' | 'Medium' | 'High' | 'Critical';
}

@Injectable()
export class ScanService {
  constructor(
    private prisma: PrismaService,
    private crawlService: CrawlService,
    private techCrawlService: TechCrawlService,
  ) {}

  async scanAndAnalyze(scanDto: ScanDto): Promise<{ taskExecutionId: string | undefined; error: string | null }> {
    let id: string | undefined = undefined;

    try {
      const { taskExecutionId, scheduledTaskId, taskName } = await this.createTaskExecution(scanDto);
      id = taskExecutionId;

      let analysisTargets: { type: 'ip' | 'url', value: string }[] = [];

      if (scanDto.url) {
        analysisTargets.push({ type: 'url', value: scanDto.url });
      } else if (scanDto.ipRange) {
        const activeIPs = this.getActiveIPsFromRange(scanDto.ipRange);
        analysisTargets = activeIPs.map(ip => ({ type: 'ip', value: ip }));
      }

      // 启动异步扫描分析
      this.performScan(taskExecutionId, scheduledTaskId, taskName, analysisTargets, scanDto).catch(err => {
        console.error('Scan failed:', err);
      });

      return { taskExecutionId: id, error: null };
    } catch (error) {
      console.error('Error during scan and analysis:', error);
      if (id) {
        await this.prisma.taskExecution.update({
          where: { id },
          data: { status: 'failed', stage: '任务失败' }
        });
      }
      return { taskExecutionId: id, error: 'Failed to complete analysis. Please try again.' };
    }
  }

  private async performScan(
    taskExecutionId: string,
    scheduledTaskId: string | null,
    taskName: string,
    analysisTargets: { type: 'ip' | 'url', value: string }[],
    scanDto: ScanDto
  ) {
    try {
      const analysisPromises = analysisTargets.map(async (target) => {
        let ip: string;
        let displayUrl: string;

        if (target.type === 'url') {
          displayUrl = target.value;
          const domain = new URL(displayUrl).hostname;
          const resolvedIp = await this.getIpFromDomain(domain);
          if (!resolvedIp) {
            throw new Error(`Could not resolve IP for initial target domain: ${domain}`);
          }
          ip = resolvedIp;
        } else {
          ip = target.value;
          displayUrl = `http://${ip}`;
        }

        let assetId: string | null = null;

        // 先 upsert asset,获得 assetId
        const assetData = {
          ip: ip,
          url: displayUrl,
          domain: target.type === 'url' ? new URL(target.value).hostname : '',
          status: 'Active',
          openPorts: '',
          valuePropositionScore: 0,
          summary: '',
          geolocation: '',
          services: '',
          networkTopology: '',
          taskName: taskName,
          taskExecutionId: taskExecutionId,
        };
        const upsertedAsset = await this.prisma.asset.upsert({
          where: { url: displayUrl },
          update: assetData,
          create: assetData,
        });
        assetId = upsertedAsset.id;

        // 1. 爬取前,更新 stage
        if (taskExecutionId) {
          await this.prisma.taskExecution.update({
            where: { id: taskExecutionId },
            data: { stage: `正在扫描${displayUrl}` },
          });
        }

        // 爬取全站并生成 sitemap
        let crawlDepth: number;
        if (scanDto.crawlDepth === CrawlDepth.FULL) {
          crawlDepth = 99;
        } else if (scanDto.crawlDepth === CrawlDepth.LEVEL1) {
          crawlDepth = 0;
        } else if (scanDto.crawlDepth === CrawlDepth.LEVEL2) {
          crawlDepth = 1;
        } else if (scanDto.crawlDepth === CrawlDepth.LEVEL3) {
          crawlDepth = parseInt((scanDto.customCrawlDepth ?? 2).toString(), 10);
        } else {
          crawlDepth = 0;
        }

        const crawlResult = await this.crawlWebsite(displayUrl, assetId, crawlDepth, taskExecutionId, scanDto.proxy);
        const { urls: crawledUrls, sitemapXml, homepageTitle, homepageContent, homepageBase64Image, homepageMetaData, techReport, allPageContent, sensitivePages, faviconUrl } = crawlResult;

        console.log(`homepageTitle: ${homepageTitle}, homepageContent length: ${homepageContent.length}`);

        // 2. 爬取后AI分析前,更新 stage
        if (taskExecutionId) {
          await this.prisma.taskExecution.update({
            where: { id: taskExecutionId },
            data: { stage: '正在AI分析网站内容' },
          });
        }

        // 分析内容 - TODO: 这里需要接入你的AI服务
        const content = homepageTitle + allPageContent
          ? allPageContent.replace(/<style[^>]*>.*?<\/style>/g, ' ')
            .replace(/<script[^>]*>.*?<\/script>/g, ' ')
            .replace(/<[^>]*>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
          : '';

        // Placeholder for AI analysis - you need to implement these
        const analysisResult = `网站分析: ${homepageTitle}`;
        const businessValueResult = {
          valuePropositionScore: 50,
          analysis: '业务价值分析',
          keywords: '关键词1, 关键词2'
        };
        const associationResult = 'IP关联分析结果';

        // 3. 分析结束后,更新 stage
        if (taskExecutionId) {
          await this.prisma.taskExecution.update({
            where: { id: taskExecutionId },
            data: { stage: '分析结束' },
          });
        }

        const geolocation = await this.getGeolocationFromUrl(displayUrl);
        const portList = [21, 22, 80, 443, 3306, 8080, 5432, 6379];
        const hostname = new URL(displayUrl).hostname;
        const openPorts = await this.scanOpenPorts(hostname, portList);
        const openPortsStr = openPorts.join(', ');

        let description = "";
        if (homepageMetaData.description) {
          description = homepageMetaData.description;
        } else if (homepageContent) {
          description = homepageContent.substring(0, 255);
        } else {
          description = homepageTitle;
        }

        // 更新 asset 的分析信息
        await this.prisma.asset.update({
          where: { id: assetId },
          data: {
            name: homepageTitle,
            description,
            techReport,
            sensitivePages,
            valuePropositionScore: businessValueResult.valuePropositionScore,
            summary: analysisResult,
            geolocation,
            openPorts: openPortsStr,
            services: businessValueResult.analysis,
            tags: businessValueResult.keywords,
            keywords: businessValueResult.keywords,
            networkTopology: associationResult,
            imageBase64: homepageBase64Image || null,
            metadata: homepageMetaData || null,
            favicon: faviconUrl,
          },
        });

        return {
          ip,
          analysis: analysisResult,
          businessValue: businessValueResult,
          association: associationResult,
          id: assetId,
          sitemapXml,
          crawledUrls,
        };
      });

      const results = await Promise.all(analysisPromises);

      // 更新任务执行记录
      if (taskExecutionId) {
        const endTime = new Date();
        const startTime = await this.prisma.taskExecution.findUnique({
          where: { id: taskExecutionId },
          select: { startTime: true }
        });

        const duration = startTime?.startTime
          ? Math.floor((endTime.getTime() - startTime.startTime.getTime()) / 1000)
          : null;

        await this.prisma.taskExecution.update({
          where: { id: taskExecutionId },
          data: {
            status: 'completed',
            endTime,
            duration,
            assetsFound: results.length,
          }
        });

        console.log(`Task execution ${taskExecutionId} completed with ${results.length} assets found.`);

        // 更新定时任务的下次执行时间
        if (scheduledTaskId && scanDto.isScheduled && scanDto.scheduleType) {
          await this.updateNextRunTime(scheduledTaskId, scanDto.scheduleType);
        }
      }
    } catch (e) {
      console.error(`Error during scan and analysis:`, e);
      await this.prisma.taskExecution.update({
        where: { id: taskExecutionId },
        data: { status: 'failed', stage: '任务失败' }
      });
    }
  }

  private async crawlWebsite(
    startUrl: string,
    assetId: string,
    maxDepth: number = 3,
    taskExecutionId: string | undefined,
    proxy: string | undefined
  ) {
    const visited = new Set<string>();
    const queue: { url: string; depth: number }[] = [{ url: startUrl, depth: 0 }];
    const urls: string[] = [];
    let homepageContent = '';
    let homepageTitle = '';
    let homepageBase64Image = '';
    let homepageMetaData: Record<string, string> = {};
    let techReport = '';
    let allPageContent = '';
    let sensitivePages: SensitivePage[] = [];
    let faviconUrl: string | null = null;
    const allApiRequests: any[] = [];

    while (queue.length > 0) {
      const { url, depth } = queue.shift()!;
      if (visited.has(url) || depth > maxDepth) continue;
      visited.add(url);
      urls.push(url);

      try {
        await this.prisma.taskExecution.update({
          where: { id: taskExecutionId },
          data: { stage: `获取${url}的元数据` },
        });

        const metaData = await this.crawlService.crawlMetaData(url);
        const { image_base64, ...meta } = metaData;

        await this.prisma.taskExecution.update({
          where: { id: taskExecutionId },
          data: { stage: `扫描${url}的内容` },
        });

        const response = await this.crawlService.crawlPage(url, proxy);
        const content = response.text;
        const htmlContent = response.htmlContent;
        const title = response.title;
        allPageContent += content;
        sensitivePages = response.sensitivePages;

        if (response.apiRequests && response.apiRequests.length > 0) {
          allApiRequests.push(...response.apiRequests);
        }

        if (homepageContent === '' && depth === 0) {
          homepageContent = content;
          homepageTitle = title;
          homepageBase64Image = metaData.image_base64 || response.screenshotBase64 || '';
          homepageMetaData = meta || {};

          await this.prisma.taskExecution.update({
            where: { id: taskExecutionId },
            data: { stage: `获取${url}的favicon` },
          });
          faviconUrl = await this.fetchFavicon(url);

          const techInfo = await this.techCrawlService.getTechInfo(url, { headless: true, timeout: 30000, proxy });
          techReport = this.techCrawlService.generateReport(techInfo);

          await this.prisma.taskExecution.update({
            where: { id: taskExecutionId },
            data: { stage: `扫描${url}的技术信息` },
          });
        }

        // 处理新域名和关联
        await this.handleNewDomainAndAssociation(taskExecutionId, assetId, startUrl, url);

        const cleanHtmlContent = htmlContent.replace(/\x00/g, '');
        const { vulnerabilities } = response;

        await this.prisma.webpage.upsert({
          where: { assetId_url: { assetId, url } },
          update: {
            htmlContent: cleanHtmlContent,
            content: content,
            title,
            isHomepage: depth === 0,
            vulnerabilities,
            metadata: meta || null,
            imageBase64: image_base64 || null,
          },
          create: {
            assetId,
            url,
            htmlContent: cleanHtmlContent,
            content: content,
            title,
            isHomepage: depth === 0,
            vulnerabilities,
            metadata: meta || null,
            imageBase64: image_base64 || null,
          },
        });

        const links = response.links || [];
        queue.push(
          ...links.map(link => {
            return { url: link, depth: depth + 1 };
          }).filter(Boolean) as { url: string; depth: number }[]
        );

      } catch (e) {
        console.error(`Error crawling ${url}:`, e);
        continue;
      }
    }

    // 保存所有API请求到数据库
    for (const apiRequest of allApiRequests) {
      try {
        await this.prisma.apiEndpoint.create({
          data: {
            url: apiRequest.url,
            method: apiRequest.method,
            type: apiRequest.type,
            status: apiRequest.status,
            headers: apiRequest.headers,
            requestBody: apiRequest.requestBody,
            response: apiRequest.response,
            responseSize: apiRequest.responseSize,
            duration: apiRequest.duration,
            fromPage: apiRequest.fromPage,
            assetId: assetId,
          },
        });
      } catch (e) {
        console.error('Error saving API endpoint:', e);
      }
    }

    // 生成 sitemap.xml
    const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
      urls.map(u => `  <url><loc>${u}</loc></url>`).join('\n') +
      '\n</urlset>';
    await this.prisma.asset.update({ where: { id: assetId }, data: { sitemapXml } });

    return {
      urls,
      sitemapXml,
      homepageTitle,
      homepageContent,
      homepageBase64Image,
      homepageMetaData,
      techReport,
      allPageContent,
      sensitivePages,
      faviconUrl,
    };
  }

  private async createTaskExecution(scanDto: ScanDto) {
    let scheduledTaskId = null;
    if (scanDto.isScheduled && scanDto.scheduleType) {
      console.log('Creating scheduled task...');
    }

    const task = await this.createScheduledTask({
      taskName: scanDto.taskName || `Scan_${new Date().toISOString()}`,
      description: scanDto.description,
      domain: scanDto.url ? new URL(scanDto.url).hostname : '',
      ipRange: scanDto.ipRange,
      scanRate: scanDto.scanRate || 'normal',
      scheduleType: scanDto.scheduleType || 'once',
    });

    if (task.error) {
      return { data: null, error: task.error };
    }
    scheduledTaskId = task.data?.id || null;

    const taskName = scanDto.taskName || `Scan_${new Date().toISOString()}`;

    const execution = await this.prisma.taskExecution.create({
      data: {
        scheduledTaskId,
        status: 'running',
        startTime: new Date(),
        assetsFound: 0,
      }
    });

    return { taskExecutionId: execution.id, scheduledTaskId, taskName };
  }

  private async createScheduledTask(data: {
    taskName: string;
    description?: string;
    domain: string;
    ipRange?: string;
    scanRate: string;
    scheduleType: string;
  }) {
    try {
      const task = await this.prisma.scheduledTask.create({
        data: {
          name: data.taskName,
          description: data.description,
          domain: data.domain,
          ipRange: data.ipRange,
          scanRate: data.scanRate,
          scheduleType: data.scheduleType,
          isActive: true,
        }
      });
      return { data: task, error: null };
    } catch (error) {
      console.error('Error creating scheduled task:', error);
      return { data: null, error: 'Failed to create scheduled task' };
    }
  }

  private async updateNextRunTime(scheduledTaskId: string, scheduleType: string) {
    const now = new Date();
    let nextRunAt: Date;

    switch (scheduleType) {
      case 'daily':
        nextRunAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        break;
      case 'weekly':
        nextRunAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        break;
      case 'every3days':
        nextRunAt = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
        break;
      case 'monthly':
        nextRunAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        return;
    }

    await this.prisma.scheduledTask.update({
      where: { id: scheduledTaskId },
      data: { nextRunAt, lastRunAt: now }
    });
  }

  private getDomainFromUrl(url: string): string {
    try {
      return new URL(url).hostname;
    } catch {
      return '';
    }
  }

  private async handleNewDomainAndAssociation(
    taskExecutionId: string | undefined,
    sourceAssetId: string,
    sourceUrl: string,
    targetUrl: string
  ) {
    console.log(`Handling url association: ${sourceUrl} -> ${targetUrl}`);

    const sourceDomain = this.getDomainFromUrl(sourceUrl);
    const targetDomain = this.getDomainFromUrl(targetUrl);

    console.log(`Handling new domain association: ${sourceDomain} -> ${targetDomain}`);

    if (sourceDomain === targetDomain) {
      console.log(`Source and target domains are the same: ${sourceDomain}`);
      return;
    }

    let targetAsset = await this.prisma.asset.findUnique({ where: { url: targetUrl } });
    if (!targetAsset) {
      const resolvedIp = await this.getIpFromDomain(targetDomain);
      targetAsset = await this.prisma.asset.create({
        data: {
          url: targetUrl,
          taskExecutionId,
          taskName: '',
          domain: targetDomain,
          ip: resolvedIp || '',
          status: 'Active'
        }
      });
    }

    if (!targetAsset) {
      console.log(`Failed to find or create asset for domain: ${targetDomain}.`);
      return;
    }

    console.log(`Create assetAssociation Source domain: ${sourceDomain}, Target domain: ${targetDomain}`);

    await this.prisma.assetAssociation.create({
      data: {
        sourceAssetId,
        targetAssetId: targetAsset.id,
        sourceUrl,
        targetUrl,
      }
    });
    return targetAsset;
  }

  private async getIpFromDomain(domain: string): Promise<string | null> {
    try {
      const { address } = await dns.lookup(domain);
      return address;
    } catch (error) {
      console.error(`Could not resolve IP for domain: ${domain}`, error);
      return null;
    }
  }

  private async getGeolocationFromUrl(url: string): Promise<string> {
    try {
      const hostname = new URL(url).hostname;
      const ip = await this.getIpFromDomain(hostname);
      if (!ip) return '未知';
      const res = await fetch(`http://ip-api.com/json/${ip}?lang=zh-CN`);
      const data = await res.json();
      if (data.status === 'success') {
        return `${data.country || ''}${data.regionName ? ', ' + data.regionName : ''}${data.city ? ', ' + data.city : ''}`;
      }
      return '未知';
    } catch (e) {
      return '未知';
    }
  }

  private async scanOpenPorts(host: string, ports: number[], timeout = 1000): Promise<number[]> {
    const openPorts: number[] = [];
    const ip = await this.getIpFromDomain(host);
    if (!ip) return [];

    await Promise.all(
      ports.map(port =>
        new Promise<void>((resolve) => {
          const socket = new net.Socket();
          let isOpen = false;
          socket.setTimeout(timeout);

          socket.once('connect', () => {
            isOpen = true;
            openPorts.push(port);
            socket.destroy();
          });
          socket.once('timeout', () => socket.destroy());
          socket.once('error', () => socket.destroy());
          socket.once('close', () => resolve());

          socket.connect(port, ip);
        })
      )
    );
    return openPorts;
  }

  private getActiveIPsFromRange(ipRange: string): string[] {
    console.log(`Simulating scan for IP range: ${ipRange}`);
    const ips = ['192.168.1.23', '192.168.1.58', '192.168.1.102', '192.168.1.174', '192.168.1.219'];
    const count = Math.floor(Math.random() * 3) + 3;
    return ips.sort(() => 0.5 - Math.random()).slice(0, count);
  }

  private async fetchFavicon(url: string): Promise<string | null> {
    try {
      const domain = new URL(url).origin;
      const faviconUrls = [
        `${domain}/favicon.ico`,
        `${domain}/favicon.png`,
        `${domain}/apple-touch-icon.png`,
        `${domain}/apple-touch-icon-precomposed.png`,
      ];

      for (const faviconUrl of faviconUrls) {
        try {
          const response = await fetch(faviconUrl, {
            method: 'HEAD',
          });
          if (response.ok) {
            return faviconUrl;
          }
        } catch (e) {
          // Continue to next URL
        }
      }

      return null;
    } catch (error) {
      console.error(`Error fetching favicon for ${url}:`, error);
      return null;
    }
  }
}

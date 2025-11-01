import { Injectable } from '@nestjs/common';
import puppeteer from 'puppeteer';
import { OpenGraphResult } from './dto/opengraph.dto';

@Injectable()
export class OpenGraphService {
  async scrapeOpenGraph(url: string, proxy?: string): Promise<OpenGraphResult> {
    let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;

    try {
      const launchOptions: Parameters<typeof puppeteer.launch>[0] = {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-software-rasterizer',
          '--no-zygote',
          '--single-process',
          '--disable-background-networking',
          '--disable-renderer-backgrounding',
        ],
      };

      if (proxy) {
        launchOptions.args?.push(`--proxy-server=${proxy}`);
      }

      browser = await puppeteer.launch(launchOptions);
      const page = await browser.newPage();

      // 设置超时时间
      await page.setDefaultNavigationTimeout(60000);
      await page.setDefaultTimeout(60000);

      // 设置用户代理
      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      );

      // 访问页面 - 使用 domcontentloaded 替代 networkidle2
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });


      // 提取 OpenGraph 和其他 meta 标签信息
      const metaData = await page.evaluate(() => {
        const result: any = {};

        // 获取所有 meta 标签
        const metaTags = document.querySelectorAll('meta');
        metaTags.forEach((tag) => {
          const property = tag.getAttribute('property');
          const name = tag.getAttribute('name');
          const content = tag.getAttribute('content');

          if (property && content) {
            // OpenGraph 标签
            if (property.startsWith('og:')) {
              const key = property.replace('og:', '');
              result[key] = content;
            }
            // Twitter 标签
            else if (property.startsWith('twitter:')) {
              const key = property;
              result[key] = content;
            }
          }

          if (name && content) {
            // Twitter 标签
            if (name.startsWith('twitter:')) {
              result[name] = content;
            }
            // 其他常见标签
            else if (name === 'description') {
              if (!result.description) {
                result.description = content;
              }
            }
          }
        });

        // 如果没有 og:title，尝试获取 title 标签
        if (!result.title) {
          const titleTag = document.querySelector('title');
          if (titleTag) {
            result.title = titleTag.textContent || null;
          }
        }

        // 获取 favicon
        const faviconLink =
          document.querySelector('link[rel="icon"]') ||
          document.querySelector('link[rel="shortcut icon"]') ||
          document.querySelector('link[rel="apple-touch-icon"]');

        if (faviconLink) {
          const href = faviconLink.getAttribute('href');
          if (href) {
            // 处理相对路径
            result.favicon = new URL(href, window.location.origin).href;
          }
        }

        // 如果没有找到 favicon，尝试默认路径
        if (!result.favicon) {
          result.favicon = new URL('/favicon.ico', window.location.origin).href;
        }

        return result;
      });

      // 构建返回结果
      const openGraphResult: OpenGraphResult = {
        url,
        title: metaData.title || null,
        description: metaData.description || null,
        image: metaData.image || null,
        siteName: metaData.site_name || null,
        type: metaData.type || null,
        locale: metaData.locale || null,
        favicon: metaData.favicon || null,
        twitterCard: metaData['twitter:card'] || null,
        twitterSite: metaData['twitter:site'] || null,
        twitterCreator: metaData['twitter:creator'] || null,
        twitterTitle: metaData['twitter:title'] || null,
        twitterDescription: metaData['twitter:description'] || null,
        twitterImage: metaData['twitter:image'] || null,
      };

      // 添加其他找到的 meta 标签
      Object.keys(metaData).forEach(key => {
        if (!openGraphResult.hasOwnProperty(key)) {
          openGraphResult[key] = metaData[key];
        }
      });

      await browser.close();
      return openGraphResult;

    } catch (error) {
      if (browser) {
        await browser.close();
      }
      console.error('Error scraping OpenGraph data:', error);
      throw new Error(`Failed to scrape OpenGraph data: ${error.message}`);
    }
  }

  /**
   * 批量爬取多个网站的 OpenGraph 信息
   */
  async scrapeMultiple(urls: string[], proxy?: string): Promise<OpenGraphResult[]> {
    const results = await Promise.allSettled(
      urls.map(url => this.scrapeOpenGraph(url, proxy))
    );

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        // 返回错误信息
        return {
          url: urls[index],
          title: null,
          description: null,
          image: null,
          siteName: null,
          type: null,
          locale: null,
          favicon: null,
          twitterCard: null,
          twitterSite: null,
          twitterCreator: null,
          twitterTitle: null,
          twitterDescription: null,
          twitterImage: null,
          error: result.reason?.message || 'Unknown error',
        };
      }
    });
  }
}

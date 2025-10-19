import { Injectable } from '@nestjs/common';
import puppeteer, { HTTPResponse } from 'puppeteer';
import { URL } from 'url';
import axios from 'axios';
import * as cheerio from 'cheerio';

interface Vulnerability {
  type: string;
  description: string;
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
}

interface SensitivePage {
  url: string;
  type: string;
  description: string;
  riskLevel: 'Low' | 'Medium' | 'High' | 'Critical';
}

interface ApiRequest {
  url: string;
  method: string;
  type: string;
  status?: number;
  headers?: any;
  requestBody?: any;
  response?: any;
  responseSize?: number | null;
  duration?: number;
  fromPage: string;
}

interface CrawlPageResult {
  url: string;
  title: string;
  htmlContent: string;
  text: string;
  links: string[];
  sensitivePages: SensitivePage[];
  sensitivePagesText: string;
  vulnerabilities: string;
  screenshotBase64: string | null;
  apiRequests: ApiRequest[];
}

@Injectable()
export class CrawlService {
  async crawlPage(url: string, proxy?: string): Promise<CrawlPageResult> {
    console.log(`Ready to Crawling ${url}`);

    // 基础参数数组
    const args = [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage'
    ];

    // 当proxy存在且不为空字符串时,添加代理参数
    if (proxy && proxy.trim() !== '') {
      console.log(`Using proxy: ${proxy}`);
      args.push(`--proxy-server=${proxy}`);
    }

    const browser = await puppeteer.launch({
      args: args,
      headless: true
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
    );

    // 存储网络请求信息的数组
    const apiRequests: ApiRequest[] = [];

    // 监听网络请求
    await page.setRequestInterception(true);

    page.on('request', (request) => {
      const requestUrl = request.url();
      const method = request.method();
      const headers = request.headers();
      const postData = request.postData();

      // 过滤出API请求 - 排除静态资源
      if (
        requestUrl.includes('/api/') ||
        requestUrl.includes('/graphql') ||
        requestUrl.includes('/rest/') ||
        method !== 'GET' ||
        headers['content-type']?.includes('application/json') ||
        headers['content-type']?.includes('application/x-www-form-urlencoded')
      ) {
        const startTime = Date.now();

        const requestData = {
          url: requestUrl,
          method: method,
          type: request.resourceType(),
          headers: headers,
          requestBody: postData ? (function() {
            try {
              return JSON.parse(postData);
            } catch {
              return postData;
            }
          })() : null,
          fromPage: url,
          startTime: startTime
        };

        // 临时存储,等响应时补充信息
        (request as any).requestData = requestData;
      }

      request.continue();
    });

    page.on('response', async (response) => {
      const request = response.request();
      const requestData = (request as any).requestData;

      if (requestData) {
        try {
          const endTime = Date.now();
          const duration = endTime - requestData.startTime;

          let responseBody: string | null = null;
          try {
            const contentLength = response.headers()['content-length'];
            if (contentLength && parseInt(contentLength) < 1024 * 1024) {
              const responseText = await response.text();
              responseBody = responseText;
            } else if (!contentLength) {
              try {
                const responseText = await response.text();
                if (responseText.length < 1024 * 1024) {
                  responseBody = responseText;
                }
              } catch (e) {
                // 跳过
              }
            }
          } catch (e) {
            // 响应体获取失败,跳过
          }

          apiRequests.push({
            url: requestData.url,
            method: requestData.method,
            type: requestData.type,
            status: response.status(),
            headers: requestData.headers,
            requestBody: requestData.requestBody,
            response: responseBody ? { body: responseBody, headers: response.headers() } : null,
            responseSize: response.headers()['content-length'] ? parseInt(response.headers()['content-length']) : null,
            duration: duration,
            fromPage: requestData.fromPage,
          });
        } catch (e) {
          console.error('Error processing response:', e);
        }
      }
    });

    console.log(`Visiting ${url}`);
    let response: HTTPResponse | null = null;
    try {
      response = await page.goto(url, { waitUntil: 'networkidle0' });
    } catch (error) {
      console.error(`Failed to navigate to ${url}:`, error);
      await browser.close();
      return {
        url,
        title: 'Crawl Failed',
        htmlContent: '',
        text: `Failed to navigate to URL.`,
        links: [],
        sensitivePages: [],
        sensitivePagesText: '',
        vulnerabilities: JSON.stringify([{
          type: 'Crawl Error',
          description: `Puppeteer failed to navigate to the page. Error: ${error instanceof Error ? error.message : String(error)}`,
          severity: 'Critical'
        }]),
        screenshotBase64: null,
        apiRequests: [],
      };
    }

    const finalUrl = response?.url() || url;

    console.log(`Final URL after redirects: ${finalUrl}`);

    // 截图
    let base64Image = '';
    try {
      base64Image = await page.screenshot({ encoding: 'base64', type: 'png', fullPage: true });
    } catch (error) {
      console.error(`Failed to take screenshot of ${finalUrl}:`, error);
    }
    const screenshotBase64 = base64Image ? `data:image/png;base64,${base64Image}` : null;

    // 检查 Content-Type
    const headers = response?.headers() || {};
    const contentType = headers['content-type'] || '';
    if (!contentType.includes('text/html')) {
      await browser.close();
      return {
        url: finalUrl,
        title: 'Non-HTML Content',
        htmlContent: '',
        text: '',
        links: [],
        sensitivePages: [],
        sensitivePagesText: '',
        vulnerabilities: 'Skipped analysis: Non-HTML content',
        screenshotBase64,
        apiRequests: [],
      };
    }

    // 确保 <body> 存在
    try {
      await page.waitForSelector('body', { timeout: 5000 });
    } catch {
      console.warn(`No <body> found for ${finalUrl}`);
      await browser.close();
      return {
        url: finalUrl,
        title: 'Empty HTML',
        htmlContent: '',
        text: '',
        links: [],
        sensitivePages: [],
        sensitivePagesText: '',
        vulnerabilities: 'No <body> tag found in document',
        screenshotBase64,
        apiRequests: [],
      };
    }

    const vulnerabilities: Vulnerability[] = [];

    // 1. Clickjacking Check
    const xFrameOptions = headers['x-frame-options']?.toLowerCase();
    const csp = headers['content-security-policy'];
    if (!xFrameOptions && (!csp || !csp.includes('frame-ancestors'))) {
      vulnerabilities.push({
        type: 'Clickjacking',
        description: 'The page is missing the X-Frame-Options header or a Content-Security-Policy with frame-ancestors directive. This could allow the page to be embedded in an iframe on a malicious site.',
        severity: 'Medium',
      });
    }

    // 2. CORS Misconfiguration Check
    const acao = headers['access-control-allow-origin'];
    if (acao === '*') {
      vulnerabilities.push({
        type: 'CORS Misconfiguration',
        description: 'The Access-Control-Allow-Origin header is set to "*", which is overly permissive. This could allow malicious websites to make requests to this page and read the response.',
        severity: 'Medium',
      });
    }

    // 3. Missing Content-Security-Policy (CSP) Header
    if (!csp) {
      vulnerabilities.push({
        type: 'Missing CSP Header',
        description: 'The Content-Security-Policy (CSP) header is not set. A strong CSP can help prevent Cross-Site Scripting (XSS) and other injection attacks.',
        severity: 'Medium'
      });
    }

    // 敏感页面检测函数
    const detectSensitivePage = (url: string, linkText: string): SensitivePage | null => {
      const urlLower = url.toLowerCase();
      const textLower = linkText.toLowerCase();

      const loginPatterns = [
        /login/i, /signin/i, /sign-in/i, /auth/i, /authentication/i,
        /logon/i, /user/i, /account/i, /portal/i, /dashboard/i,
        /登录/i, /登陆/i, /用户/i
      ];

      const adminPatterns = [
        /admin/i, /administrator/i, /console/i, /control/i, /panel/i,
        /manage/i, /manager/i, /backend/i, /cms/i, /cpanel/i,
        /phpmyadmin/i, /webmail/i, /管理/i, /后台/i, /控制台/i
      ];

      const uploadPatterns = [
        /upload/i, /file/i, /attach/i, /attachment/i, /media/i,
        /documents/i, /files/i, /上传/i, /文件/i, /附件/i
      ];

      const configPatterns = [
        /config/i, /configuration/i, /settings/i, /setup/i, /install/i,
        /debug/i, /test/i, /info/i, /status/i, /health/i, /version/i,
        /phpinfo/i, /server-info/i, /配置/i, /设置/i, /调试/i
      ];

      const apiPatterns = [
        /api/i, /rest/i, /graphql/i, /json/i, /xml/i, /swagger/i,
        /接口/i, /api文档/i
      ];

      const dbPatterns = [
        /database/i, /db/i, /mysql/i, /postgres/i, /mongodb/i,
        /sql/i, /数据库/i
      ];

      const checkTarget = `${urlLower} ${textLower}`;

      if (loginPatterns.some(pattern => pattern.test(checkTarget))) {
        return {
          url,
          type: 'Login Page',
          description: `Potential login/authentication page detected: ${linkText}`,
          riskLevel: 'High'
        };
      }

      if (adminPatterns.some(pattern => pattern.test(checkTarget))) {
        return {
          url,
          type: 'Admin/Console Page',
          description: `Potential administrative or control panel page detected: ${linkText}`,
          riskLevel: 'Critical'
        };
      }

      if (uploadPatterns.some(pattern => pattern.test(checkTarget))) {
        return {
          url,
          type: 'File Upload Page',
          description: `Potential file upload page detected: ${linkText}`,
          riskLevel: 'High'
        };
      }

      if (configPatterns.some(pattern => pattern.test(checkTarget))) {
        return {
          url,
          type: 'Configuration/Debug Page',
          description: `Potential configuration or debug information page detected: ${linkText}`,
          riskLevel: 'Medium'
        };
      }

      if (apiPatterns.some(pattern => pattern.test(checkTarget))) {
        return {
          url,
          type: 'API Endpoint',
          description: `Potential API endpoint detected: ${linkText}`,
          riskLevel: 'Medium'
        };
      }

      if (dbPatterns.some(pattern => pattern.test(checkTarget))) {
        return {
          url,
          type: 'Database Access Page',
          description: `Potential database access page detected: ${linkText}`,
          riskLevel: 'Critical'
        };
      }

      return null;
    };

    const pageAnalysisResult = await page.evaluate(() => {
      const foundVulnerabilities: Vulnerability[] = [];

      // 4. Sensitive Information Leakage in HTML content
      const html = document.documentElement.outerHTML;
      const sensitivePatterns = {
        GOOGLE_API_KEY: /AIza[0-9A-Za-z-_]{35}/g,
        AWS_ACCESS_KEY_ID: /AKIA[0-9A-Z]{16}/g,
        GITHUB_TOKEN: /[a-zA-Z0-9_-]{40}/g,
        PRIVATE_KEY: /-----BEGIN (RSA|EC|PGP|OPENSSH) PRIVATE KEY-----/g,
        ENV_FILE: /\.env/g,
        CONFIG_FILE: /wp-config\.php/g,
      };

      for (const [key, regex] of Object.entries(sensitivePatterns)) {
        if (regex.test(html)) {
          foundVulnerabilities.push({
            type: 'Sensitive Information Leakage',
            description: `Potential exposure of ${key} found in the page's HTML source.`,
            severity: 'High',
          });
        }
      }

      // 5. CSRF Token Check in Forms
      document.querySelectorAll('form').forEach((form) => {
        const method = form.method.toUpperCase();
        if (method === 'POST' || method === 'PUT' || method === 'DELETE') {
          const hasCsrfToken = !!form.querySelector('input[type="hidden"][name*="csrf"], input[type="hidden"][name*="token"], input[type="hidden"][name*="nonce"]');
          if (!hasCsrfToken) {
            foundVulnerabilities.push({
              type: 'Missing CSRF Token',
              description: `A form (action: ${form.action || 'N/A'}, method: ${method}) appears to be missing a CSRF token, which could make it vulnerable to Cross-Site Request Forgery.`,
              severity: 'Medium',
            });
          }
        }
      });

      // 6. Basic XSS check
      const scripts = Array.from(document.scripts).map(s => s.innerHTML).join('\n');
      if (scripts.includes('.innerHTML=')) {
        foundVulnerabilities.push({
          type: 'Potential XSS via innerHTML',
          description: 'A script on the page uses `.innerHTML=`, which can be a vector for XSS if user-provided data is not properly sanitized. Manual review is recommended.',
          severity: 'Low'
        });
      }

      function getVisibleText(node: Node): string {
        const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, {
          acceptNode: (node) => {
            const parent = node.parentElement;
            if (!parent) return NodeFilter.FILTER_REJECT;
            const style = getComputedStyle(parent);
            if (style.display === 'none' || style.visibility === 'hidden') {
              return NodeFilter.FILTER_REJECT;
            }
            const text = node?.textContent?.trim();
            return text ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
          },
        });

        let text = '';
        while (walker.nextNode()) {
          text += walker.currentNode.textContent + '\n';
        }
        return text;
      }

      const title = document.title;

      const rawLinksWithText = Array.from(document.querySelectorAll('a[href]')).map((a) => ({
        href: a.getAttribute('href'),
        text: a.textContent?.trim() || a.getAttribute('title') || a.getAttribute('aria-label') || ''
      }));

      return {
        title,
        textContent: getVisibleText(document.body),
        rawLinksWithText,
        vulnerabilities: foundVulnerabilities,
      };
    });

    vulnerabilities.push(...pageAnalysisResult.vulnerabilities);

    const baseUrl = new URL(url);
    const sensitivePages: SensitivePage[] = [];
    const absoluteLinks = (pageAnalysisResult.rawLinksWithText || [])
      .filter((link) => !!link.href && !link.href.startsWith('javascript:') && !link.href.startsWith('#'))
      .map((link) => {
        try {
          const absoluteUrl = new URL(link.href || '', baseUrl).href;

          const sensitivePage = detectSensitivePage(absoluteUrl, link.text);
          if (sensitivePage) {
            sensitivePages.push(sensitivePage);
          }

          return absoluteUrl;
        } catch {
          return null;
        }
      })
      .filter((href): href is string => !!href);

    const content = await page.content();
    await browser.close();

    const vulnerabilitiesText = vulnerabilities.map(v =>
      `Type: ${v.type}\nDescription: ${v.description}\nSeverity: ${v.severity}\n`
    ).join('\n');

    const sensitivePagesText = sensitivePages.map(sp =>
      `Type: ${sp.type}\nURL: ${sp.url}\nDescription: ${sp.description}\nRisk Level: ${sp.riskLevel}\n`
    ).join('\n');

    return {
      url,
      title: pageAnalysisResult.title,
      htmlContent: content,
      text: pageAnalysisResult.textContent.trim(),
      links: Array.from(new Set(absoluteLinks)),
      sensitivePages,
      sensitivePagesText,
      vulnerabilities: vulnerabilitiesText,
      screenshotBase64,
      apiRequests,
    };
  }

  async crawlMetaData(url: string): Promise<Record<string, string>> {
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; MetadataScraper/1.0)',
        },
      });
      const html = response.data;

      const $ = cheerio.load(html);
      const metadata: Record<string, string> = {};

      $('meta[property^="og:"]').each((_, element) => {
        const property = $(element).attr('property')?.replace('og:', '');
        const content = $(element).attr('content');
        if (property && content) {
          metadata[property] = content;
        }
      });

      if (metadata.image) {
        try {
          const imageResponse = await axios.get(metadata.image, {
            responseType: 'arraybuffer',
          });
          const base64Image = Buffer.from(imageResponse.data, 'binary').toString('base64');
          metadata.image_base64 = `data:${imageResponse.headers['content-type']};base64,${base64Image}`;
        } catch (error) {
          console.error('Failed to download image:', error);
          metadata.image_error = 'Image download failed';
          metadata.error = 'Failed to fetch image';
          metadata.image_base64 = '';
        }
      }

      return metadata;
    } catch (error) {
      console.error('Error:', error);
      return {
        image_base64: '',
        error: 'Failed to fetch metadata',
      };
    }
  }
}

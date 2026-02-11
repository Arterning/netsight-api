import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { CrawlService } from '../src/crawl/crawl.service';

async function testCrawlPage() {
  console.log('Testing crawlPage method...');
  
  // 创建 NestJS 应用实例
  const app = await NestFactory.create(AppModule);
  
  // 获取 CrawlService 实例
  const crawlService = app.get(CrawlService);
  
  // 测试 URL
  const testUrl = 'https://example.com';
  // 可选的代理设置
  const proxy = ''; // 如果需要代理，填写代理地址，例如 'http://127.0.0.1:7890'
  
  try {
    console.log(`Crawling ${testUrl}...`);
    
    // 调用 crawlPage 方法
    const result = await crawlService.crawlPage(testUrl, proxy);
    
    // 打印结果
    console.log('\n=== Crawl Result ===');
    console.log(`URL: ${result.url}`);
    console.log(`Title: ${result.title}`);
    console.log(`Links found: ${result.links.length}`);
    console.log(`API Requests: ${result.apiRequests.length}`);
    console.log(`Sensitive Pages: ${result.sensitivePages.length}`);
    console.log(`HTML Content Length: ${result.htmlContent.length}`);
    console.log(`Text Content Length: ${result.text.length}`);
    console.log(`Screenshot: ${result.screenshotBase64 ? 'Yes' : 'No'}`);
    console.log(`Vulnerabilities: ${result.vulnerabilities}`);
    
    // 打印前 5 个链接
    if (result.links.length > 0) {
      console.log('\n=== Top 5 Links ===');
      result.links.slice(0, 5).forEach((link, index) => {
        console.log(`${index + 1}. ${link}`);
      });
    }
    
    // 打印 API 请求
    if (result.apiRequests.length > 0) {
      console.log('\n=== API Requests ===');
      result.apiRequests.forEach((req, index) => {
        console.log(`${index + 1}. ${req.method} ${req.url}`);
        console.log(`   Status: ${req.status}`);
        console.log(`   Duration: ${req.duration}ms`);
      });
    }
    
    console.log('\nTest completed successfully!');
  } catch (error) {
    console.error('Error during crawl:', error);
  } finally {
    // 关闭应用实例
    await app.close();
  }
}

// 运行测试
testCrawlPage();
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  WebsiteAnalysisResult,
  AIConfig,
} from './interfaces/ai-analysis.interface';
import axios from 'axios';

@Injectable()
export class AIService {
  private readonly logger = new Logger(AIService.name);
  private readonly config: AIConfig;

  constructor(private configService: ConfigService) {
    this.config = {
      provider: this.configService.get<'openai' | 'deepseek' | 'claude'>(
        'AI_PROVIDER',
        'openai',
      ),
      apiKey: this.configService.get<string>('AI_API_KEY', ''),
      modelName: this.configService.get<string>('AI_MODEL_NAME', 'gpt-4'),
      baseURL: this.configService.get<string>('AI_BASE_URL'),
      maxTokens: this.configService.get<number>('AI_MAX_TOKENS', 4000),
      temperature: this.configService.get<number>('AI_TEMPERATURE', 0.7),
    };

    this.logger.log(
      `AI Service initialized with provider: ${this.config.provider}`,
    );
  }

  async analyzeWebsite(
    homepageTitle: string,
    content: string,
    url: string,
  ): Promise<WebsiteAnalysisResult> {
    if (!this.config.apiKey) {
      this.logger.warn('AI API key not configured, returning default values');
      return this.getDefaultAnalysisResult(homepageTitle);
    }

    try {
      switch (this.config.provider) {
        case 'openai':
          return await this.analyzeWithOpenAI(homepageTitle, content, url);
        case 'deepseek':
          return await this.analyzeWithDeepSeek(homepageTitle, content, url);
        case 'claude':
          return await this.analyzeWithClaude(homepageTitle, content, url);
        default:
          this.logger.warn(
            `Unknown AI provider: ${this.config.provider}, using default values`,
          );
          return this.getDefaultAnalysisResult(homepageTitle);
      }
    } catch (error) {
      this.logger.error('AI analysis failed', error);
      return this.getDefaultAnalysisResult(homepageTitle);
    }
  }

  private async analyzeWithOpenAI(
    homepageTitle: string,
    content: string,
    url: string,
  ): Promise<WebsiteAnalysisResult> {
    const prompt = this.buildAnalysisPrompt(homepageTitle, content, url);

    try {
      const response = await axios.post(
        `${this.config.baseURL || 'https://api.openai.com/v1'}/chat/completions`,
        {
          model: this.config.modelName,
          messages: [
            {
              role: 'system',
              content:
                '你是一个专业的网站分析专家。请以JSON格式返回分析结果，不要包含任何markdown格式标记。',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: this.config.temperature,
          max_tokens: this.config.maxTokens,
          response_format: { type: 'json_object' },
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.config.apiKey}`,
          },
          timeout: 60000,
        },
      );

      const result = JSON.parse(
        response.data.choices[0].message.content.trim(),
      );
      return this.parseAIResponse(result);
    } catch (error) {
      this.logger.error('OpenAI API call failed', error);
      throw error;
    }
  }

  private async analyzeWithDeepSeek(
    homepageTitle: string,
    content: string,
    url: string,
  ): Promise<WebsiteAnalysisResult> {
    const prompt = this.buildAnalysisPrompt(homepageTitle, content, url);

    try {
      const response = await axios.post(
        `${this.config.baseURL || 'https://api.deepseek.com/v1'}/chat/completions`,
        {
          model: this.config.modelName,
          messages: [
            {
              role: 'system',
              content:
                '你是一个专业的网站分析专家。请以JSON格式返回分析结果，不要包含任何markdown格式标记。',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: this.config.temperature,
          max_tokens: this.config.maxTokens,
          response_format: { type: 'json_object' },
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.config.apiKey}`,
          },
          timeout: 60000,
        },
      );

      const result = JSON.parse(
        response.data.choices[0].message.content.trim(),
      );
      return this.parseAIResponse(result);
    } catch (error) {
      this.logger.error('DeepSeek API call failed', error);
      throw error;
    }
  }

  private async analyzeWithClaude(
    homepageTitle: string,
    content: string,
    url: string,
  ): Promise<WebsiteAnalysisResult> {
    const prompt = this.buildAnalysisPrompt(homepageTitle, content, url);

    try {
      const response = await axios.post(
        `${this.config.baseURL || 'https://api.anthropic.com/v1'}/messages`,
        {
          model: this.config.modelName,
          max_tokens: this.config.maxTokens,
          temperature: this.config.temperature,
          messages: [
            {
              role: 'user',
              content: `你是一个专业的网站分析专家。请以JSON格式返回分析结果，不要包含任何markdown格式标记。\n\n${prompt}`,
            },
          ],
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.config.apiKey,
            'anthropic-version': '2023-06-01',
          },
          timeout: 60000,
        },
      );

      const content = response.data.content[0].text;
      const result = JSON.parse(content.trim());
      return this.parseAIResponse(result);
    } catch (error) {
      this.logger.error('Claude API call failed', error);
      throw error;
    }
  }

  private buildAnalysisPrompt(
    homepageTitle: string,
    content: string,
    url: string,
  ): string {
    const truncatedContent =
      content.length > 8000 ? content.substring(0, 8000) + '...' : content;

    return `请分析以下网站内容，并以JSON格式返回结构化的分析结果。

网站URL: ${url}
网站标题: ${homepageTitle}
网站内容: ${truncatedContent}

请提供以下分析维度的结果，并严格按照以下JSON格式返回（不要添加markdown代码块标记）：

{
  "websiteAnalysis": "对网站的整体分析描述，包括网站的主要功能、目标用户、核心价值等（150-300字）",
  "businessType": "业务类型（例如：电商平台、企业官网、SaaS服务、新闻媒体、个人博客、社交平台等）",
  "valueScore": 一个0-100的数字，表示网站的业务价值评分,
  "businessValueAnalysis": "业务价值分析，说明为什么给出这个评分，包括市场定位、用户价值、商业模式等（100-200字）",
  "keywords": "提取的5-10个核心关键词，用逗号分隔",
  "riskLevel": "安全风险等级（Low/Medium/High/Critical）",
  "securityAnalysis": "安全风险分析，基于内容判断可能存在的安全问题或特征（例如：是否包含登录功能、支付功能、用户数据收集等）",
  "associatedDomains": "从内容中识别到的可能关联的其他域名或服务（如果没有则返回空字符串）"
}

注意：
1. 必须返回有效的JSON格式
2. 不要使用markdown代码块标记（不要用\`\`\`json）
3. 所有字段都必须包含
4. 数值类型不要加引号
5. 分析要客观准确，基于实际内容`;
  }

  private parseAIResponse(aiResponse: any): WebsiteAnalysisResult {
    return {
      analysisResult: `${aiResponse.websiteAnalysis || ''}\n\n业务类型: ${aiResponse.businessType || '未知'}\n安全风险等级: ${aiResponse.riskLevel || 'Low'}\n安全分析: ${aiResponse.securityAnalysis || ''}`,
      businessValueResult: {
        valuePropositionScore: aiResponse.valueScore || 50,
        analysis: aiResponse.businessValueAnalysis || '业务价值分析',
        keywords: aiResponse.keywords || '',
      },
      associationResult: aiResponse.associatedDomains || '',
    };
  }

  private getDefaultAnalysisResult(
    homepageTitle: string,
  ): WebsiteAnalysisResult {
    return {
      analysisResult: `网站分析: ${homepageTitle}\n\n由于AI服务未配置或调用失败，此为默认分析结果。`,
      businessValueResult: {
        valuePropositionScore: 50,
        analysis: '业务价值分析（默认）',
        keywords: '待分析',
      },
      associationResult: '暂无关联分析',
    };
  }

  // AI对话方法（基于知识库上下文）
  async chat(
    question: string,
    knowledgeContext: string,
  ): Promise<{ answer: string }> {
    if (!this.config.apiKey) {
      this.logger.warn('AI API key not configured');
      return {
        answer: '抱歉，AI服务未配置，无法进行对话。请联系管理员配置AI API密钥。',
      };
    }

    try {
      switch (this.config.provider) {
        case 'openai':
          return await this.chatWithOpenAI(question, knowledgeContext);
        case 'deepseek':
          return await this.chatWithDeepSeek(question, knowledgeContext);
        case 'claude':
          return await this.chatWithClaude(question, knowledgeContext);
        default:
          this.logger.warn(`Unknown AI provider: ${this.config.provider}`);
          return {
            answer: '抱歉，不支持的AI提供商配置。',
          };
      }
    } catch (error) {
      this.logger.error('AI chat failed', error);
      return {
        answer: '抱歉，AI对话服务暂时不可用，请稍后再试。',
      };
    }
  }

  private async chatWithOpenAI(
    question: string,
    knowledgeContext: string,
  ): Promise<{ answer: string }> {
    try {
      const systemPrompt = `你是一个智能助手。你的任务是根据提供的知识库内容回答用户的问题。

知识库内容：
${knowledgeContext}

请基于以上知识库内容回答用户的问题。如果知识库中没有相关信息，请明确告知用户。回答要准确、专业、友好。`;

      const response = await axios.post(
        `${this.config.baseURL || 'https://api.openai.com/v1'}/chat/completions`,
        {
          model: this.config.modelName,
          messages: [
            {
              role: 'system',
              content: systemPrompt,
            },
            {
              role: 'user',
              content: question,
            },
          ],
          temperature: this.config.temperature,
          max_tokens: this.config.maxTokens,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.config.apiKey}`,
          },
          timeout: 60000,
        },
      );

      return {
        answer: response.data.choices[0].message.content.trim(),
      };
    } catch (error) {
      this.logger.error('OpenAI chat API call failed', error);
      throw error;
    }
  }

  private async chatWithDeepSeek(
    question: string,
    knowledgeContext: string,
  ): Promise<{ answer: string }> {
    try {
      const systemPrompt = `你是一个智能助手。你的任务是根据提供的知识库内容回答用户的问题。

知识库内容：
${knowledgeContext}

请基于以上知识库内容回答用户的问题。如果知识库中没有相关信息，请明确告知用户。回答要准确、专业、友好。`;

      const response = await axios.post(
        `${this.config.baseURL || 'https://api.deepseek.com/v1'}/chat/completions`,
        {
          model: this.config.modelName,
          messages: [
            {
              role: 'system',
              content: systemPrompt,
            },
            {
              role: 'user',
              content: question,
            },
          ],
          temperature: this.config.temperature,
          max_tokens: this.config.maxTokens,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.config.apiKey}`,
          },
          timeout: 60000,
        },
      );

      return {
        answer: response.data.choices[0].message.content.trim(),
      };
    } catch (error) {
      this.logger.error('DeepSeek chat API call failed', error);
      throw error;
    }
  }

  private async chatWithClaude(
    question: string,
    knowledgeContext: string,
  ): Promise<{ answer: string }> {
    try {
      const systemPrompt = `你是一个智能助手。你的任务是根据提供的知识库内容回答用户的问题。

知识库内容：
${knowledgeContext}

请基于以上知识库内容回答用户的问题。如果知识库中没有相关信息，请明确告知用户。回答要准确、专业、友好。`;

      const response = await axios.post(
        `${this.config.baseURL || 'https://api.anthropic.com/v1'}/messages`,
        {
          model: this.config.modelName,
          max_tokens: this.config.maxTokens,
          temperature: this.config.temperature,
          messages: [
            {
              role: 'user',
              content: `${systemPrompt}\n\n用户问题: ${question}`,
            },
          ],
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.config.apiKey,
            'anthropic-version': '2023-06-01',
          },
          timeout: 60000,
        },
      );

      return {
        answer: response.data.content[0].text.trim(),
      };
    } catch (error) {
      this.logger.error('Claude chat API call failed', error);
      throw error;
    }
  }
}

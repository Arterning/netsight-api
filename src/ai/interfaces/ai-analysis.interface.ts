export interface WebsiteAnalysisResult {
  analysisResult: string;
  businessValueResult: {
    valuePropositionScore: number;
    analysis: string;
    keywords: string;
  };
  associationResult: string;
}

export interface AIConfig {
  provider: 'openai' | 'deepseek' | 'claude';
  apiKey: string;
  modelName: string;
  baseURL?: string;
  maxTokens?: number;
  temperature?: number;
}

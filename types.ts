export interface UniversalInterfaceInput {
  website_image: File;
  task_prompt: string;
  page_url?: string;
}

export interface AnalysisResult {
  text: string;
  timestamp: number;
}

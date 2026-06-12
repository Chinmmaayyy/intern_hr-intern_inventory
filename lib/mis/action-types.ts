export interface JobStatusResponse {
  id: string;
  status: string;
  progress: number;
  file_key?: string | null;
  error?: string | null;
  createdAt: Date;
  finished_at?: Date | null;
}

export interface GenerateReportResponse {
  async: boolean;
  jobId?: string;
  rows?: Record<string, unknown>[];
  totals?: Record<string, number>;
  meta?: {
    generatedAt: Date;
    reportName: string;
    rowCount: number;
  };
}

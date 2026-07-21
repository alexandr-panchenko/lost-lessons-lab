type AnalysisLog = {
  attemptId: string;
  category?: string;
  diagnostic?: string;
  event: "analysis.completed" | "analysis.failed";
  latencyMs: number;
  modelId?: string;
  responseId?: string;
  roomHash: string;
  upstreamStatus?: number;
  usedRepair: boolean;
};

export function logAnalysisMetadata(event: AnalysisLog): void {
  console.info(
    JSON.stringify({ ...event, timestamp: new Date().toISOString() }),
  );
}

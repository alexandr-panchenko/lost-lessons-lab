type AnalysisLog = {
  attemptId: string;
  category?: string;
  event: "analysis.completed" | "analysis.failed";
  latencyMs: number;
  modelId?: string;
  responseId?: string;
  roomHash: string;
  usedRepair: boolean;
};

export function logAnalysisMetadata(event: AnalysisLog): void {
  console.info(
    JSON.stringify({ ...event, timestamp: new Date().toISOString() }),
  );
}

import {
  WorkflowEntrypoint,
  type WorkflowEvent,
  type WorkflowStep,
} from "cloudflare:workers";
import { z } from "zod";

import { parseAiConfiguration } from "../ai/openai-responses";
import type { WorkerEnv } from "../env";
import { runAnalysis } from "../routes/attempts";

const AnalysisWorkflowParamsSchema = z
  .object({
    attemptId: z.string().min(1).max(128),
    fixtureId: z.string().min(1).max(128),
    r2Key: z.string().min(1).max(512),
    roomId: z.string().regex(/^rm_[A-Za-z0-9_-]{20,40}$/u),
  })
  .strict();

export type AnalysisWorkflowParams = z.infer<
  typeof AnalysisWorkflowParamsSchema
>;

function bytesToBase64(bytes: Uint8Array): string {
  const chunkSize = 32_768;
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(
      ...bytes.subarray(offset, offset + chunkSize),
    );
  }
  return btoa(binary);
}

function testModelFetch(env: WorkerEnv): typeof fetch | undefined {
  const testEnv = env as WorkerEnv & {
    AI_TEST_FAKE_DELAY_MS?: string;
    AI_TEST_RESPONSE_JSON?: string;
  };
  if (
    testEnv.APP_ENV !== "test" ||
    testEnv.AI_TEST_FAKE_DELAY_MS === undefined ||
    testEnv.AI_TEST_RESPONSE_JSON === undefined
  )
    return undefined;
  const delay = Math.max(
    0,
    Number.parseInt(testEnv.AI_TEST_FAKE_DELAY_MS, 10) || 0,
  );
  return async () => {
    await new Promise((resolve) => setTimeout(resolve, delay));
    return Response.json({
      id: "resp_delayed_workflow_test",
      model: "gpt-5.6-test",
      output: [
        {
          content: [
            { text: testEnv.AI_TEST_RESPONSE_JSON, type: "output_text" },
          ],
          type: "message",
        },
      ],
      usage: { input_tokens: 10, output_tokens: 20, total_tokens: 30 },
    });
  };
}

export class AnalysisWorkflow extends WorkflowEntrypoint<
  WorkerEnv,
  AnalysisWorkflowParams
> {
  override async run(
    event: Readonly<WorkflowEvent<AnalysisWorkflowParams>>,
    step: WorkflowStep,
  ): Promise<{ completed: true }> {
    const params = AnalysisWorkflowParamsSchema.parse(event.payload);
    await step.do(
      "analyze persisted handwriting",
      {
        retries: { delay: 0, limit: 0 },
        timeout: "5 minutes",
      },
      async () => {
        const room = this.env.ROOMS.getByName(params.roomId);
        try {
          const object = await this.env.MEDIA.get(params.r2Key);
          if (object === null) throw new Error("attempt_media_missing");
          const imageBase64 = bytesToBase64(
            new Uint8Array(await object.arrayBuffer()),
          );
          const fetchImpl = testModelFetch(this.env);
          await runAnalysis({
            attemptId: params.attemptId,
            config: parseAiConfiguration(this.env),
            ...(fetchImpl === undefined ? {} : { fetchImpl }),
            fixtureId: params.fixtureId,
            imageBase64,
            room,
            roomId: params.roomId,
          });
          return { terminal: "complete" as const };
        } catch {
          try {
            await room.failAiAttempt({
              attemptId: params.attemptId,
              category: "upstream",
              latencyMs: 0,
              usedRepair: false,
            });
          } catch {
            await room.releaseAttemptProcessingLock(params.attemptId);
          }
          return { terminal: "failed" as const };
        }
      },
    );
    return { completed: true };
  }
}

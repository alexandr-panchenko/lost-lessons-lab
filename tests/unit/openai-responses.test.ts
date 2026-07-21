import { describe, expect, it, vi } from "vitest";

import {
  analyzeBridgeSolution,
  analyzeSpeedSolution,
  analyzeStructureSolution,
  analyzeWaterSolution,
  buildOpenAiSolutionRequest,
  parseAiConfiguration,
} from "../../src/worker/ai/openai-responses";
import { DEFAULT_WATER_FIXTURE } from "../../fixtures/water/packs";
import { DEFAULT_SPEED_FIXTURE } from "../../fixtures/speed/packs";
import { DEFAULT_STRUCTURE_FIXTURE } from "../../fixtures/structure/packs";
import { wrongBridgeAnalysis } from "../fixtures/openai/solution-results";

const config = parseAiConfiguration({
  AI_ENABLED: "true",
  AI_MAX_RETRIES: "1",
  AI_TIMEOUT_MS: "3000",
  OPENAI_API_KEY: "test-key-long-enough-for-schema",
  OPENAI_MODEL: "gpt-5.6",
});

function modelResponse(result: unknown, id = "resp_test"): Response {
  return Response.json({
    id,
    model: "gpt-5.6-2026-07-01",
    output: [
      {
        content: [{ text: JSON.stringify(result), type: "output_text" }],
        type: "message",
      },
    ],
    usage: { input_tokens: 10, output_tokens: 20, total_tokens: 30 },
  });
}

function refusalResponse(): Response {
  return Response.json({
    id: "resp_refusal",
    model: "gpt-5.6-sol",
    output: [
      {
        content: [{ refusal: "Cannot interpret this image.", type: "refusal" }],
        type: "message",
      },
    ],
  });
}

describe("GPT-5.6 Responses boundary", () => {
  it("uses the strict structure schema and validates the shared load contract", async () => {
    const structureAnalysis = {
      confidence: 0.94,
      finalAnswers: [{ name: "totalLoadKg", unit: "kg", value: 60 }],
      firstError: null,
      scenarioInputs: { itemCount: 12, totalLoadKg: 60, unitLoadKg: 5 },
      schemaVersion: "solution-analysis.v1",
      steps: [
        {
          normalizedExpression: "12 * 5 = 60",
          regionId: "line-1",
          status: "valid",
          text: "12 × 5 = 60",
        },
      ],
      studentFacingExplanation:
        "Twelve crates at five kilograms each total 60 kilograms.",
      transcription: "12 × 5 = 60",
      verdict: "correct",
    } as const;
    const request = buildOpenAiSolutionRequest({
      imageBase64: "aW1hZ2U=",
      safetyIdentifier: "room_hash",
      structureFixture: DEFAULT_STRUCTURE_FIXTURE,
      template: "structure",
    });
    expect(request.text.format.name).toBe("structure_solution_analysis_v1");
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      modelResponse(structureAnalysis),
    );
    const result = await analyzeStructureSolution({
      config,
      fetchImpl,
      fixture: DEFAULT_STRUCTURE_FIXTURE,
      imageBase64: "aW1hZ2U=",
      safetyIdentifier: "room_hash",
    });
    expect(result).toMatchObject({
      ok: true,
      validated: { outcome: { resultClass: "structure_stable" } },
    });
  });

  it("uses the strict speed schema and validates the shared motion contract", async () => {
    const speedAnalysis = {
      confidence: 0.94,
      finalAnswers: [{ name: "distanceMeters", unit: "m", value: 24 }],
      firstError: null,
      scenarioInputs: {
        distanceMeters: 24,
        speedMetersPerSecond: 8,
        timeSeconds: 3,
      },
      schemaVersion: "solution-analysis.v1",
      steps: [
        {
          normalizedExpression: "8 * 3 = 24",
          regionId: "line-1",
          status: "valid",
          text: "8 × 3 = 24 m",
        },
      ],
      studentFacingExplanation: "Speed times time gives 24 meters.",
      transcription: "8 m/s × 3 s = 24 m",
      verdict: "correct",
    } as const;
    const request = buildOpenAiSolutionRequest({
      imageBase64: "aW1hZ2U=",
      safetyIdentifier: "room_hash",
      speedFixture: DEFAULT_SPEED_FIXTURE,
      template: "speed",
    });
    expect(request.text.format.name).toBe("speed_solution_analysis_v1");
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      modelResponse(speedAnalysis),
    );
    const result = await analyzeSpeedSolution({
      config,
      fetchImpl,
      fixture: DEFAULT_SPEED_FIXTURE,
      imageBase64: "aW1hZ2U=",
      safetyIdentifier: "room_hash",
    });
    expect(result).toMatchObject({
      ok: true,
      validated: { outcome: { resultClass: "speed_correct" } },
    });
  });

  it("uses the strict water schema and validates the shared water contract", async () => {
    const waterAnalysis = {
      confidence: 0.94,
      finalAnswers: [{ name: "volumeLiters", unit: "L", value: 15 }],
      firstError: null,
      scenarioInputs: {
        flowRateLitersPerMinute: 3,
        timeMinutes: 5,
        volumeLiters: 15,
      },
      schemaVersion: "solution-analysis.v1",
      steps: [
        {
          normalizedExpression: "3 * 5 = 15",
          regionId: "line-1",
          status: "valid",
          text: "3 × 5 = 15 L",
        },
      ],
      studentFacingExplanation: "The rate times the time gives 15 liters.",
      transcription: "3 L/min × 5 min = 15 L",
      verdict: "correct",
    } as const;
    const request = buildOpenAiSolutionRequest({
      imageBase64: "aW1hZ2U=",
      safetyIdentifier: "room_hash",
      template: "water",
      waterFixture: DEFAULT_WATER_FIXTURE,
    });
    expect(request.text.format.name).toBe("water_solution_analysis_v1");
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      modelResponse(waterAnalysis),
    );
    const result = await analyzeWaterSolution({
      config,
      fetchImpl,
      fixture: DEFAULT_WATER_FIXTURE,
      imageBase64: "aW1hZ2U=",
      safetyIdentifier: "room_hash",
    });
    expect(result).toMatchObject({
      ok: true,
      validated: { outcome: { resultClass: "water_correct" } },
    });
  });

  it("uses a private strict request with a high-detail PNG", () => {
    const request = buildOpenAiSolutionRequest({
      imageBase64: "aW1hZ2U=",
      safetyIdentifier: "room_hash",
    });
    expect(request.model).toBe("gpt-5.6");
    expect(request.store).toBe(false);
    expect(request.reasoning).toEqual({ effort: "low" });
    expect(request.text.format).toMatchObject({
      name: "solution_analysis_v1",
      strict: true,
      type: "json_schema",
    });
    expect(request.input[0]?.content[1]).toEqual({
      detail: "high",
      image_url: "data:image/png;base64,aW1hZ2U=",
      type: "input_image",
    });
  });

  it("returns only deterministically validated extracted inputs", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      modelResponse(wrongBridgeAnalysis),
    );
    const result = await analyzeBridgeSolution({
      config,
      fetchImpl,
      imageBase64: "aW1hZ2U=",
      safetyIdentifier: "room_hash",
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.validated.outcome.resultClass).toBe("bridge_far_too_short");
      expect(result.responseId).toBe("resp_test");
      expect(result.usedRepair).toBe(false);
    }
  });

  it("permits exactly one schema repair and labels it", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(modelResponse({ incomplete: true }, "resp_bad"))
      .mockResolvedValueOnce(modelResponse(wrongBridgeAnalysis, "resp_fixed"));
    const result = await analyzeBridgeSolution({
      config,
      fetchImpl,
      imageBase64: "aW1hZ2U=",
      safetyIdentifier: "room_hash",
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({ ok: true, usedRepair: true });
    const repairedBody = JSON.parse(
      String(fetchImpl.mock.calls[1]?.[1]?.body),
    ) as { input: Array<{ content: Array<{ text?: string }> }> };
    expect(repairedBody.input[0]?.content[0]?.text).toContain("prior result");
  });

  it("stops after one transient retry and exposes a fallback category", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      Response.json({ error: "busy" }, { status: 429 }),
    );
    const result = await analyzeBridgeSolution({
      config,
      fetchImpl,
      imageBase64: "aW1hZ2U=",
      safetyIdentifier: "room_hash",
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({
      category: "rate_limited",
      ok: false,
      usedRepair: true,
    });
  });

  it.each([
    ["network error", () => Promise.reject(new Error("offline")), "upstream"],
    [
      "server error",
      () => Promise.resolve(new Response(null, { status: 500 })),
      "upstream",
    ],
    [
      "malformed response",
      () => Promise.resolve(modelResponse({ incomplete: true })),
      "invalid_schema",
    ],
  ] as const)("bounds retries for %s", async (_name, response, category) => {
    const fetchImpl = vi.fn<typeof fetch>(response);
    const result = await analyzeBridgeSolution({
      config,
      fetchImpl,
      imageBase64: "aW1hZ2U=",
      safetyIdentifier: "room_hash",
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({ category, ok: false, usedRepair: true });
  });

  it.each([
    ["ambiguous", "ambiguous"],
    ["unreadable", "unreadable"],
  ] as const)("does not guess when work is %s", async (verdict, category) => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      modelResponse({ ...wrongBridgeAnalysis, verdict }),
    );
    const result = await analyzeBridgeSolution({
      config,
      fetchImpl,
      imageBase64: "aW1hZ2U=",
      safetyIdentifier: "room_hash",
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ category, ok: false, usedRepair: false });
  });

  it("maps model refusal directly to a visible fallback", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => refusalResponse());
    const result = await analyzeBridgeSolution({
      config,
      fetchImpl,
      imageBase64: "aW1hZ2U=",
      safetyIdentifier: "room_hash",
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ category: "refusal", ok: false });
  });

  it("repairs semantic contradictions once and then fails safely", async () => {
    const contradictory = {
      ...wrongBridgeAnalysis,
      scenarioInputs: {
        deployedLengthMeters: 4.08,
        fractionAsDecimal: 0.75,
      },
    };
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      modelResponse(contradictory),
    );
    const result = await analyzeBridgeSolution({
      config,
      fetchImpl,
      imageBase64: "aW1hZ2U=",
      safetyIdentifier: "room_hash",
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({
      category: "semantic_invalid",
      ok: false,
      usedRepair: true,
    });
  });

  it("aborts a timed-out request without retrying", async () => {
    const timeoutConfig = { ...config, AI_TIMEOUT_MS: 5 };
    const fetchImpl = vi.fn<typeof fetch>(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new Error("aborted")),
          );
        }),
    );
    const result = await analyzeBridgeSolution({
      config: timeoutConfig,
      fetchImpl,
      imageBase64: "aW1hZ2U=",
      safetyIdentifier: "room_hash",
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ category: "timeout", ok: false });
  });

  it("fails closed when AI is disabled or its secret is missing", () => {
    expect(() =>
      parseAiConfiguration({
        AI_ENABLED: "true",
        AI_MAX_RETRIES: "1",
        AI_TIMEOUT_MS: "3000",
        OPENAI_MODEL: "gpt-5.6",
      }),
    ).toThrow();
  });
});

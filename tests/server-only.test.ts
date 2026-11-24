import { describe, expect, it, vi } from "vitest";
import * as ai from "../src/lib/ai/index";
import { generate } from "../src/lib/ai/index";
import * as config from "../src/lib/ai/config";
import * as errors from "../src/lib/ai/errors";
import * as limits from "../src/lib/ai/limits";
import * as log from "../src/lib/ai/log";
import * as models from "../src/lib/ai/models";
import * as orchestrator from "../src/lib/ai/orchestrator";
import * as prompts from "../src/lib/ai/prompts";
import * as sanitize from "../src/lib/ai/sanitize";
import * as sentinel from "../src/lib/ai/sentinel";
import * as gemini from "../src/lib/ai/providers/gemini";
import * as groq from "../src/lib/ai/providers/groq";
import * as shared from "../src/lib/ai/providers/shared";

describe("server-only AI module imports", () => {
  it("rejects an empty question before provider configuration", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    vi.stubEnv("GROQ_API_KEY", "");
    const result = await generate({ question: "   " });
    expect(result).toMatchObject({ ok: false, error: { code: "invalid_argument" } });
    vi.unstubAllEnvs();
  });

  it("loads the complete AI library under Vitest's test-only server-only alias", () => {
    expect(ai.generate).toBeTypeOf("function");
    expect(config.readConfig).toBeTypeOf("function");
    expect(errors.publicError).toBeTypeOf("function");
    expect(limits.validateLimits).toBeTypeOf("function");
    expect(log.logAIEvent).toBeTypeOf("function");
    expect(models.GEMINI_MODEL).toBeTruthy();
    expect(orchestrator.runProviderChain).toBeTypeOf("function");
    expect(prompts.buildAIRequest).toBeTypeOf("function");
    expect(sanitize.sanitizeUserText).toBeTypeOf("function");
    expect(sentinel.AI_BUNDLE_SENTINEL).toBeTruthy();
    expect(gemini.createGeminiProvider).toBeTypeOf("function");
    expect(groq.createGroqProvider).toBeTypeOf("function");
    expect(shared.classifyHttp).toBeTypeOf("function");
  });
});

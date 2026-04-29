import { describe, it, expect, vi, afterEach } from "vitest";
import { MockZGCompute, ZGCompute } from "../compute.js";

describe("MockZGCompute", () => {
  const compute = new MockZGCompute();

  describe("inference()", () => {
    it("returns a non-empty string", async () => {
      const result = await compute.inference("What is 2+2?");
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe("scoringInference()", () => {
    it("returns { accuracy: number (0-10000), explanation: string }", async () => {
      const result = await compute.scoringInference("worker output", "ground truth");
      expect(typeof result.accuracy).toBe("number");
      expect(result.accuracy).toBeGreaterThanOrEqual(0);
      expect(result.accuracy).toBeLessThanOrEqual(10000);
      expect(typeof result.explanation).toBe("string");
      expect(result.explanation.length).toBeGreaterThan(0);
    });
  });

  describe("summarize()", () => {
    it("returns a non-empty string", async () => {
      const result = await compute.summarize("some data", "summarize briefly");
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe("factCheck()", () => {
    it("returns { verdict, confidence, reasoning } with valid verdict", async () => {
      const result = await compute.factCheck("The sky is blue", "evidence about the sky");
      expect(["true", "false", "unverifiable"]).toContain(result.verdict);
      expect(typeof result.confidence).toBe("number");
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(100);
      expect(typeof result.reasoning).toBe("string");
    });
  });
});

describe("ZGCompute error handling (fetch mocked)", () => {
  const compute = new ZGCompute("http://localhost:9001", "0xprivkey");

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("inference()", () => {
    it("throws a descriptive error when fetch returns 500", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 500,
          statusText: "Internal Server Error",
          text: async () => "something went wrong",
        })
      );

      await expect(compute.inference("test prompt")).rejects.toThrow(/0G Compute inference failed/);
      await expect(compute.inference("test prompt")).rejects.toThrow(/500/);
    });
  });

  describe("scoringInference()", () => {
    it("returns { accuracy: 5000, explanation: 'parse error' } when model returns non-JSON", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => ({
            choices: [{ message: { content: "this is not json at all" } }],
          }),
        })
      );

      const result = await compute.scoringInference("output", "truth");
      expect(result.accuracy).toBe(5000);
      expect(result.explanation).toBe("parse error");
    });
  });
});

// 0G Compute — OpenAI-compatible inference via the 0G Router.
//
// Endpoint : https://router-api.0g.ai/v1  (set via ZG_COMPUTE_ENDPOINT)
// API key  : obtained from https://pc.0g.ai after depositing 0G tokens
//            (set via ZG_COMPUTE_API_KEY — separate from your ETH private key)
//
// The router is OpenAI-compatible: POST /v1/chat/completions with
// Authorization: Bearer <api-key>.  Model names are provider-prefixed, e.g.
// "meta-llama/Meta-Llama-3.1-8B-Instruct".  Check pc.0g.ai for live models.

// Available models on 0G router — check https://router-api.0g.ai/v1/models for current list.
const DEFAULT_MODEL = "qwen/qwen-2.5-7b-instruct";
const DEFAULT_MAX_TOKENS = 1024;
const DEFAULT_TEMPERATURE = 0.1;

interface InferenceOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

interface ScoringResult {
  accuracy: number;
  explanation: string;
}

interface FactCheckResult {
  verdict: "true" | "false" | "unverifiable";
  confidence: number;
  reasoning: string;
}

export class ZGCompute {
  private readonly endpoint: string;
  // API key from pc.0g.ai — used as the Bearer token for the router.
  private readonly apiKey: string;

  constructor(endpoint: string, apiKey: string) {
    // Normalise: strip trailing slash so paths like /v1/chat/completions work.
    this.endpoint = endpoint.replace(/\/$/, "");
    this.apiKey = apiKey;
  }

  async inference(prompt: string, options?: InferenceOptions): Promise<string> {
    const model = options?.model ?? DEFAULT_MODEL;
    const maxTokens = options?.maxTokens ?? DEFAULT_MAX_TOKENS;
    const temperature = options?.temperature ?? DEFAULT_TEMPERATURE;

    // Endpoint already includes the version prefix (e.g. /v1), so just append the path.
    const response = await fetch(`${this.endpoint}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        max_tokens: maxTokens,
        temperature,
      }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(
        `0G Compute inference failed: ${response.status} ${response.statusText}${text ? ` — ${text}` : ""}`
      );
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>;
    };

    return data.choices[0].message.content;
  }

  async scoringInference(
    workerOutput: string,
    groundTruth: string
  ): Promise<ScoringResult> {
    const prompt =
      `Compare this worker output to the ground truth. ` +
      `Return JSON: { "accuracy": <0-10000>, "explanation": <string> }. ` +
      `Worker output: ${workerOutput}. Ground truth: ${groundTruth}`;

    try {
      const raw = await this.inference(prompt);
      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("no JSON object found");
      const parsed = JSON.parse(match[0]) as ScoringResult;
      return { accuracy: parsed.accuracy, explanation: parsed.explanation };
    } catch {
      return { accuracy: 5000, explanation: "parse error" };
    }
  }

  async summarize(data: string, instructions: string): Promise<string> {
    return this.inference(`${instructions}\n\nData:\n${data}`);
  }

  async factCheck(claim: string, evidence: string): Promise<FactCheckResult> {
    const prompt =
      `You are a fact-checking assistant. Evaluate the following claim against the provided evidence. ` +
      `Respond with a JSON object only: { "verdict": "true" | "false" | "unverifiable", "confidence": <0-100>, "reasoning": <string> }. ` +
      `Claim: ${claim}. Evidence: ${evidence}`;

    try {
      const raw = await this.inference(prompt);
      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("no JSON object found");
      const parsed = JSON.parse(match[0]) as FactCheckResult;
      return {
        verdict: parsed.verdict,
        confidence: parsed.confidence,
        reasoning: parsed.reasoning,
      };
    } catch {
      return {
        verdict: "unverifiable",
        confidence: 0,
        reasoning: "Failed to parse model response",
      };
    }
  }
}

export class MockZGCompute {
  async inference(_prompt: string, _options?: InferenceOptions): Promise<string> {
    return "This is a mock inference response for testing purposes.";
  }

  async scoringInference(
    _workerOutput: string,
    _groundTruth: string
  ): Promise<ScoringResult> {
    return {
      accuracy: 7500,
      explanation: "Mock scoring: worker output is largely consistent with ground truth.",
    };
  }

  async summarize(_data: string, _instructions: string): Promise<string> {
    return "Mock summary: The provided data has been summarized successfully.";
  }

  async factCheck(_claim: string, _evidence: string): Promise<FactCheckResult> {
    return {
      verdict: "unverifiable",
      confidence: 50,
      reasoning: "Mock fact-check: insufficient evidence to verify claim in test environment.",
    };
  }
}

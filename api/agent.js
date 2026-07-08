const DEFAULT_MODEL = process.env.OPENROUTER_MODEL || "tencent/hy3:free";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function buildPrompt(payload) {
  const system = [
    "You are Hy3 inside an ESP32 project builder.",
    "You must obey the deterministic hardware plan provided by the app.",
    "Never invent or change pin assignments.",
    "Be concise and beginner-friendly.",
    "Explain what changed, not a long essay.",
    "Return ONLY valid JSON with keys: code, explanation, serialLines, warnings.",
    "code must be a complete Arduino sketch as a string.",
    "explanation must be a short paragraph or two.",
    "serialLines must be an array of short plausible serial monitor lines.",
    "warnings must be an array of concise hardware caveats.",
    "Mention calibration caveats for weather pulse sensors when relevant.",
  ].join(" ");

  const user = {
    task: payload.userMessage,
    board: payload.board,
    boardLabel: payload.boardLabel,
    modules: payload.modules,
    pinAssignments: payload.pinAssignments,
    bus: payload.bus,
    deterministicWarnings: payload.warnings,
    priorChat: payload.chatHistory || [],
  };

  return {
    system,
    user: JSON.stringify(user, null, 2),
  };
}

function tryParseJson(text) {
  try {
    return JSON.parse(text);
  } catch (_) {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch (_) {
      return null;
    }
  }
}

async function callOpenRouter(payload) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return { error: "OPENROUTER_API_KEY is not configured" };
  }

  const prompt = buildPrompt(payload);
  const resp = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.OPENROUTER_SITE_URL || "https://esp32-playground.vercel.app",
      "X-Title": process.env.OPENROUTER_SITE_NAME || "ESP32 Circuit Playground",
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      temperature: 0.2,
      messages: [
        { role: "system", content: prompt.system },
        { role: "user", content: prompt.user },
      ],
      response_format: { type: "json_object" },
    }),
  });

  const text = await resp.text();
  if (!resp.ok) {
    return { error: `OpenRouter error ${resp.status}: ${text.slice(0, 400)}` };
  }

  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    return { error: `OpenRouter returned non-JSON response: ${text.slice(0, 400)}` };
  }

  const content = raw?.choices?.[0]?.message?.content;
  if (!content) {
    return { error: "OpenRouter returned no message content" };
  }

  const parsed = tryParseJson(content);
  if (!parsed) {
    return { error: `Hy3 returned invalid JSON: ${String(content).slice(0, 400)}` };
  }

  return {
    code: typeof parsed.code === "string" ? parsed.code : "",
    explanation: typeof parsed.explanation === "string" ? parsed.explanation : "",
    serialLines: Array.isArray(parsed.serialLines) ? parsed.serialLines.map(String) : [],
    warnings: Array.isArray(parsed.warnings) ? parsed.warnings.map(String) : [],
  };
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }

  if (req.method !== "POST") {
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  try {
    const payload = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    if (!payload || !payload.board || !payload.pinAssignments || !Array.isArray(payload.modules)) {
      return sendJson(res, 400, { error: "Invalid request payload" });
    }

    const result = await callOpenRouter(payload);
    if (result.error) {
      return sendJson(res, 502, { error: result.error });
    }

    return sendJson(res, 200, result);
  } catch (err) {
    return sendJson(res, 500, { error: err && err.message ? err.message : "Unknown server error" });
  }
};

const DEFAULT_MODEL = process.env.OPENROUTER_MODEL || "tencent/hy3:free";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function compactChat(history) {
  return Array.isArray(history)
    ? history.slice(-6).map((msg) => ({ role: msg.role, content: String(msg.content || "").slice(0, 300) }))
    : [];
}

function summarizeSelection(payload) {
  const modules = Array.isArray(payload.modules) ? payload.modules.join(", ") : "";
  const pinAssignments = JSON.stringify(payload.pinAssignments || {}, null, 2);
  const bus = JSON.stringify(payload.bus || {}, null, 2);
  const warnings = Array.isArray(payload.warnings) ? payload.warnings : [];

  return [
    `Board: ${payload.boardLabel || payload.board}`,
    `Modules: ${modules || "none"}`,
    `Pin assignments:`,
    pinAssignments,
    `Bus/shared resources:`,
    bus,
    `Deterministic warnings:`,
    warnings.length ? warnings.map((w) => `- ${w}`).join("\n") : "- none",
  ].join("\n");
}

function buildPrompt(payload) {
  const system = [
    "You are Hy3 inside a public ESP32 project builder demo.",
    "Your job is to adapt a complete Arduino sketch to the exact deterministic hardware plan from the app.",
    "Never invent, swap, or rename pin assignments.",
    "Use only the board, modules, buses, and warnings you are given.",
    "Be concise, helpful, and beginner-friendly.",
    "Prioritize delta-aware explanations: briefly say what you added or changed for the current hardware selection.",
    "If rain gauge or anemometer modules are present, use interrupt or pulse-counting logic and mention calibration constants briefly.",
    "Do not lecture. Avoid long essays, filler, marketing language, and generic safety disclaimers.",
    "Return ONLY valid JSON with keys: code, explanation, summary, serialLines, warnings.",
    "code: complete Arduino sketch string.",
    "explanation: 2-4 short sentences describing what changed and why.",
    "summary: one short sentence starting with a verb like Added, Updated, or Kept.",
    "serialLines: 3-8 short plausible serial monitor lines.",
    "warnings: 0-5 concise hardware caveats grounded in the provided modules.",
  ].join(" ");

  const user = {
    task: payload.userMessage,
    currentSelection: summarizeSelection(payload),
    priorChat: compactChat(payload.chatHistory),
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
      Authorization: `Bearer ${apiKey}`,
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
      ]
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
    summary: typeof parsed.summary === "string" ? parsed.summary : "",
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

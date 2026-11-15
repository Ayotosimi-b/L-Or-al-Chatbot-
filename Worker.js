// Cloudflare Worker: sits between your website and OpenAI so the API key
// is never exposed in browser code.
//
// Setup: in the Cloudflare dashboard, add a Secret named OPENAI_API_KEY
// to this Worker (Settings -> Variables and Secrets).

const MODEL = "gpt-4o-mini";
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS }
  });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }
    if (request.method !== "POST") {
      return jsonResponse({ error: "Use POST." }, 405);
    }
    if (!env.OPENAI_API_KEY) {
      return jsonResponse({ error: "Worker is missing the OPENAI_API_KEY secret." }, 500);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON." }, 400);
    }

    const messages = body && body.messages;
    const valid =
      Array.isArray(messages) &&
      messages.length > 0 &&
      messages.length <= 30 &&
      messages.every(
        (m) =>
          m &&
          ["system", "user", "assistant"].includes(m.role) &&
          typeof m.content === "string" &&
          m.content.length <= 6000
      );
    if (!valid) {
      return jsonResponse({ error: "Invalid messages." }, 400);
    }

    // Model and limits are fixed here, not taken from the browser.
    const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        max_tokens: 500,
        temperature: 0.7
      })
    });

    const data = await openaiResponse.json();
    return jsonResponse(data, openaiResponse.status);
  }
};

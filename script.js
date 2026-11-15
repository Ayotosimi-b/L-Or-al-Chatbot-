// ---- Config ----
// After you deploy worker.js to Cloudflare, paste your Worker's URL here.
// (The OpenAI API key lives ONLY inside the Worker, never in this file.)
const WORKER_URL = "https://YOUR-WORKER-NAME.YOUR-SUBDOMAIN.workers.dev";

// ---- System prompt: keeps the bot on-topic ----
const SYSTEM_PROMPT = `You are the L'Oréal Smart Routine & Product Advisor, a friendly, knowledgeable beauty assistant on L'Oréal's website.

You ONLY help with:
- L'Oréal products and brands (L'Oréal Paris, Garnier, Lancôme, Kiehl's, La Roche-Posay, CeraVe, Maybelline, Kérastase, Redken, and other L'Oréal Group brands)
- Skincare, haircare, makeup, and fragrance routines
- Product recommendations, ingredients, and how to use products
- General beauty questions that relate to choosing or using L'Oréal products

If the user asks about anything unrelated (math, coding, politics, sports, homework, general trivia, other companies' products, etc.), politely decline in one or two sentences and steer them back, for example: "I can only help with L'Oréal products and beauty routines. Is there a skin, hair, or makeup question I can help with?"

Style: warm, concise (under about 150 words unless a full routine is requested), and practical. Use short paragraphs or simple numbered steps for routines. You may use an occasional emoji. Never invent specific prices or claim a product is in stock. For medical skin conditions, suggest seeing a dermatologist. Use earlier messages in the conversation to personalize advice (skin type, concerns, preferences).`;

// ---- DOM ----
const chatWindow = document.getElementById("chatWindow");
const chatForm = document.getElementById("chatForm");
const userInput = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");
const latestQuestion = document.getElementById("latestQuestion");

// ---- LevelUp: conversation history (sent with every request) ----
const conversation = [{ role: "system", content: SYSTEM_PROMPT }];
const MAX_HISTORY_MESSAGES = 20; // keep requests small

function addBubble(text, type) {
  const bubble = document.createElement("div");
  bubble.className = `bubble ${type}`;
  bubble.textContent = text; // textContent, so model output can't inject HTML
  chatWindow.appendChild(bubble);
  chatWindow.scrollTop = chatWindow.scrollHeight;
  return bubble;
}

function trimmedMessages() {
  const system = conversation[0];
  const rest = conversation.slice(1).slice(-MAX_HISTORY_MESSAGES);
  return [system, ...rest];
}

async function askAssistant() {
  const response = await fetch(WORKER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages: trimmedMessages() })
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const detail = data.error && (data.error.message || data.error);
    throw new Error(detail || `Request failed (status ${response.status})`);
  }

  const reply = data.choices && data.choices[0] && data.choices[0].message.content;
  if (!reply) throw new Error("The assistant returned an empty response.");
  return reply.trim();
}

async function handleSubmit(event) {
  event.preventDefault();
  const text = userInput.value.trim();
  if (!text) return;

  // Show the user's message + the "latest question" strip (resets each turn)
  addBubble(text, "user");
  latestQuestion.innerHTML = "";
  const label = document.createElement("strong");
  label.textContent = "You asked: ";
  latestQuestion.appendChild(label);
  latestQuestion.appendChild(document.createTextNode(text));
  latestQuestion.hidden = false;

  conversation.push({ role: "user", content: text });
  userInput.value = "";
  userInput.disabled = true;
  sendBtn.disabled = true;

  const typing = addBubble("Thinking…", "bot typing");

  try {
    const reply = await askAssistant();
    typing.remove();
    addBubble(reply, "bot");
    conversation.push({ role: "assistant", content: reply });
  } catch (err) {
    typing.remove();
    addBubble(`Sorry, something went wrong: ${err.message}`, "error");
    conversation.pop(); // drop the unanswered question so history stays valid
  } finally {
    userInput.disabled = false;
    sendBtn.disabled = false;
    userInput.focus();
  }
}

chatForm.addEventListener("submit", handleSubmit);

// ---- Greeting ----
addBubble("Hi! I'm your L'Oréal Smart Routine & Product Advisor. Ask me about skincare, haircare, makeup, or fragrance and I'll help you build a routine. ✨", "bot");

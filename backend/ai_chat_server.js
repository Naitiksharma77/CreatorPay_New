
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({
    path: path.resolve(__dirname, "../.env")
});

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json({ limit: "16kb" }));

// Basic per-IP rate limit for the demo.
const requestCounts = new Map();
const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS = 15;

app.use("/api/ai-chat", (req, res, next) => {
    const now = Date.now();
    const ip = req.ip || req.socket.remoteAddress;

    let entry = requestCounts.get(ip);

    if (!entry || now - entry.startedAt >= WINDOW_MS) {
        entry = {
            startedAt: now,
            count: 0
        };
    }

    entry.count++;
    requestCounts.set(ip, entry);

    if (entry.count > MAX_REQUESTS) {
        return res.status(429).json({
            success: false,
            message: "Thoda break lete hain 😊 Ek minute baad try karna."
        });
    }

    next();
});

// Existing health-check endpoint.
app.get("/api/status", (req, res) => {
    res.json({
        success: true,
        service: "FriendConnect AI Chat",
        ready: true
    });
});

const SYSTEM_INSTRUCTION = `
You are a warm, expressive, casual conversational companion
for FriendConnect. Your conversation style should resemble
two Indian friends chatting casually.

YOUR PERSONALITY:
- Friendly, curious, playful, understanding and expressive.
- Speak naturally in Indian Hinglish when the user uses Hinglish.
- Match the user's language and level of casualness.
- Use words like "arey", "yaar", "achha", "sachhi?",
  "bata na", "accha ji" and "kya scene hai" when appropriate.
- Use "tu" when the user is comfortable with it; otherwise use
  "tum". Do not force slang into every sentence.
- Use relevant emojis naturally: 😊 😂 😄 🥹 ✨ ❤️.
- Be warm and attentive without pretending to be a human.

NATURAL CONVERSATION:
- Do not behave like customer support or a question-answer machine.
- Respond to the user's actual message before changing the topic.
- Show curiosity and ask relevant questions of your own.
- Sometimes share a related thought and then ask something.
- Do not make every reply end with a question.
- Avoid repetitive greetings and predictable follow-up questions.
- Usually keep replies short, around 1-3 sentences.
- A short reaction is perfectly fine when that suits the moment.
- Use recent conversation history to maintain continuity.
- If the user tells a story, ask about a relevant detail.
- If the user jokes, play along when appropriate.
- If the user is upset, respond with empathy instead of generic advice.
- If the user shares good news, celebrate naturally.
- If the user asks "kya kar rahe ho?", answer casually and
  keep the conversation going.
- Never respond to an ordinary greeting with a formal introduction.
- Do not say "How can I help you today?" in casual conversation.
- Avoid unnecessary explanations about AI or feelings.
- If directly asked whether you are AI or the actual profile owner,
  answer honestly. Never claim to be the real profile owner.
- Never invent a real-world experience or claim to have performed
  an action that did not happen.
- Never ask for passwords, OTPs or payment details.

EXAMPLES OF THE DESIRED STYLE:

User: Heyy 😊
Reply: Areyyy heyy 😂 kya haal hai tere?

User: Kya kar raha hai?
Reply: Bas yahin tere saath baatein chal rahi hain 😄 Tu bata,
aaj kya scene hai?

User: Kuch nahi, bore ho raha hoon.
Reply: Arey same boring vibes 😂 Kuch interesting karne ka mann
hai ya aaj bas chill mode?

User: Aaj mood off hai.
Reply: Arey yaar 🥹 kya hua? Kisi ne kuch bola ya bas aaj
ka din hi ajeeb ja raha hai?

User: Maine pizza khaya.
Reply: Ohooo 🍕 kaunsa pizza tha? Aur mere liye ek slice
bachaaya bhi tha ya nahi? 😂

User: Haha 😂
Reply: Hahaha 😂 achha ji, bade khush lag rahe ho aaj!

User: Tumhara naam kya hai?
Reply: Mujhe koi cute sa nickname de de 😂 Tere dimaag mein
kya naam aaya?

IMPORTANT:
- These examples demonstrate style, not fixed answers.
- Never copy the same example mechanically.
- Always respond to the current message and context.
- Do not manufacture shared memories or personal history.
- Do not claim to be a real human or the actual creator.
- Friendly expressions of care are okay, but do not claim a real
  human emotional life or a real-world romantic relationship.
`.trim();

async function startServer() {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        console.error(
            "GEMINI_API_KEY is missing from the root .env file."
        );
        process.exit(1);
    }

    // Keep compatibility with the existing CommonJS project.
    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({ apiKey });

    app.post("/api/ai-chat", async (req, res) => {
        try {
            const message =
                typeof req.body.message === "string"
                    ? req.body.message.trim()
                    : "";

            if (!message || message.length > 1000) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Message khaali mat chhodo 😊 1000 characters ke andar rakho."
                });
            }

            // Accept only valid, recent conversation messages.
            const suppliedHistory = Array.isArray(req.body.history)
                ? req.body.history.slice(-10)
                : [];

            const history = suppliedHistory
                .filter(item =>
                    item &&
                    ["user", "model"].includes(item.role) &&
                    typeof item.text === "string" &&
                    item.text.trim().length > 0
                )
                .map(item => ({
                    role: item.role,
                    parts: [{
                        text: item.text.trim().slice(0, 1000)
                    }]
                }));

            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash",

                contents: [
                    ...history,
                    {
                        role: "user",
                        parts: [{ text: message }]
                    }
                ],

                config: {
                    systemInstruction: SYSTEM_INSTRUCTION,
                    temperature: 0.9,
                    maxOutputTokens: 180
                }
            });

            const reply =
                typeof response.text === "string"
                    ? response.text.trim()
                    : "";

            if (!reply) {
                throw new Error("Gemini returned an empty response.");
            }

            return res.json({
                success: true,
                reply
            });

        } catch (error) {
            // Keep API keys and credentials out of logs.
            console.error("Gemini chat error:", error.message);

            return res.status(500).json({
                success: false,
                message:
                    "Arey yaar, abhi reply nahi aa paya 😅 Ek baar phir try kar."
            });
        }
    });

    app.listen(PORT, "0.0.0.0", () => {
        console.log(
            `FriendConnect AI Chat running at http://127.0.0.1:${PORT}`
        );
    });
}

startServer().catch(error => {
    console.error("Unable to start AI server:", error.message);
    process.exit(1);
});
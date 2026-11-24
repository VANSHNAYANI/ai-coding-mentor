require("dotenv").config();
const dns = require("dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]); // helps if your network blocks MongoDB SRV lookups
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

const app = express();
app.use(cors());
app.use(express.json({ limit: "100kb" }));



// ---------- MongoDB ----------
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((e) => console.error("MongoDB error:", e.message));

const Message = mongoose.model(
  "Message",
  new mongoose.Schema(
    {
      role: { type: String, enum: ["user", "model"], required: true },
      mode: String,
      content: { type: String, required: true },
    },
    { timestamps: true }
  )
);

// ---------- Prompts ----------
const BASE =
  "You are 'AI Coding Mentor', a friendly programming tutor for students. " +
  "Only answer programming / computer science questions; politely refuse anything else. " +
  "Use Markdown and fenced code blocks. Keep answers clear and beginner friendly.";

const MODES = {
  explain:
    BASE +
    " TASK: Explain the given code. Give: 1) one-line summary, 2) step-by-step walkthrough, 3) a small example input/output, 4) possible improvements.",
  debug:
    BASE +
    " TASK: Debug the given code or error message. Give: 1) what the error means, 2) the root cause, 3) the fixed code, 4) how to avoid it next time.",
  practice:
    BASE +
    " TASK: Generate 5 practice questions on the given topic, ordered easy to hard. Give hints for each, but do NOT give full solutions unless the user asks.",
  complexity:
    BASE +
    " TASK: Analyse the time and space complexity of the given code or algorithm. Show best/average/worst case, explain line by line why, and suggest an optimisation if one exists.",
};

// ---------- Groq call with retry ----------
async function askGroq(messages) {
  const model = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
  let lastError = "Groq API error";

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        },
        signal: AbortSignal.timeout(45000),
        body: JSON.stringify({ model, messages }),
      });
      const data = await r.json();
      if (r.ok) return data.choices?.[0]?.message?.content;

      lastError = data.error?.message || lastError;
      console.error("Groq error", r.status, lastError);
      if (![429, 500, 502, 503].includes(r.status)) break; // don't retry bad key / bad model
    } catch (e) {
      lastError = "Request timed out or network error";
      console.error("Fetch failed:", e.message);
    }
    await new Promise((res) => setTimeout(res, attempt * 1500));
  }
  throw new Error(lastError);
}

// ---------- Routes ----------
app.post("/api/chat", async (req, res) => {
  try {
    const { message, mode = "explain" } = req.body;
    if (!message || !message.trim())
      return res.status(400).json({ error: "Message is required" });
    if (!MODES[mode]) return res.status(400).json({ error: "Invalid mode" });

    const past = (await Message.find().sort({ createdAt: -1 }).limit(3)).reverse();
    const messages = [
      { role: "system", content: MODES[mode] },
      ...past.map((m) => ({
        role: m.role === "model" ? "assistant" : "user",
        content: m.content,
      })),
      { role: "user", content: message },
    ];

    const reply =
      (await askGroq(messages)) ||
      "Sorry, I couldn't generate a reply. Please try again.";

    await Message.create([
      { role: "user", mode, content: message },
      { role: "model", mode, content: reply },
    ]);
    res.json({ reply });
  } catch (e) {
    console.error(e.message);
    res.status(502).json({ error: e.message });
  }
});

app.get("/api/history", async (_req, res) => {
  res.json(await Message.find().sort({ createdAt: 1 }).limit(100));
});

app.delete("/api/history", async (_req, res) => {
  await Message.deleteMany({});
  res.json({ ok: true });
});

const path = require("path");
const dist = path.join(__dirname, "../client/dist");
app.use(express.static(dist));
app.get("*", (_req, res) => res.sendFile(path.join(dist, "index.html")));

app.listen(process.env.PORT || 5000, () =>
  console.log("Server running on port " + (process.env.PORT || 5000))
);
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const API_URL = import.meta.env.VITE_API_URL || "";

const MODES = [
  {
    id: "explain",
    icon: "{ }",
    label: "Explain Code",
    desc: "Understand any snippet, step by step",
    hint: "Paste the code you want explained...",
    samples: [
      "for(let i=0;i<5;i++){ console.log(i*i) }",
      "def fact(n):\n  return 1 if n<=1 else n*fact(n-1)\nExplain this",
      "Explain how binary search works with code in Java",
    ],
  },
  {
    id: "debug",
    icon: "!!",
    label: "Debug Error",
    desc: "Find the bug, get the fix",
    hint: "Paste your code and the error message...",
    samples: [
      "TypeError: Cannot read properties of undefined (reading 'map')",
      "for(int i=0;i<=arr.length;i++) sum+=arr[i];  // ArrayIndexOutOfBounds",
      "print('Hello world'\nSyntaxError: unexpected EOF",
    ],
  },
  {
    id: "practice",
    icon: "??",
    label: "Practice Questions",
    desc: "5 questions from easy to hard",
    hint: "Enter a topic, e.g. Arrays, Recursion, Linked List...",
    samples: ["Arrays", "Recursion", "Linked List", "Sorting algorithms"],
  },
  {
    id: "complexity",
    icon: "O(n)",
    label: "Time & Space",
    desc: "Big-O analysis explained",
    hint: "Paste code or an algorithm name...",
    samples: [
      "Bubble sort",
      "for(i=1;i<n;i*=2){ console.log(i) }",
      "Recursive vs memoized Fibonacci",
    ],
  },
];

const BAT_PATH =
  "M50 6 C46 13 42 14 38 10 C30 12 16 18 2 12 C8 22 10 30 18 34 C26 30 34 32 40 40 C44 36 47 38 50 47 C53 38 56 36 60 40 C66 32 74 30 82 34 C90 30 92 22 98 12 C84 18 70 12 62 10 C58 14 54 14 50 6 Z";

function BatDefs() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
      <defs>
        <symbol id="bat" viewBox="0 0 100 50">
          <path d={BAT_PATH} fill="currentColor" />
        </symbol>
      </defs>
    </svg>
  );
}

function Bat({ className, style }) {
  return (
    <svg className={className} style={style} viewBox="0 0 100 50" aria-hidden="true">
      <use href="#bat" />
    </svg>
  );
}

function CodeBlock({ children }) {
  const ref = useRef(null);
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(ref.current?.innerText || "");
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }
  return (
    <div className="codewrap">
      <button className="copy" onClick={copy}>{copied ? "Copied!" : "Copy"}</button>
      <pre ref={ref}>{children}</pre>
    </div>
  );
}

function Reply({ text, animate, onTick }) {
  const [n, setN] = useState(animate ? 0 : text.length);
  useEffect(() => {
    if (!animate) return;
    const id = setInterval(() => {
      setN((v) => {
        if (v >= text.length) {
          clearInterval(id);
          return v;
        }
        return Math.min(v + 12, text.length);
      });
      onTick?.();
    }, 16);
    return () => clearInterval(id);
  }, [animate, text]);
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ pre: CodeBlock }}>
      {text.slice(0, n)}
    </ReactMarkdown>
  );
}

export default function App() {
  const [mode, setMode] = useState("explain");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);
  const taRef = useRef(null);

  const scrollDown = () => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  };

  useEffect(() => {
   fetch(`${API_URL}/api/history`)
      .then((r) => r.json())
      .then((d) => setMessages(d.map((m) => ({ role: m.role, content: m.content, fresh: false }))))
      .catch(() => {});
  }, []);

  useEffect(scrollDown, [messages, loading]);

  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  }, [input]);

  async function send(textOverride) {
    const text = (textOverride ?? input).trim();
    if (!text || loading) return;
    setMessages((m) => [...m, { role: "user", content: text, fresh: false }]);
    setInput("");
    setLoading(true);
    try {
      const r = await fetch(`${API_URL}/api/chat`,  {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, mode }),
      });
      const d = await r.json();
      setMessages((m) => [
        ...m,
        { role: "model", content: d.reply || "Error: " + d.error, fresh: !!d.reply },
      ]);
    } catch {
      setMessages((m) => [
        ...m,
        { role: "model", content: "Error: could not reach server.", fresh: false },
      ]);
    }
    setLoading(false);
  }

async function clearChat() {
  await fetch(`${API_URL}/api/history`, { method: "DELETE" });
  setMessages([]);
}

  const current = MODES.find((m) => m.id === mode);

  return (
    <div className="stage">
      <BatDefs />
      <div className="bats" aria-hidden="true">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Bat key={i} className={"flybat b" + i} />
        ))}
      </div>

      <div className="app">
        <aside className="side">
          <div className="brand">
            <Bat className="logo" />
            <div>
              <h1>AI CODING MENTOR</h1>
              <span>Guardian of clean code</span>
            </div>
          </div>

          <nav className="modes">
            {MODES.map((m) => (
              <button
                key={m.id}
                className={"mode" + (m.id === mode ? " active" : "")}
                onClick={() => setMode(m.id)}
              >
                <span className="ico">{m.icon}</span>
                <span className="mtxt">
                  <b>{m.label}</b>
                  <small>{m.desc}</small>
                </span>
              </button>
            ))}
          </nav>

          <button className="clear" onClick={clearChat}>Clear chat</button>

          <div className="signal" aria-hidden="true">
            <div className="beam" />
            <Bat className="sigbat" />
          </div>
        </aside>

        <section className="chat">
          <div className="topbar">
            <span className="dot" />
            <b>{current.label}</b>
            <span className="sep">/</span>
            <span>{current.desc}</span>
          </div>

          <main>
            {messages.length === 0 && !loading && (
              <div className="empty">
                <Bat className="heroBat" />
                <h2>Gotham needs clean code.</h2>
                <p>Pick a mode, then ask. Or try a sample:</p>
                <div className="chips">
                  {current.samples.map((s) => (
                    <button key={s} className="chip" onClick={() => setInput(s)}>
                      {s.length > 48 ? s.slice(0, 48) + "..." : s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={"msg " + m.role}>
                {m.role === "model" ? (
                  <Reply text={m.content} animate={m.fresh} onTick={scrollDown} />
                ) : (
                  m.content
                )}
              </div>
            ))}

            {loading && (
              <div className="msg model thinking">
                <span className="dots"><i /><i /><i /></span>
                Analyzing the case...
              </div>
            )}
            <div ref={endRef} />
          </main>

          <footer>
            <textarea
              ref={taRef}
              value={input}
              rows={1}
              placeholder={current.hint}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
            />
            <button className="send" onClick={() => send()} disabled={loading || !input.trim()}>
              <Bat className="sendbat" />
              <span>Send</span>
            </button>
          </footer>
          <div className="tip">Enter to send · Shift+Enter for a new line</div>
        </section>
      </div>
    </div>
  );
}

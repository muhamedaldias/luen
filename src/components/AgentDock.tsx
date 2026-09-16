import { useState, useRef, useEffect } from "react";
import { Bot, X, Key, Send, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

const placeholderMessages: Message[] = [
  {
    id: "m1",
    role: "assistant",
    content: "Hi — I can help you edit this image. Try something like \"remove the background\" or \"make the sky more dramatic.\"",
    timestamp: "just now",
  },
];

interface AgentDockProps {
  collapsed?: boolean;
  onToggle?: () => void;
  hasApiKey?: boolean;
}

export default function AgentDock({ collapsed = true, onToggle, hasApiKey = false }: AgentDockProps) {
  const [messages, setMessages] = useState<Message[]>(placeholderMessages);
  const [input, setInput] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [keyEntered, setKeyEntered] = useState(hasApiKey);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  function sendMessage() {
    if (!input.trim() || !keyEntered) return;
    const userMsg: Message = {
      id: `m${Date.now()}`,
      role: "user",
      content: input.trim(),
      timestamp: "just now",
    };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setLoading(true);

    setTimeout(() => {
      setLoading(false);
      setMessages((m) => [
        ...m,
        {
          id: `m${Date.now()}`,
          role: "assistant",
          content: "Processing your request… (connect to a real model API to execute edits on the canvas).",
          timestamp: "just now",
        },
      ]);
    }, 1800);
  }

  /* ─── Collapsed toggle tab ─── */
  if (collapsed) {
    return (
      <div
        className="flex flex-col items-center justify-between py-3 transition-all duration-200"
        style={{
          width: 28,
          background: "var(--card)",
          borderLeft: "1px solid var(--border)",
        }}
      >
        <button
          onClick={onToggle}
          className="flex items-center justify-center w-6 h-6 rounded transition-colors duration-100"
          style={{ color: "var(--muted-foreground)" }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "var(--foreground)";
            e.currentTarget.style.background = "var(--secondary)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "var(--muted-foreground)";
            e.currentTarget.style.background = "transparent";
          }}
          title="Open AI Agent panel"
        >
          <ChevronLeft size={13} strokeWidth={2} />
        </button>

        {/* Rotated label */}
        <div
          className="text-xs font-medium select-none"
          style={{
            color: "var(--muted-foreground)",
            writingMode: "vertical-rl",
            transform: "rotate(180deg)",
            letterSpacing: "0.05em",
          }}
        >
          AI Agent
        </div>

        <Bot size={13} strokeWidth={1.75} style={{ color: "var(--muted-foreground)" }} />
      </div>
    );
  }

  /* ─── Expanded panel ─── */
  return (
    <div
      className="flex flex-col h-full overflow-hidden transition-all duration-200"
      style={{
        width: 280,
        background: "var(--card)",
        borderLeft: "1px solid var(--border)",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2.5 shrink-0"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <div className="flex items-center gap-2">
          <Sparkles size={14} strokeWidth={1.75} style={{ color: "var(--accent)" }} />
          <span className="text-xs font-medium" style={{ color: "var(--foreground)" }}>
            AI Agent
          </span>
          <span
            className="text-xs px-1.5 py-0.5 rounded"
            style={{
              background: "var(--secondary)",
              color: "var(--muted-foreground)",
              fontSize: 10,
            }}
          >
            Beta
          </span>
        </div>
        <button
          onClick={onToggle}
          className="flex items-center justify-center w-6 h-6 rounded transition-colors duration-100"
          style={{ color: "var(--muted-foreground)" }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "var(--foreground)";
            e.currentTarget.style.background = "var(--secondary)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "var(--muted-foreground)";
            e.currentTarget.style.background = "transparent";
          }}
        >
          <ChevronRight size={13} strokeWidth={2} />
        </button>
      </div>

      {/* API key gate */}
      {!keyEntered ? (
        <div className="flex flex-col gap-3 p-4 flex-1">
          <div
            className="flex items-start gap-2.5 p-3 rounded-lg"
            style={{ background: "var(--secondary)", border: "1px solid var(--border)" }}
          >
            <Key size={14} strokeWidth={1.75} style={{ color: "var(--accent)", marginTop: 1, flexShrink: 0 }} />
            <p className="text-xs leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
              Enter your API key to enable natural-language edits. Your key stays in this browser session only.
            </p>
          </div>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-…"
            className="w-full h-8 px-3 rounded text-xs outline-none"
            style={{
              background: "var(--secondary)",
              border: "1px solid var(--border)",
              color: "var(--foreground)",
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = "var(--ring)")}
            onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
            onKeyDown={(e) => e.key === "Enter" && apiKey.length > 10 && setKeyEntered(true)}
          />
          <button
            disabled={apiKey.length < 10}
            onClick={() => setKeyEntered(true)}
            className="h-8 rounded text-xs font-medium transition-colors duration-100"
            style={{
              background: apiKey.length >= 10 ? "var(--primary)" : "var(--secondary)",
              color: apiKey.length >= 10 ? "var(--primary-foreground)" : "var(--muted-foreground)",
              cursor: apiKey.length < 10 ? "not-allowed" : "pointer",
            }}
          >
            Connect
          </button>
        </div>
      ) : (
        <>
          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-3 min-h-0">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className="max-w-[85%] rounded-lg px-3 py-2"
                  style={{
                    background: msg.role === "user" ? "var(--primary)" : "var(--secondary)",
                    color: msg.role === "user" ? "var(--primary-foreground)" : "var(--foreground)",
                    border: msg.role === "assistant" ? "1px solid var(--border)" : "none",
                  }}
                >
                  <p className="text-xs leading-relaxed">{msg.content}</p>
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div
                  className="flex items-center gap-1 px-3 py-2 rounded-lg"
                  style={{ background: "var(--secondary)", border: "1px solid var(--border)" }}
                >
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="w-1 h-1 rounded-full"
                      style={{
                        background: "var(--muted-foreground)",
                        animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div
            className="shrink-0 px-3 pb-3 pt-2"
            style={{ borderTop: "1px solid var(--border)" }}
          >
            <div
              className="flex items-end gap-2 rounded-lg"
              style={{
                background: "var(--secondary)",
                border: "1px solid var(--border)",
                padding: "6px 8px",
              }}
            >
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder="Describe an edit…"
                rows={2}
                className="flex-1 bg-transparent outline-none resize-none text-xs leading-relaxed"
                style={{ color: "var(--foreground)", maxHeight: 80 }}
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || loading}
                className="flex items-center justify-center w-7 h-7 rounded transition-colors duration-100 shrink-0"
                style={{
                  background: input.trim() ? "var(--primary)" : "var(--muted)",
                  color: input.trim() ? "var(--primary-foreground)" : "var(--muted-foreground)",
                  cursor: !input.trim() || loading ? "not-allowed" : "pointer",
                  opacity: !input.trim() ? 0.5 : 1,
                }}
              >
                <Send size={12} strokeWidth={2} />
              </button>
            </div>
            <p className="text-xs mt-1.5 text-center" style={{ color: "var(--muted-foreground)", opacity: 0.5, fontSize: 10 }}>
              Shift+Enter for newline · Enter to send
            </p>
          </div>
        </>
      )}
    </div>
  );
}

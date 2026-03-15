import React, { useEffect, useMemo, useRef, useState } from "react";

const defaultApi = "https://luauai-api.onrender.com/api/chat";
const STORAGE_KEY = "luau-ai-state-v3";

function extractCodeBlocks(text) {
  if (!text) return [];
  const matches = [...String(text).matchAll(/```(?:\w+)?\n([\s\S]*?)```/g)];
  return matches.map((m) => m[1].trim()).filter(Boolean);
}

function App() {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "Fala. Eu já tô pronto para Lua/Luau, revisão de código, arquitetura e leitura de imagem via Gemini.",
    },
  ]);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [copyOk, setCopyOk] = useState(false);
  const [downloadOk, setDownloadOk] = useState(false);
  const [expandedCode, setExpandedCode] = useState(false);

  const [settings, setSettings] = useState({
    apiUrl: defaultApi,
    token: "",
    model: "gemini-2.5-flash",
    systemPrompt:
      "Você é uma IA especialista em Lua, Luau, Roblox e programação legítima. Responda em português, seja objetiva, gere código limpo e bem formatado, explique quando necessário, e nunca ajude com exploits, bypasses ou ações maliciosas.",
  });

  const fileInputRef = useRef(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed.messages) setMessages(parsed.messages);
      if (parsed.settings) {
        setSettings((prev) => ({
          ...prev,
          ...parsed.settings,
          apiUrl: parsed.settings.apiUrl || defaultApi,
        }));
      }
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          messages,
          settings,
        })
      );
    } catch {}
  }, [messages, settings]);

  const detectedCode = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "assistant") {
        const blocks = extractCodeBlocks(messages[i].content);
        if (blocks.length) return blocks.join("\n\n--[[ próximo bloco ]]--\n\n");
      }
    }
    return `-- Exemplo Luau
local Players = game:GetService("Players")

local function onPlayerAdded(player)
    print("Jogador entrou:", player.Name)
end

Players.PlayerAdded:Connect(onPlayerAdded)`;
  }, [messages]);

  const isCodeLong = detectedCode.split("\n").length > 18 || detectedCode.length > 700;

  function updateSetting(key, value) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  function onChooseImage(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedImage(file);

    const reader = new FileReader();
    reader.onload = () => {
      setImagePreview(String(reader.result || ""));
    };
    reader.readAsDataURL(file);
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(detectedCode);
      setCopyOk(true);
      setTimeout(() => setCopyOk(false), 1400);
    } catch {}
  }

  function downloadCode() {
    try {
      const blob = new Blob([detectedCode], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "codigo-luau.txt";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setDownloadOk(true);
      setTimeout(() => setDownloadOk(false), 1400);
    } catch {}
  }

  async function sendMessage() {
    if (!input.trim() && !selectedImage) return;
    if (!settings.apiUrl.trim()) return;

    const nextMessages = [
      ...messages,
      {
        role: "user",
        content: input.trim() || "Analise a imagem enviada.",
        image: imagePreview || null,
      },
    ];

    setMessages(nextMessages);
    setLoading(true);

    try {
      const res = await fetch(settings.apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(settings.token.trim()
            ? { Authorization: `Bearer ${settings.token.trim()}` }
            : {}),
        },
        body: JSON.stringify({
          system: settings.systemPrompt,
          model: settings.model,
          messages: nextMessages.map((m) => ({
            role: m.role,
            content: m.content,
            image: m.image || null,
          })),
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error || data?.message || "Falha na API");
      }

      const assistantText =
        data.response ||
        data.output ||
        data.message ||
        data.content ||
        data?.choices?.[0]?.message?.content ||
        "Sem resposta de texto.";

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: String(assistantText),
        },
      ]);

      setInput("");
      setSelectedImage(null);
      setImagePreview("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Não consegui falar com a API. Detalhe: ${
            err?.message || "Failed to fetch"
          }`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.bgGlowA} />
      <div style={styles.bgGlowB} />

      <div style={styles.container}>
        <section style={styles.topCard}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Peça código, análise, explicação, revisão ou mande uma imagem com contexto."
            style={styles.promptInput}
          />

          {imagePreview ? (
            <div style={styles.previewWrap}>
              <img src={imagePreview} alt="preview" style={styles.previewImage} />
              <button
                style={styles.smallGhostBtn}
                onClick={() => {
                  setSelectedImage(null);
                  setImagePreview("");
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
              >
                Remover imagem
              </button>
            </div>
          ) : null}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={onChooseImage}
            style={{ display: "none" }}
          />

          <button style={styles.secondaryBtn} onClick={() => fileInputRef.current?.click()}>
            Enviar imagem
          </button>

          <button style={styles.primaryBtn} onClick={sendMessage} disabled={loading}>
            {loading ? "Enviando..." : "Enviar"}
          </button>
        </section>

        <section style={styles.codeSection}>
          <div style={styles.sectionHeader}>
            <div>
              <div style={styles.sectionTitle}>Saída de código</div>
              <div style={styles.sectionSubtitle}>
                Blocos detectados na resposta aparecem aqui.
              </div>
            </div>

            <div style={styles.codeActions}>
              <button
                style={styles.iconBtn}
                onClick={copyCode}
                title="Copiar código"
                aria-label="Copiar código"
              >
                <span style={styles.copyIcon}>
                  <span style={styles.copyBack} />
                  <span style={styles.copyFront} />
                </span>
              </button>

              <button
                style={styles.iconBtn}
                onClick={downloadCode}
                title="Baixar código"
                aria-label="Baixar código"
              >
                <span style={styles.downloadIcon}>
                  <span style={styles.downloadArrow} />
                  <span style={styles.downloadBase} />
                </span>
              </button>

              {isCodeLong ? (
                <button style={styles.expandBtn} onClick={() => setExpandedCode(true)}>
                  Maximizar
                </button>
              ) : null}
            </div>
          </div>

          {copyOk ? <div style={styles.toast}>Código copiado</div> : null}
          {downloadOk ? <div style={styles.toast}>Download iniciado</div> : null}

          <div style={styles.codeOuter}>
            <pre style={styles.codeBlock}>
              <code>{detectedCode}</code>
            </pre>
          </div>
        </section>

        <section style={styles.infoCard}>
          <div style={styles.brandRow}>
            <div style={styles.logoBox}>L</div>
            <div>
              <div style={styles.brandMini}>AXIOLA LABS</div>
              <div style={styles.brandTitle}>Luau AI</div>
              <div style={styles.brandSub}>
                Visual de app, histórico salvo e leitura de imagem.
              </div>
            </div>
          </div>

          <div style={styles.formCard}>
            <div style={styles.label}>Conexão</div>

            <div style={styles.fieldLabel}>Endpoint</div>
            <input
              value={settings.apiUrl}
              onChange={(e) => updateSetting("apiUrl", e.target.value)}
              placeholder="https://luauai-api.onrender.com/api/chat"
              style={styles.input}
            />

            <div style={styles.fieldLabel}>Token</div>
            <input
              value={settings.token}
              onChange={(e) => updateSetting("token", e.target.value)}
              placeholder="Vazio no backend online"
              style={styles.input}
            />

            <div style={styles.fieldLabel}>Modelo</div>
            <input
              value={settings.model}
              onChange={(e) => updateSetting("model", e.target.value)}
              style={styles.input}
            />

            <div style={styles.fieldLabel}>System prompt</div>
            <textarea
              value={settings.systemPrompt}
              onChange={(e) => updateSetting("systemPrompt", e.target.value)}
              style={styles.systemPrompt}
            />
          </div>
        </section>

        <section style={styles.chatSection}>
          {messages.map((msg, i) => (
            <div
              key={i}
              style={{
                ...styles.message,
                ...(msg.role === "assistant" ? styles.assistantBubble : styles.userBubble),
              }}
            >
              <div style={styles.roleText}>{msg.role}</div>
              <div style={styles.messageText}>{msg.content}</div>
              {msg.image ? <img src={msg.image} alt="upload" style={styles.messageImage} /> : null}
            </div>
          ))}
        </section>
      </div>

      {expandedCode ? (
        <div style={styles.modalOverlay} onClick={() => setExpandedCode(false)}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div style={styles.modalTitle}>Código completo</div>
              <div style={styles.codeActions}>
                <button style={styles.iconBtn} onClick={copyCode} aria-label="Copiar código">
                  <span style={styles.copyIcon}>
                    <span style={styles.copyBack} />
                    <span style={styles.copyFront} />
                  </span>
                </button>
                <button style={styles.iconBtn} onClick={downloadCode} aria-label="Baixar código">
                  <span style={styles.downloadIcon}>
                    <span style={styles.downloadArrow} />
                    <span style={styles.downloadBase} />
                  </span>
                </button>
                <button style={styles.expandBtn} onClick={() => setExpandedCode(false)}>
                  Fechar
                </button>
              </div>
            </div>

            <pre style={styles.modalCodeBlock}>
              <code>{detectedCode}</code>
            </pre>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background:
      "radial-gradient(circle at top left, rgba(14,95,170,0.25), transparent 28%), linear-gradient(180deg, #03111f 0%, #020915 100%)",
    color: "#eaf4ff",
    fontFamily: "Inter, Arial, sans-serif",
    padding: "18px 14px 40px",
  },

  bgGlowA: {
    position: "fixed",
    top: 0,
    left: 0,
    width: 220,
    height: 220,
    background: "rgba(0,180,255,0.10)",
    filter: "blur(70px)",
    borderRadius: 999,
    pointerEvents: "none",
  },

  bgGlowB: {
    position: "fixed",
    bottom: 0,
    right: 0,
    width: 220,
    height: 220,
    background: "rgba(0,255,170,0.10)",
    filter: "blur(80px)",
    borderRadius: 999,
    pointerEvents: "none",
  },

  container: {
    maxWidth: 900,
    margin: "0 auto",
    position: "relative",
    zIndex: 1,
  },

  topCard: {
    background: "rgba(11,20,40,0.78)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 26,
    padding: 18,
    boxShadow: "0 10px 35px rgba(0,0,0,0.28)",
    backdropFilter: "blur(10px)",
  },

  promptInput: {
    width: "100%",
    minHeight: 120,
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.08)",
    color: "#eaf4ff",
    borderRadius: 20,
    padding: 16,
    boxSizing: "border-box",
    fontSize: 16,
    resize: "vertical",
    outline: "none",
    marginBottom: 14,
  },

  previewWrap: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    marginBottom: 12,
  },

  previewImage: {
    width: "100%",
    maxHeight: 240,
    objectFit: "cover",
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.08)",
  },

  secondaryBtn: {
    width: "100%",
    marginBottom: 12,
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
    color: "#f4f8ff",
    padding: "15px 16px",
    fontSize: 16,
  },

  primaryBtn: {
    width: "100%",
    borderRadius: 18,
    border: "none",
    background: "linear-gradient(90deg, #29d48c, #3f8dff)",
    color: "#04111d",
    fontWeight: 800,
    padding: "15px 16px",
    fontSize: 17,
  },

  smallGhostBtn: {
    alignSelf: "flex-start",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
    color: "#f4f8ff",
    padding: "10px 12px",
  },

  codeSection: {
    marginTop: 22,
    background: "rgba(5,15,35,0.86)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 26,
    padding: 18,
  },

  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 14,
  },

  sectionTitle: {
    fontSize: 28,
    fontWeight: 800,
    lineHeight: 1.05,
  },

  sectionSubtitle: {
    fontSize: 14,
    color: "#a8bdd4",
    marginTop: 6,
  },

  codeActions: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexShrink: 0,
  },

  iconBtn: {
    width: 50,
    height: 50,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.04)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },

  copyIcon: {
    position: "relative",
    width: 20,
    height: 20,
    display: "inline-block",
  },

  copyBack: {
    position: "absolute",
    width: 12,
    height: 12,
    border: "2px solid #8ea7c0",
    borderRadius: 4,
    top: 1,
    left: 1,
  },

  copyFront: {
    position: "absolute",
    width: 12,
    height: 12,
    border: "2px solid #ffffff",
    borderRadius: 4,
    top: 6,
    left: 6,
  },

  downloadIcon: {
    position: "relative",
    width: 18,
    height: 20,
    display: "inline-block",
  },

  downloadArrow: {
    position: "absolute",
    left: 7,
    top: 1,
    width: 2,
    height: 10,
    background: "#ffffff",
    boxShadow: "0 0 0 1px rgba(255,255,255,0.02)",
  },

  downloadBase: {
    position: "absolute",
    left: 3,
    bottom: 2,
    width: 12,
    height: 2,
    background: "#ffffff",
    boxShadow: "0 -6px 0 0 transparent",
    borderRadius: 2,
  },

  expandBtn: {
    height: 50,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.04)",
    color: "#f4f8ff",
    padding: "0 16px",
    fontWeight: 700,
  },

  toast: {
    marginBottom: 12,
    fontSize: 13,
    color: "#9ee5c8",
  },

  codeOuter: {
    width: "100%",
    overflowX: "auto",
    WebkitOverflowScrolling: "touch",
    borderRadius: 22,
    background: "#020814",
    border: "1px solid rgba(255,255,255,0.05)",
  },

  codeBlock: {
    margin: 0,
    minWidth: "100%",
    width: "max-content",
    maxWidth: "none",
    padding: 18,
    fontSize: 15,
    lineHeight: 1.65,
    color: "#eaf4ff",
    whiteSpace: "pre",
    overflowX: "visible",
    boxSizing: "border-box",
  },

  infoCard: {
    marginTop: 22,
    background: "rgba(8,18,37,0.82)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 26,
    padding: 18,
  },

  brandRow: {
    display: "flex",
    gap: 14,
    alignItems: "center",
    marginBottom: 20,
  },

  logoBox: {
    width: 64,
    height: 64,
    borderRadius: 20,
    background: "linear-gradient(135deg, #3bffd5, #5aa9ff)",
    color: "#04111d",
    fontWeight: 900,
    fontSize: 28,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 0 30px rgba(59,255,213,0.18)",
  },

  brandMini: {
    fontSize: 13,
    letterSpacing: "0.22em",
    color: "#9be6d0",
  },

  brandTitle: {
    fontSize: 28,
    fontWeight: 800,
    marginTop: 2,
  },

  brandSub: {
    color: "#a8bdd4",
    marginTop: 4,
  },

  formCard: {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: 22,
    padding: 16,
  },

  label: {
    fontWeight: 800,
    marginBottom: 10,
    fontSize: 22,
  },

  fieldLabel: {
    fontSize: 14,
    color: "#c8d8ea",
    marginBottom: 8,
    marginTop: 12,
  },

  input: {
    width: "100%",
    height: 54,
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
    color: "#f5f9ff",
    padding: "0 14px",
    boxSizing: "border-box",
    fontSize: 16,
    outline: "none",
  },

  systemPrompt: {
    width: "100%",
    minHeight: 120,
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
    color: "#f5f9ff",
    padding: 14,
    boxSizing: "border-box",
    fontSize: 15,
    outline: "none",
    resize: "vertical",
  },

  chatSection: {
    marginTop: 22,
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },

  message: {
    borderRadius: 20,
    padding: 14,
    border: "1px solid rgba(255,255,255,0.08)",
  },

  assistantBubble: {
    background: "rgba(255,255,255,0.03)",
  },

  userBubble: {
    background: "rgba(41,212,140,0.10)",
  },

  roleText: {
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: "0.12em",
    color: "#91a7be",
    marginBottom: 8,
  },

  messageText: {
    lineHeight: 1.6,
    whiteSpace: "pre-wrap",
  },

  messageImage: {
    width: "100%",
    maxHeight: 260,
    objectFit: "cover",
    borderRadius: 14,
    marginTop: 12,
  },

  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.78)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    zIndex: 9999,
  },

  modalCard: {
    width: "100%",
    height: "92vh",
    maxWidth: 1100,
    background: "#04101f",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 24,
    padding: 16,
    display: "flex",
    flexDirection: "column",
    boxSizing: "border-box",
  },

  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
  },

  modalTitle: {
    fontSize: 24,
    fontWeight: 800,
  },

  modalCodeBlock: {
    flex: 1,
    margin: 0,
    width: "100%",
    overflow: "auto",
    background: "#020814",
    borderRadius: 20,
    border: "1px solid rgba(255,255,255,0.06)",
    padding: 18,
    boxSizing: "border-box",
    fontSize: 15,
    lineHeight: 1.65,
    whiteSpace: "pre",
    color: "#eaf4ff",
  },
};

export default App;

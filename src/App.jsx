import { useEffect, useMemo, useRef, useState } from 'react';

const STORAGE_KEY = 'luau-ai-history-v2';
const SETTINGS_KEY = 'luau-ai-settings-v2';

const starterPrompts = [
  'Crie um sistema modular em Luau com boas práticas e comentários úteis.',
  'Explique este erro em Luau e diga como corrigir sem enrolação.',
  'Monte uma arquitetura de pastas para Roblox com ModuleScripts, Remotes e Services.',
  'Analise esse script e reescreva de forma mais segura e performática.'
];

const defaultPrompt =
  'Você é uma IA especialista em Lua, Luau, Roblox Studio e programação legítima. Responda em português do Brasil, seja claro, técnico quando necessário, gere código limpo, modular e comentado, e recuse pedidos de exploits, bypasses ou scripts maliciosos.';

const defaultApi = 'http://localhost:3000/api/chat';

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function extractCodeBlocks(text) {
  const match = String(text || '').match(/```(?:lua|luau|js|javascript|ts|tsx|json)?\n([\s\S]*?)```/i);
  return match?.[1]?.trim() || '';
}

export default function App() {
  const fileInputRef = useRef(null);
  const chatEndRef = useRef(null);

  const [messages, setMessages] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return [
      {
        id: uid(),
        role: 'assistant',
        content: 'Fala. Eu já tô pronto para Lua/Luau, revisão de código, arquitetura e leitura de imagem via Gemini.',
        createdAt: Date.now(),
      },
    ];
  });

  const [settings, setSettings] = useState(() => {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return {
      apiUrl: defaultApi,
      apiKey: '',
      systemPrompt: defaultPrompt,
      model: 'gemini-2.5-flash',
    };
  });

  const [input, setInput] = useState('');
  const [pendingImage, setPendingImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('Pronto.');
  const [codeCopied, setCodeCopied] = useState(false);
  const [isCodeExpanded, setIsCodeExpanded] = useState(false);
  const [code, setCode] = useState(`-- Exemplo Luau\nlocal Players = game:GetService("Players")\n\nlocal function onPlayerAdded(player)\n    print("Jogador entrou:", player.Name)\nend\n\nPlayers.PlayerAdded:Connect(onPlayerAdded)`);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const canSend = useMemo(() => {
    return Boolean(settings.apiUrl.trim()) && (Boolean(input.trim()) || Boolean(pendingImage)) && !loading;
  }, [settings.apiUrl, input, pendingImage, loading]);

  const showExpandCode = useMemo(() => {
    return code.length > 420 || code.split('\n').length > 14;
  }, [code]);

  function updateSetting(key, value) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  function usePrompt(prompt) {
    setInput(prompt);
    setStatus('Prompt aplicado.');
  }

  async function handlePickImage(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setStatus('Escolha uma imagem válida.');
      return;
    }
    const dataUrl = await fileToDataUrl(file);
    setPendingImage({
      name: file.name,
      mimeType: file.type,
      dataUrl,
    });
    setStatus('Imagem anexada.');
    event.target.value = '';
  }

  function clearImage() {
    setPendingImage(null);
  }

  function clearHistory() {
    const initial = [
      {
        id: uid(),
        role: 'assistant',
        content: 'Histórico limpo. Pode começar outra conversa.',
        createdAt: Date.now(),
      },
    ];
    setMessages(initial);
    setCode(`-- Exemplo Luau\nprint("Histórico limpo")`);
    setStatus('Histórico apagado.');
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
      setCodeCopied(true);
      setStatus('Código copiado.');
      setTimeout(() => setCodeCopied(false), 1200);
    } catch {
      setStatus('Não consegui copiar o código.');
    }
  }

  async function sendMessage() {
    if (!canSend) return;

    const userMessage = {
      id: uid(),
      role: 'user',
      content: input.trim() || (pendingImage ? 'Analise esta imagem.' : ''),
      image: pendingImage,
      createdAt: Date.now(),
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setPendingImage(null);
    setLoading(true);
    setStatus('Consultando backend...');

    try {
      const response = await fetch(settings.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(settings.apiKey.trim() ? { Authorization: `Bearer ${settings.apiKey.trim()}` } : {}),
        },
        body: JSON.stringify({
          system: settings.systemPrompt,
          model: settings.model,
          messages: newMessages.map((msg) => ({
            role: msg.role,
            content: msg.content,
            image: msg.image || null,
          })),
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || data?.response || `Erro HTTP ${response.status}`);
      }

      const assistantText =
        data.response ||
        data.output ||
        data.message ||
        data.content ||
        data?.choices?.[0]?.message?.content ||
        'A API respondeu, mas sem um campo de texto reconhecido.';

      const codeBlock = extractCodeBlocks(assistantText);
      if (codeBlock) setCode(codeBlock);

      setMessages((prev) => [
        ...prev,
        {
          id: uid(),
          role: 'assistant',
          content: assistantText,
          createdAt: Date.now(),
        },
      ]);
      setStatus('Resposta recebida.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro inesperado.';
      setMessages((prev) => [
        ...prev,
        {
          id: uid(),
          role: 'assistant',
          content: `Não consegui falar com a API. Detalhe: ${message}`,
          createdAt: Date.now(),
        },
      ]);
      setStatus(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="app-shell">
        <div className="aurora aurora-a" />
        <div className="aurora aurora-b" />

        <aside className="sidebar glass">
          <div className="brand-box">
            <div className="brand-icon">L</div>
            <div>
              <div className="eyebrow">AXIOLA LABS</div>
              <h1>Luau AI</h1>
              <p>Visual de app, histórico salvo e leitura de imagem.</p>
            </div>
          </div>

          <div className="section-block">
            <div className="section-title">Conexão</div>
            <label>Endpoint</label>
            <input value={settings.apiUrl} onChange={(e) => updateSetting('apiUrl', e.target.value)} placeholder="http://localhost:3000/api/chat" />

            <label>Token</label>
            <input value={settings.apiKey} onChange={(e) => updateSetting('apiKey', e.target.value)} placeholder="Vazio no backend local" type="password" />

            <label>Modelo</label>
            <input value={settings.model} onChange={(e) => updateSetting('model', e.target.value)} placeholder="gemini-2.5-flash" />

            <label>System prompt</label>
            <textarea value={settings.systemPrompt} onChange={(e) => updateSetting('systemPrompt', e.target.value)} />
          </div>

          <div className="section-block">
            <div className="section-title">Ações</div>
            <div className="quick-grid">
              {starterPrompts.map((prompt) => (
                <button key={prompt} className="soft-btn" onClick={() => usePrompt(prompt)}>
                  {prompt}
                </button>
              ))}
            </div>
          </div>

          <div className="section-block section-row">
            <button className="ghost-btn" onClick={clearHistory}>Limpar histórico</button>
            <button className="ghost-btn" onClick={copyCode}>{codeCopied ? 'Copiado' : 'Copiar código'}</button>
          </div>
        </aside>

        <main className="main-panel">
          <section className="hero glass">
            <div>
              <div className="eyebrow">MULTIMODAL • LOCAL • GEMINI</div>
              <h2>Seu app de IA para Lua/Luau</h2>
              <p>
                Conversa salva, visual mais bonito, anexos de imagem, leitura de prints e foco em programação legítima.
              </p>
            </div>
            <div className="hero-stats">
              <div className="stat-card">
                <span>Mensagens</span>
                <strong>{messages.length}</strong>
              </div>
              <div className="stat-card">
                <span>Status</span>
                <strong>{loading ? 'Pensando' : 'Online'}</strong>
              </div>
            </div>
          </section>

          <section className="content-grid">
            <div className="chat-panel glass">
              <div className="panel-head">
                <div>
                  <div className="panel-title">Chat</div>
                  <div className="panel-subtitle">{status}</div>
                </div>
                <div className="status-dot-wrap">
                  <span className={`status-dot ${loading ? 'busy' : 'ok'}`} />
                </div>
              </div>

              <div className="chat-feed">
                {messages.map((msg) => (
                  <div key={msg.id} className={`bubble ${msg.role === 'user' ? 'bubble-user' : 'bubble-assistant'}`}>
                    <div className="bubble-meta">{msg.role}</div>
                    <div className="bubble-text">{msg.content}</div>
                    {msg.image?.dataUrl && (
                      <img className="chat-image" src={msg.image.dataUrl} alt={msg.image.name || 'imagem enviada'} />
                    )}
                  </div>
                ))}
                {loading && <div className="bubble bubble-assistant"><div className="bubble-meta">assistant</div><div className="bubble-text">Gerando resposta...</div></div>}
                <div ref={chatEndRef} />
              </div>

              {pendingImage && (
                <div className="attachment-box">
                  <img src={pendingImage.dataUrl} alt={pendingImage.name} />
                  <div className="attachment-info">
                    <strong>{pendingImage.name}</strong>
                    <span>{pendingImage.mimeType}</span>
                  </div>
                  <button className="ghost-btn" onClick={clearImage}>Remover</button>
                </div>
              )}

              <div className="composer">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Peça código, análise, explicação, revisão ou mande uma imagem com contexto."
                />
                <div className="composer-actions">
                  <button className="ghost-btn" onClick={() => fileInputRef.current?.click()}>Enviar imagem</button>
                  <button className="send-btn" onClick={sendMessage} disabled={!canSend}>Enviar</button>
                </div>
                <input ref={fileInputRef} hidden type="file" accept="image/*" onChange={handlePickImage} />
              </div>
            </div>

            <div className="code-panel glass">
              <div className="panel-head panel-head-code">
                <div>
                  <div className="panel-title">Saída de código</div>
                  <div className="panel-subtitle">Blocos detectados na resposta aparecem aqui.</div>
                </div>

                <div className="code-actions">
                  <button className="icon-btn" onClick={copyCode} title="Copiar código" aria-label="Copiar código">
                    <span className="copy-icon" aria-hidden="true">
                      <span className="copy-square copy-square-back" />
                      <span className="copy-square copy-square-front" />
                    </span>
                  </button>

                  {showExpandCode && (
                    <button className="ghost-btn code-expand-btn" onClick={() => setIsCodeExpanded(true)}>
                      Maximizar
                    </button>
                  )}
                </div>
              </div>

              <pre className="code-block"><code>{code}</code></pre>
            </div>
          </section>
        </main>
      </div>

      {isCodeExpanded && (
        <div className="code-modal-overlay" onClick={() => setIsCodeExpanded(false)}>
          <div className="code-modal glass" onClick={(e) => e.stopPropagation()}>
            <div className="panel-head panel-head-code modal-head">
              <div>
                <div className="panel-title">Código completo</div>
                <div className="panel-subtitle">Visualização expandida para ler o código inteiro.</div>
              </div>

              <div className="code-actions">
                <button className="icon-btn" onClick={copyCode} title="Copiar código" aria-label="Copiar código">
                  <span className="copy-icon" aria-hidden="true">
                    <span className="copy-square copy-square-back" />
                    <span className="copy-square copy-square-front" />
                  </span>
                </button>
                <button className="ghost-btn code-expand-btn" onClick={() => setIsCodeExpanded(false)}>
                  Fechar
                </button>
              </div>
            </div>

            <pre className="code-block code-block-expanded"><code>{code}</code></pre>
          </div>
        </div>
      )}
    </>
  );
}

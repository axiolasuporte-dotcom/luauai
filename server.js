import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

app.use(cors());
app.use(express.json({ limit: '12mb' }));

app.get('/', (_, res) => {
  res.json({ ok: true, message: 'Backend Gemini online.' });
});

function normalizeHistory(messages = []) {
  const chunks = [];

  for (const msg of messages) {
    const role = msg.role === 'assistant' ? 'Assistant' : 'User';
    if (msg.content) {
      chunks.push(`${role}: ${String(msg.content)}`);
    }
    if (msg.image?.dataUrl && msg.image?.mimeType) {
      chunks.push(`${role} enviou uma imagem (${msg.image.mimeType}).`);
    }
  }

  return chunks.join('\n\n');
}

function buildParts(lastMessage) {
  const parts = [];

  if (lastMessage?.content) {
    parts.push({ text: String(lastMessage.content) });
  }

  if (lastMessage?.image?.dataUrl && lastMessage?.image?.mimeType) {
    const [, base64] = String(lastMessage.image.dataUrl).split(',');
    if (base64) {
      parts.push({
        inlineData: {
          mimeType: lastMessage.image.mimeType,
          data: base64,
        },
      });
    }
  }

  if (parts.length === 0) {
    parts.push({ text: 'Analise esta solicitação.' });
  }

  return parts;
}

app.post('/api/chat', async (req, res) => {
  try {
    const { system, messages, model } = req.body;
    const safeMessages = Array.isArray(messages) ? messages : [];
    const lastMessage = safeMessages[safeMessages.length - 1] || null;
    const history = normalizeHistory(safeMessages.slice(0, -1));

    const instructionText = `${
      typeof system === 'string' && system.trim()
        ? system
        : 'Você é uma IA especialista em Lua e Luau. Responda em português.'
    }\n\nContexto anterior da conversa:\n${history || 'Sem histórico anterior.'}`;

    const response = await ai.models.generateContent({
      model: typeof model === 'string' && model.trim() ? model : 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: buildParts(lastMessage) }],
      config: {
        systemInstruction: instructionText,
      },
    });

    const text = response.text || 'Sem texto na resposta.';
    res.json({ response: text });
  } catch (error) {
    console.error('Erro no backend completo:', error);
    res.status(500).json({
      response: 'Erro ao consultar o Gemini.',
      error: error?.message || 'Erro desconhecido.',
    });
  }
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Servidor rodando em http://0.0.0.0:${port}`);
});

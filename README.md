# Luau AI App

Projeto Vite + React com visual de app, histórico salvo no navegador, envio de imagem e backend Gemini.

## Rodar no Termux

```bash
cd ~/luau-ai-app
npm install
cp .env.example .env
# edite .env e cole sua GEMINI_API_KEY
npm install express cors dotenv @google/genai
```

Terminal 1:
```bash
node server.js
```

Terminal 2:
```bash
npm run dev -- --host
```

Abra no navegador:
- Frontend: `http://localhost:5173`
- Endpoint no app: `http://localhost:3000/api/chat`

## Gerar APK com Capacitor

```bash
npm install
npm run build
npx cap init LuauAI com.axiola.luauai --web-dir=dist
npx cap add android
npx cap sync android
npx cap open android
```

Depois disso, no Android Studio, gere o APK em `Build > Build APK(s)`.

## Recursos

- histórico salvo em `localStorage`
- tema visual mais bonito
- envio de imagem com preview
- leitura de imagem pelo backend Gemini
- extração de código para painel lateral

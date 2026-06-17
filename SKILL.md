# Thai Language Chatbot Skill

## Overview

The VideoCall AI assistant is a Thai-first conversational chatbot powered by **Groq + Llama 3.3 70B** (default). It is designed for natural Thai-language dialogue with speech recognition, AI response, and text-to-speech output all tuned for Thai.

---

## Default Provider

| Setting | Value |
|---------|-------|
| Provider | Groq |
| Model | `llama-3.3-70b-versatile` |
| Language | Thai (ภาษาไทย) first |

The provider is locked to Groq+Llama on first visit. Users can change it in **Settings** (⚙️) after that.

---

## System Prompt (Default)

```
You are a male Thai robot. You mainly speak Thai as your native language. You can move your face left-right, move both eyes, and open/close your mouth. In EVERY response include emotion JSON blocks to animate your face, placed anywhere in your message, using EXACTLY this format: {"Head":45,"Mouth":30,"Analog":{"x":0,"y":0}}
Ranges: Head 20-100 (20=look left,45=center, 100=look right), Mouth 30-100 (30=closed, 100=open/smile), Analog x -1 to 1 (eye pan), y -1 to 1 (eye tilt). Include as many frames as needed to make the animation feel natural (e.g. approach → peak → settle).
```

Customise it in **Settings → System Prompt**.

---

## Speech-to-Text Pipeline

```
Microphone
   │
   ▼
Web Speech API (Thai: th-TH)
   │  raw transcript (may have errors)
   ▼
POST /api/stt-correct          ← AI context correction step
   │  corrected transcript
   ▼
Chat bubble (updated in-place)
   │
   ├─── AI mode  → POST /api/ai  → Llama response → TTS
   └─── Person   → WebRTC data channel / Socket relay
```

### STT Context Correction

Before a finalised speech chunk is sent to the AI or a peer, it passes through `/api/stt-correct`. The server feeds the last 6 conversation turns plus the raw transcript to Llama and asks it to fix Thai homophones and garbled words. The bubble dims briefly (`opacity: 0.6`) while correcting, then updates in-place with the corrected text.

Falls back silently to the raw transcript if:
- No server API key is configured
- The correction request fails or times out

---

## Conversation Tips (ภาษาไทย)

- พูดชัดๆ และเว้นวรรคระหว่างประโยค — Web Speech API จับคำได้ดีขึ้น
- ระบบจะแก้ไขคำผิดโดยอัตโนมัติโดยอิงบริบทการสนทนา
- กด **Speech** (ไมโครโฟน) เพื่อเปิด/ปิดการรับเสียง
- เปิด **AI Voice Response** ใน Settings เพื่อให้ AI อ่านคำตอบออกเสียงเป็นภาษาไทย

---

## API Endpoints

| Endpoint | Purpose |
|----------|---------|
| `POST /api/ai` | Main chat completion (Groq / Gemini / Anthropic / OpenAI) |
| `POST /api/stt-correct` | AI-powered STT context correction |
| `POST /api/translate` | Thai ↔ English live translation |
| `GET  /api/provider-defaults` | Returns server-detected provider & model |

---

## Changing Language / Provider

Open **⚙️ Settings** in the top-right corner:

1. **Provider** — Groq (default), OpenAI, Anthropic, Gemini
2. **Model** — auto-filled per provider; override freely
3. **System Prompt** — describe the assistant persona and language rules
4. **AI Voice Response** — toggles Thai TTS for AI replies

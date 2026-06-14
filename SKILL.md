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
คุณเป็นผู้ช่วยที่เป็นมิตรและมีประโยชน์ ตอบเป็นภาษาไทยเป็นหลักเสมอ ตอบสั้นกระชับ
You are a helpful assistant. Always reply in Thai first. Keep responses concise.
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

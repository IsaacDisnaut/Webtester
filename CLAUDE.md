# DeepdarkFamtasy — Codebase Reference

## Project Overview

A Thai-language AI robot videocall system. Core pieces:

- **`deep.py`** — Python MQTT subscriber that forwards emotion commands from the broker to an Arduino over serial (USB).
- **`videocall/deep.py`** — Earlier version of the same serial bridge (kept separately, slightly different behaviour).
- **`api.py`** — One-off Gemini API test script (google-genai SDK).
- **`videocall/`** — Node.js + Socket.IO web app: WebRTC video call, AI chat, robot face control panel, Whisper STT, TTS, MQTT.

The robot hardware (InMoov head) runs Arduino firmware that reads JSON over serial and drives servos. The browser publishes emotion JSON → MQTT `robot/emotion` → `deep.py` reads it → Arduino.

---

## `deep.py` (root)

Python serial bridge. Subscribes to `robot/emotion` on `test.mosquitto.org:8081` (WSS) and drives the Arduino.

### Config constants
| Name | Default | Purpose |
|---|---|---|
| `BROKER` | `test.mosquitto.org` | Public MQTT broker host |
| `PORT` | `8081` | WSS port |
| `SERIAL_PORT` | `COM3` | Change to `/dev/ttyUSB0` on Linux |
| `BAUD_RATE` | `115200` | Arduino baud |
| `EMOTION_TOPIC` | `robot/emotion` | Subscribed topic |

### Functions

#### `send_to_serial(obj)`
Serialises `obj` to compact JSON and writes it as a newline-terminated UTF-8 string to the open serial port. No-ops if serial is unavailable.

#### `wait_for_run_complete(timeout=30)`
Blocking read loop. Reads lines from Arduino until it sees `"RUN COMPLETE"` or the timeout (seconds) expires. Used between sequential emotion frames so the previous motion finishes before the next begins.

#### `play_emotion_sequence(payload_str)`
Parses `payload_str` as JSON. Accepts either a single frame object `{...}` or an array of frames `[{...}, {...}]`. Sends each frame via `send_to_serial()` and calls `wait_for_run_complete()` between frames (not after the last). Called in a daemon thread from `on_message`.

#### `on_connect(client, userdata, flags, reason_code, properties=None)`
MQTT callback. Subscribes to `EMOTION_TOPIC` on connect.

#### `on_message(_client, _userdata, msg)`
MQTT callback. Decodes payload, prints a 120-char preview, then spawns a daemon thread running `play_emotion_sequence`.

### MQTT client setup
Uses `paho-mqtt` v2 callback API with `transport="websockets"` and `tls_set()` (TLS). Calls `client.loop_forever()`.

---

## `videocall/deep.py`

Older serial bridge. Similar to root `deep.py` but:

- Uses `FRAME_DELAY = 0.5` sleep between frames instead of waiting for `"RUN COMPLETE"`.
- Entry-point function is named `handle_message` (not `play_emotion_sequence`).
- Always calls `wait_for_run_complete()` even after the last frame (before the sleep).

### Functions

#### `send_to_serial(obj)` — same as root version.

#### `wait_for_run_complete(timeout=30)` — same as root version.

#### `handle_message(payload_str)`
Parses JSON. For arrays: iterates frames, calls `send_to_serial`, `wait_for_run_complete`, `time.sleep(FRAME_DELAY)` after every frame including the last. For a single object: calls `send_to_serial` once.

#### `on_connect` / `on_message` — same pattern as root, but `on_connect` uses positional param `_client`.

---

## `api.py`

Standalone Gemini API test. Uses `google-genai` SDK (not `google-generativeai`).

### Functions

#### `generate_content_with_retry(prompt, max_retries=5)`
Sends `prompt` to `gemini-2.0-flash` using `client.models.generate_content()`. On HTTP 429 (`errors.APIError` with `e.code == 429`) backs off with exponential delay starting at 5 s, doubling each retry. Any other `APIError` or generic exception breaks out of the loop. Raises `Exception` if all retries exhausted.

---

## `videocall/server.js`

Node.js 18+ Express + Socket.IO backend. Two modes:
- **Development** — self-signed HTTPS on `:3443`, HTTP→HTTPS redirect on `:3000`.
- **Production** (`NODE_ENV=production`) — plain HTTP on `$PORT`, cloud platform provides TLS.

### SQLite session tracking

Database at `$DB_PATH` (default `videocall.db`). Table: `sessions(id, name, login_time, usage_seconds, logout_time)`.

Prepared statements:
- `stmtStart` — INSERT new session row.
- `stmtEnd` — UPDATE usage_seconds and logout_time.
- `stmtGetAll` — SELECT last 200 sessions ordered by login_time DESC.

### API key loading

Reads `../apikey` file (one level above `videocall/`). Format per line:
```
Groq: gsk_…
[
"model-a",
"model-b"
]
Openrouter: sk-or-…
Gemini: AIza…
9arm: …
```
Keys stored in `KEYS` object keyed by lowercase provider name. JSON arrays of model names stored in `PROVIDER_MODEL_LISTS[provider]`. Falls back to env vars: `GROQ_API_KEY`, `OPENROUTER_API_KEY`, `GEMINI_API_KEY`, `9ARM_KEY` / `NINEARM_KEY`, and legacy `API_KEY`.

### REST Endpoints

#### `GET /api/provider-defaults`
Returns `{ provider, model, baseUrl, available, modelLists, keys }` — tells the frontend which provider is pre-configured on the server.

#### `POST /api/translate`
Body: `{ text: string }`. Translates between Thai and English using the configured provider (Groq/OpenRouter via OpenAI-compat, or Gemini REST). Returns `{ translated }`.

#### `POST /api/stt`
Body: raw audio bytes. Headers: `Content-Type` and `X-Mime-Type`. Forwards to Groq Whisper (`whisper-large-v3-turbo`, language `th`). Returns `{ text }`. Requires `KEYS.groq`.

#### `POST /api/stt-correct`
Body: `{ text, messages[] }`. Uses last 6 conversation messages as context, sends a Thai-language correction prompt to the AI provider. Falls back to raw `text` on any error. Returns `{ corrected }`.

#### `POST /api/ai`
Body: `{ provider, baseUrl, apiKey, model, messages, systemPrompt }`. Routes to:
- `groq` — OpenAI-compat `/chat/completions`
- `openrouter` — OpenAI-compat `/chat/completions`
- `gemini` — Gemini REST `generateContent`
- `anthropic` — Anthropic Messages API
- `9arm` — `https://gateway.9arm.co/v1/chat/completions`
- fallback — any OpenAI-compat `baseUrl`

Returns `{ content: string }`.

#### `GET /api/ice-config`
Returns `{ iceServers[] }` — Google STUN + openrelay.metered.ca STUN/TURN + optional custom TURN from `TURN_URL` / `TURN_USER` / `TURN_PASS` env vars.

#### `POST /api/session/start`
Body: `{ name }`. Inserts a session row, returns `{ sessionId }`.

#### `POST /api/session/end`
Body: `{ sessionId, usageSeconds }`. Updates the row.

#### `POST /api/session/end-beacon`
Same as `/end` but returns 204 — designed for `navigator.sendBeacon`.

#### `GET /api/sessions`
Returns the last 200 session rows.

#### `GET /face`
Serves `public/index.html` — the SPA auto-detects `/face` pathname and joins room `FACE` without a login form.

### `attachSocketIO(server)`

Attaches Socket.IO to the HTTP/HTTPS server. Events:

| Event (client→server) | Behaviour |
|---|---|
| `join-room(roomId)` | Leaves all current rooms, joins `roomId`, emits `room-joined` back with existing peer list, broadcasts `peer-joined` to others |
| `signal({ to, signal })` | Relays WebRTC offer/answer/candidate to `to` socket as `signal({ from, signal })` |
| `chat-message({ roomId, message })` | Broadcasts to room (excludes sender) |
| `peer-tts({ roomId, enabled })` | Broadcasts to room so both sides can sync auto-read state |
| `disconnect` | Broadcasts `peer-left` to all rooms the socket was in |

---

## `videocall/public/app.js`

Single-file frontend SPA (~1730 lines). No build step — plain ES2020 `'use strict'`.

### Platform detection
```js
IS_IOS     // iPad/iPhone/iPod or iPadOS 13+
IS_MOBILE  // IS_IOS || Android
IS_FACE    // window.location.pathname === '/face'
```

### `unlockTTS()`
Called on first meaningful button tap. Speaks a silent `SpeechSynthesisUtterance` (volume 0) to unlock iOS audio context.

---

### Session management

#### State
| Variable | Type | Purpose |
|---|---|---|
| `sessionId` | number\|null | Row ID from `/api/session/start` |
| `sessionStartTime` | number\|null | `Date.now()` at login |
| `sessionTimerTick` | interval ID | `setInterval` for the timer chip |
| `currentUserName` | string | Name entered at login |

#### `usageSeconds()`
Returns `Math.round((Date.now() - sessionStartTime) / 1000)` or 0.

#### `doLogin(name)`
POSTs to `/api/session/start`. Sets `sessionId`, `sessionStartTime`, `currentUserName`, calls `startSessionTimer()`.

#### `endSession()`
Clears interval. POSTs to `/api/session/end`.

#### `startSessionTimer()`
Shows the session chip (`#session-chip`). Ticks every second updating `#session-timer` in `M:SS` format.

#### `flushSession()`
Calls `navigator.sendBeacon('/api/session/end-beacon')` with current usage. Attached to `beforeunload`, `pagehide`, and `visibilitychange→hidden`.

---

### Login screen

#### `initLoginScreen()`
On `/face`: hides login screen, calls `doLogin('FACE')` then `initApp()`. Otherwise wires the `#login-form` submit handler — validates name, calls `doLogin()`, animates screen out (`exit` class + `transitionend`), then calls `initApp()`.

---

### Application state

```js
state = {
  mode: 'ai' | 'person' | 'robot',
  micOn: true,
  camOn: true,
  speechOn: false,
  localStream: MediaStream | null,
  aiTyping: false,
}
aiHistory  // OpenAI-format message array for the AI conversation
peers      // { peerId: { pc: RTCPeerConnection, dc: RTCDataChannel } }
```

### Settings

Default system prompt instructs the robot to respond in Thai, embed face-animation JSON blocks in every reply using format `{"Head":45,"Mouth":30,"Analog":{"x":0,"y":0}}`.

#### `loadSettings()`
Reads `vc_settings` from localStorage; merges with `DEFAULT_SETTINGS` (always resets `systemPrompt` to default).

#### `persistSettings(s)`
Writes `s` to `vc_settings` in localStorage.

---

### Boot

#### `fetchProviderDefaults()`
Fetches `/api/provider-defaults`. Merges server model lists into `PROVIDER_MODELS`, server keys into `SERVER_KEYS`. Only overwrites `settings.provider` / `.model` / `.baseUrl` if no saved settings exist.

#### `initApp()`
Called after login. Runs: `fetchProviderDefaults`, `populateSettingsForm`, `bindEventListeners`, `initSocket`, `initSpeechRecognition`, then in parallel `fetchIceConfig` + `startLocalMedia`. On `/face`: joins room `FACE`, applies `robot` mode. Otherwise: applies `ai` mode, shows welcome message, connects MQTT.

---

### ICE / TURN

#### `fetchIceConfig()`
Fetches `/api/ice-config`, stores result in `iceConfig`.

#### `buildIceConfig(baseServers)`
Appends the user's custom TURN server (from settings) to `baseServers` array. Returns `{ iceServers }`.

---

### Local media

#### `startLocalMedia()`
`getUserMedia({ video: true, audio: true })`. Assigns stream to `#local-video`. Shows `#cam-placeholder` on error with specific messages per error name.

#### `toggleMic()`
Flips `state.micOn`, enables/disables audio tracks, toggles `off` class on `#mic-btn`.

#### `toggleCam()`
Flips `state.camOn`, enables/disables video tracks, toggles hidden classes on `#local-video` and `#cam-placeholder`.

---

### Mode switching

#### `applyMode(mode)`
Sets `state.mode`. Updates `.mode-btn` active class. Hides/shows `#robot-panel`, `#remote-wrap`, `#local-wrap`, `#room-bar` per mode:
- `robot` — robot panel + controls row visible; joins FACE room; `recognition.lang = 'th-TH'`; calls `initRobotPanel()`.
- `ai` — robot panel visible, controls row hidden; `roomBar` hidden.
- `person` — video feeds visible; room bar visible; auto-joins `FACE` if no room.

---

### Robot control panel

#### Robot state
```js
robotState = {
  analogX:   0,    // -1..1  eye left/right
  analogY:   0,    // -1..1  eye up/down
  headAngle: 0,    // degrees -35..35
  mouthOpen: 0,    // 0..1
  padDir:    null, // 'left'|'right'|'up'|'down'|null
}
```

#### `updateRobotModel()` (alias: `updateFaceAnimation`)
Drives the Three.js URDF viewer joints:
- `rothead_link_joint` ← `headAngle * π/180`
- `jaw_link_joint` ← `mouthOpen * 0.17453` rad
- `eyeLeft.001 / eyeRight.001` ← `analogX * 0.349` rad (pan)
- `eyeLeft / eyeRight` ← `-analogY * 0.349` rad (tilt)

#### `applyRobotPayload(str)`
Parses a JSON string. If it has `Head`, `Mouth`, or `Analog` keys, updates `robotState` and calls `updateRobotModel()`. Returns `true` on success. Used by both MQTT and WebRTC data channel to avoid treating robot commands as chat messages.

Mapping: `Head` 20-150 → `headAngle = Head - 65`. `Mouth` 20-150 → `mouthOpen = (Mouth - 20) / 130`. `Analog.x/y` → direct.

#### `playEmotionSequence(str)`
Accepts JSON array or single object. Plays frames sequentially with 800 ms `setTimeout` between them. Cancels any in-progress sequence first.

#### `connectMQTT()`
Reads `settings.mqttUrl` and `settings.mqttTopic`. Connects `mqtt.js` browser client (WSS). Subscribes to `robot/control` (joystick/d-pad) and `robot/emotion` (AI face sequences). Dispatches messages: `robot/emotion` → `playEmotionSequence`, others → `applyRobotPayload`. Updates `#mqtt-dot` and `#mqtt-status-text`.

#### `publishRobotState()`
Converts `robotState` back to `{Head, Mouth, Analog}` wire format (Head = `65 + headAngle`, Mouth = `20 + mouthOpen*130`). Sends via WebRTC data channel (`sendToPeer`) and publishes to `robot/emotion` MQTT topic.

#### `initJoystick()`
Pointer/touch event handlers on `#joystick-base`. Clamps displacement to 35% of base radius. Maps x/y offset to `robotState.analogX/Y` (range -1..1), calls `publishRobotState()`. On release: resets to 0,0.

#### `applyDPad()`
Increments `robotState.headAngle` (±3°/tick, clamped ±35) or `robotState.mouthOpen` (±0.10/tick, clamped 0-1) based on `robotState.padDir`.

#### `initDPad()`
Wires `#dpad-{up,down,left,right}` buttons. On press: sets `padDir`, calls `applyDPad()` + `publishRobotState()` immediately, then repeats every 50 ms via `dpadInterval`. On release: clears interval. `#dpad-center` resets all axes to 0.

#### `initRobotPanel()`
Called once (guarded by `robotPanelReady`). Calls `initJoystick()`, `initDPad()`. Instantiates `window.RobotViewer` on `#robot-canvas` (Three.js URDF viewer). Always calls `connectMQTT()`.

---

### STT — context correction

#### `correctSTTWithContext(rawText)`
POSTs to `/api/stt-correct` with last 6 `aiHistory` messages as context. Returns corrected string, falls back to `rawText` on error.

---

### Speech recognition (Web Speech API)

#### `initSpeechRecognition()`
Creates `SpeechRecognition` with `continuous=true`, `interimResults=true`, `lang='th-TH'`. Implements exponential restart backoff (base 600 ms mobile / 0 ms desktop; caps at 8 s; multiplies by 1.5 after each `onend`; resets to base on any result).

`onresult`: Shows interim text in a reusable `interimMsgEl` DOM node. On final chunk: removes interim, optionally calls `correctSTTWithContext`, then calls `sendToPeer` (person mode) or `sendToAI` (ai mode). In other modes appends to `chatInput`.

`onerror`: Calls `disableSpeech()` on `not-allowed`, `service-not-allowed`, `audio-capture`. Increases backoff on `network`.

`onend`: Auto-restarts after `restartDelay` if `state.speechOn` is still true.

#### `enableSpeech()`
Sets `state.speechOn = true`. On mobile: disables local audio tracks to give STT exclusive mic access. Starts recognition.

#### `disableSpeech()`
Sets `state.speechOn = false`. Stops recognition. Removes `interimMsgEl`. On mobile: re-enables audio tracks (respects mute state).

#### `toggleSpeech()`
In Whisper mode: toggles `whisperContinuous`. In Web Speech mode: calls `enableSpeech` / `disableSpeech`.

---

### Whisper STT

Constants: `SILENCE_THRESHOLD = 0.015` RMS, `SILENCE_DELAY_MS = 1500`, `MIN_RECORD_MS = 500`.

#### `startWhisperRecording()`
Opens a fresh `getUserMedia` audio-only stream. Picks best MIME type (webm/opus → webm → ogg → mp4). Creates `MediaRecorder` with 300 ms slice interval. Attaches Web Audio `AnalyserNode` (fftSize 1024) for RMS silence detection via `requestAnimationFrame` loop — auto-stops after `SILENCE_DELAY_MS` ms of sub-threshold audio, but not before `MIN_RECORD_MS`.

#### `stopWhisperRecording()`
Stops the `MediaRecorder`. In continuous mode keeps the button/indicator active.

#### `restartWhisperAfterTTS()`
Polls `speechSynthesis.speaking` every 300 ms, then waits 400 ms after TTS finishes before calling `startWhisperRecording()`. Only runs if `whisperContinuous` is true.

#### `transcribeWhisper(blob)`
POSTs audio blob to `/api/stt`. Shows `"✦ Transcribing…"` indicator. On success: optionally calls `correctSTTWithContext`, logs timing via `showTimingLog`, then `sendToAI` or `sendToPeer`. If `whisperContinuous`: calls `restartWhisperAfterTTS()` after processing.

---

### TTS

#### `speak(text)`
Calls `stripJsonBlocks` to remove emotion JSON, then `SpeechSynthesisUtterance` with Thai voice and `settings.ttsRate`. Shows `#ai-speaking` and adds `.speaking` to `#ai-avatar` while speaking. Only fires if `settings.ttsEnabled`.

#### `stopSpeaking()`
Calls `speechSynthesis.cancel()`, hides speaking UI.

#### `getThaiVoice(gender='male')`
Filters `speechSynthesis.getVoices()` by `lang.startsWith('th')`. Tries to match `male`/`female` keyword in voice name/URI. Falls back to first Thai voice.

#### `speakPeerMessage(text)`
Speaks incoming peer text if `peerTTSEnabled` is true (peer enabled voicing for themselves).

#### `speakOnDemand(text)`
Per-message speaker button handler. Unlocks TTS (iOS), cancels current speech, speaks text.

#### `togglePeerTTS()`
Flips `myTTSEnabled`. Emits `peer-tts` socket event so the peer knows whether to speak our messages.

---

### Translation

#### `translateText(text)`
POSTs to `/api/translate`. Returns `data.translated`.

#### `addTranslation(msgWrap, text)`
If `translateEnabled`: appends a `.msg-translation.loading` div, calls `translateText`, fills in result or removes on error.

#### `toggleTranslate()`
Flips `translateEnabled`. Updates `#translate-btn` style and shows status message.

---

### Chat UI

#### `appendMessage(sender, text, side, interim=false)`
Creates `.msg.{side}` wrapper with `.msg-sender`, `.msg-bubble`. Non-interim messages get `.msg-footer` with timestamp. Peer messages get a `🔊` speaker button wired to `speakOnDemand`. Appends to `#chat-messages`, scrolls to bottom. Returns the wrapper element (used to attach translation later).

#### `showTypingIndicator()`
Appends a three-dot `.typing-bubble` animation div with `id="typing-indicator"`. Returns it.

#### `removeTypingIndicator()`
Removes `#typing-indicator`.

#### `showSystemMsg(text)`
Appends a `.system-msg` div.

#### `showTimingLog(parts)`
Appends a `.system-msg.timing-log` showing `⏱ STT 0.00s · correction 0.00s` etc. Also logs to console.

#### `showTapToUnlockAudio()`
Shows a tappable `.tap-unlock-btn` banner (mobile only). On tap calls `unlockTTS()`.

#### `clearWelcome()`
Removes `.chat-welcome` element on first message.

---

### Emotion extraction

#### `extractJsonBlocks(text)`
Depth-counting brace parser. Returns all top-level `{...}` substrings from `text`, including those with nested braces (like `Analog:{}`).

#### `stripJsonBlocks(text)`
Removes all `{...}` blocks (any depth) from text, collapses whitespace.

#### `publishEmotion(text)`
Calls `extractJsonBlocks`, parses each block, filters for objects with `Head`/`Mouth`/`Analog` keys, clamps values to valid ranges, collects into array, publishes to `robot/emotion` MQTT topic.

---

### AI API

#### `sendToAI(text)`
Guards with `state.aiTyping`. Pushes user message to `aiHistory`, shows typing indicator, POSTs to `/api/ai` with full settings. On success: pushes assistant reply to `aiHistory`, calls `stripJsonBlocks` for display, `publishEmotion` for face animation, `appendMessage`, `showTimingLog`, `addTranslation`, `speak`. Pops last history entry on error.

---

### Socket.IO signaling

#### `initSocket()`
Connects to same origin via `io()`. Handles:
- `room-joined` — sets `currentRoomId`; calls `startCall(pid, true)` for existing peers.
- `peer-joined` — calls `startCall(pid, false)`.
- `signal` — routes to correct `RTCPeerConnection` (creates one if needed); handles offer/answer/candidate.
- `peer-left` — calls `cleanupPeer`, resets `peerTTSEnabled`.
- `chat-message` — `appendMessage`, `addTranslation`, `speakPeerMessage`.
- `peer-tts` — sets `peerTTSEnabled`; on mobile shows `showTapToUnlockAudio()` if not yet unlocked.

---

### WebRTC

#### `createPeerConnection(peerId)`
Creates `RTCPeerConnection` with current ICE config (including custom TURN). Adds local tracks. Sets up `ontrack` → assigns to `#remote-video`, shows connected status. `onicecandidate` → relays via socket. `oniceconnectionstatechange` → calls `pc.restartIce()` on `failed`. Stores in `peers[peerId]`.

#### `setupDataChannel(peerId, dc)`
Stores `dc` in `peers[peerId].dc`. `onmessage`: tries `applyRobotPayload` first (robot control); if false, treats as chat (`appendMessage`, `addTranslation`, `speakPeerMessage`).

#### `startCall(peerId, isInitiator)`
If initiator: creates data channel `'chat'`, calls `setupDataChannel`, creates offer, sets local description, emits `signal`.

#### `cleanupPeer(peerId)`
Closes `RTCPeerConnection`, deletes from `peers`, clears `#remote-video`.

#### `sendToPeer(text)`
Sends via open data channels. Falls back to socket `chat-message` relay only when no data channel is open.

---

### Room management

#### `generateRoomCode()`
Generates a 6-char base-36 code, emits `join-room`.

#### `joinRoom(code)`
Cleans up existing peers, emits `join-room` with uppercased code.

#### `setRoomStatus(text, connected)`
Updates `#room-status` text and `.connected` class.

#### `endCall()`
Stops TTS, cleans up all peers. In AI mode: resets `aiHistory`, shows welcome. In person mode: re-joins `FACE`.

---

### Settings modal

#### `populateSettingsForm()`
Writes current `settings` values into all `#s-*` form fields. Calls `toggleBaseUrlField`.

#### `readSettingsForm()`
Reads all form fields back into a plain object. Uses `#s-model-select` when visible, `#s-model` text input otherwise.

#### `toggleBaseUrlField(provider)`
Hides `#field-baseurl` for known providers (groq, openrouter, gemini, anthropic, 9arm). Fills `#s-apikey` from `SERVER_KEYS` if available. Populates `#s-model-select` from `PROVIDER_MODELS[provider]` or falls back to text input with sensible defaults per provider.

#### `openSettingsModal()` / `closeSettingsModal()`
Adds/removes `.open` class on `#settings-overlay`.

---

### Event wiring

#### `bindEventListeners()`
All button click bindings assembled here. Key ones:
- Mode buttons → `applyMode`
- `#mic-btn` → `toggleMic`
- `#video-btn` → `toggleCam`
- `#speech-btn` → `toggleSpeech`
- `#end-btn` → `endCall`
- `#peer-tts-btn` → `togglePeerTTS`
- `#translate-btn` → `toggleTranslate`
- `#send-btn` + Enter in `#chat-input` → `sendMessage`
- `#join-btn` + Enter in `#join-input` → `joinRoom`
- `#copy-code-btn` → `navigator.clipboard.writeText`
- Settings open/close/save buttons
- `#s-provider` change → `toggleBaseUrlField`
- `#s-model-select` change → syncs `#s-model` text input
- `#s-rate` input → updates `#rate-val` display
- `#toggle-key-btn` → toggles `#s-apikey` password/text type

#### `autoResizeInput()`
Sets `chatInput` height to `scrollHeight` capped at 120 px.

---

### Entry point

`window.addEventListener('DOMContentLoaded', () => initLoginScreen())` — everything starts here.

---

## Wire format — Robot emotion JSON

```json
{ "Head": 45, "Mouth": 30, "Analog": { "x": 0.0, "y": 0.0 } }
```

| Field | Range | Meaning |
|---|---|---|
| `Head` | 20–150 (center ≈ 65) | Servo degrees for head rotation (20 = left, 100 = right) |
| `Mouth` | 30–100 | Jaw servo (30 = closed, 100 = open/smile) |
| `Analog.x` | -1..1 | Eye pan (left/right) |
| `Analog.y` | -1..1 | Eye tilt (up/down) |

Arrays `[frame1, frame2, ...]` are played sequentially (800 ms apart in browser, `RUN COMPLETE` signal in Python).

Topic `robot/emotion` is used for AI-generated sequences. Topic `robot/control` is used for live joystick/d-pad control.

---

## Local development

```
cd videocall
npm install
node server.js
```

Create `apikey` file one level up (`d:/CODING/DeepdarkFamtasy/apikey`) with provider keys. Visit `https://localhost:3443` — accept the self-signed cert.

# WEB.md — เอกสารอ้างอิงการทำงานของเว็บ VideoCall

เอกสารนี้อธิบายการทำงานทางเทคนิคทั้งหมดของเว็บแอป — ฟีเจอร์, AI ที่ใช้, เส้นทางข้อมูล, MQTT, REST API, Socket.IO, WebRTC และโครงสร้างไฟล์ อ้างอิงจากโค้ดจริงใน `videocall/` (โค้ดที่กำลังพัฒนาอยู่จริง) ณ วันที่ 5 กรกฎาคม 2569

> ดูภาพรวมเป้าหมายโปรเจกต์ได้ที่ [CLAUDE.md](CLAUDE.md) และผลรีวิว UX/Accessibility ได้ที่ [REVIEW.md](REVIEW.md) — ไฟล์นี้เน้นเฉพาะ "มันทำงานยังไง" ไม่ใช่ "ควรปรับอะไร"

---

## 0. ข้อควรรู้: สอง copy ของโค้ดในโปรเจกต์เดียวกัน

โปรเจกต์นี้มีโค้ด Node.js อยู่ **สองชุดคู่ขนานกัน** ที่ไม่ sync กัน:

| ที่อยู่ | สถานะ | ใช้ทำอะไร |
|---|---|---|
| `videocall/` | **โค้ดที่พัฒนาอยู่จริง ล่าสุด** — nested git repo แยกต่างหาก (remote `github.com/IsaacDisnaut/Webtester`), commit ล่าสุด `b798bca fix: MQTT local broker + accessibility + critical UX issues` | รันจริงผ่าน `start-local.bat` — นี่คือโค้ดที่เอกสารนี้อ้างอิงทั้งหมด |
| `server.js`, `public/` (root) | **สำเนาเก่ากว่า ~1 เดือน** ค้างอยู่ที่จุดพัฒนาก่อนหน้า (มี `ai-camera-panel` แยกต่างหาก, ปุ่มโหมด 3 ปุ่ม ฯลฯ) | ใช้เป็น build context ของ `Dockerfile`/Railway deploy — **ยังไม่ได้ sync ฟีเจอร์ล่าสุดจาก `videocall/`** |

`git status` ที่ root จะขึ้น `M videocall` เสมอเพราะ `videocall/` เป็น gitlink ที่ไม่มี `.gitmodules` แมปไว้ (โคลนสดจะไม่ได้โฟลเดอร์นี้อัตโนมัติ) หากจะ deploy โค้ดล่าสุดขึ้น production ต้อง copy ไฟล์จาก `videocall/` ไปทับ root ก่อน build

---

## 1. ภาพรวมสถาปัตยกรรม

```
Browser (operator)  ──WebRTC (video+audio+datachannel)──  Browser (/face กล้อง/จอหุ่นยนต์)
        │                                                          │
        └──────────────── Socket.IO (signaling + chat relay) ──────┘
        │                                                          │
        └── HTTPS REST API ──► server.js (Express) ◄── HTTPS REST API
                                    │
                    ┌───────────────┼───────────────────┐
                    │               │                    │
              SQLite (session)  MQTT WS proxy      YOLO proxy → yolo_server.py (:5001)
                                 → Mosquitto (:9001/:1883/:9443, local LAN)
                                        │
                                    deep.py (Python, root) → Arduino (Serial) → หุ่นยนต์ InMoov จริง
```

- **ไม่มี build step** — ฝั่ง frontend เป็น vanilla JS ไฟล์เดียว (`videocall/public/app.js`, ~2070 บรรทัด), โหลด library ผ่าน CDN (`<script>` tag ตรงๆ ไม่มี bundler)
- **Backend** เป็น Node.js + Express เดี่ยว (`videocall/server.js`, 478 บรรทัด) ให้บริการทั้งไฟล์ static, REST API, WebSocket (Socket.IO signaling + MQTT WS proxy)
- **ไม่มี database server แยก** — ใช้ SQLite ไฟล์เดียว (`better-sqlite3`) เก็บ session log เท่านั้น
- **รันจริง**: local Mosquitto broker (ไม่ใช่ public broker แล้ว) + Cloudflare Tunnel สำหรับ URL สาธารณะ (ดู §12)

---

## 2. โหมดการทำงาน — nav มี 2 ปุ่ม, ภายในมี 3 state

`state.mode` มีค่าได้ 3 แบบ (`'ai' | 'person' | 'robot'`) แต่แถบเมนู (`.mode-nav`) แสดงแค่ 2 ปุ่มจริง — โหมด `robot` ไม่มีปุ่มเลย เป็น state ภายในสำหรับจอ `/face` เท่านั้น

| โหมด | เข้าถึงทาง | ค่าเริ่มต้น | คำอธิบาย |
|---|---|---|---|
| `person` | ปุ่ม "คุยกับคน" (**เป็นโหมดเริ่มต้นของเว็บตอนนี้**) | ✅ default (`settings.showAiMode = false`) | วิดีโอคอล WebRTC + **แผงควบคุมหุ่นยนต์แบบ manual (จอยสติ๊ก+D-pad) รวมอยู่ในแท็บเดียวกัน** — ก่อนหน้านี้ robot เคยเป็นแท็บแยก ตอนนี้ถูกรวมเข้ากับ person mode แล้ว |
| `ai` | ปุ่ม "คุยกับ AI" — **ซ่อนจากเมนูโดยค่าเริ่มต้น** เปิดได้ที่ Settings → "แสดงโหมด คุยกับ AI" | ❌ ซ่อน | พิมพ์/พูดคุยกับ AI ภาษาไทย พร้อม animation หน้าหุ่น 3D + auto-run YOLO detection ตลอดเวลา |
| `robot` | อัตโนมัติเมื่อเข้า path `/face` เท่านั้น (ไม่มีปุ่มในเมนูเลย) | — | โหมด kiosk สำหรับจอ/กล้องหน้าหุ่นจริง — auto-login "FACE", auto-join ห้อง `FACE`, auto-start STT ทันที, ซ่อน header/แชท/room bar ทั้งหมด แสดงแค่โมเดลหน้า 3D เต็มจอ + สถานะ "กำลังเชื่อมต่อเจ้าหน้าที่…" จนกว่าจะมี operator เชื่อมมา |

**เหตุผลของการเปลี่ยนแปลงนี้** ([app.js:174](videocall/public/app.js#L174), [app.js:453](videocall/public/app.js#L453)): โฟกัสหลักของโปรเจกต์คือ operator ↔ ลูกค้าหน้าหุ่นยนต์ (ดู [CLAUDE.md](CLAUDE.md)) ไม่ใช่ AI ดังนั้น UI เริ่มต้นจึงตัด AI ออกจากสายตา operator และรวม robot control เข้ากับ person mode เพื่อให้ operator ควบคุมหุ่น + วิดีโอคอลได้พร้อมกันในหน้าจอเดียว

**ความสัมพันธ์ /face ↔ person mode:** ทั้งคู่ auto-join ห้อง Socket.IO/WebRTC ชื่อ `FACE` เป็นค่าเริ่มต้น ทำให้ operator (person mode) กับจอหน้าหุ่น (`/face`) เชื่อมถึงกันอัตโนมัติโดยไม่ต้องแลกรหัสห้อง

---

## 3. ฟีเจอร์หลัก

### 3.1 AI Chat (โหมด `ai`, ซ่อนโดยค่าเริ่มต้น)
- ส่งข้อความ/เสียงไปยัง AI provider ที่ตั้งค่าไว้ ผ่าน `POST /api/ai`
- System prompt ค่าเริ่มต้น ([app.js:182](videocall/public/app.js#L182)): "You are a male Thai robot… Head 20-100 (20=left,45=center,100=right), Mouth 30-100 (30=closed,100=open/smile)…" — **ช่วงค่าต่างจากเวอร์ชันก่อนหน้า** (เดิม Head/Mouth คือ 20-150)
- ประวัติสนทนา (`aiHistory`) เก็บใน memory ของ browser tab ไม่ persist ข้าม session
- กด **วางสาย** เพื่อล้างประวัติและเริ่มบทสนทนาใหม่

### 3.2 วิดีโอคอล + แผงควบคุมหุ่นยนต์ (โหมด `person`, ค่าเริ่มต้น)
- WebRTC peer-to-peer (เสียง+วิดีโอ+data channel) ผ่าน Socket.IO signaling
- สร้าง/เข้าร่วมห้องด้วยรหัส 6 ตัวอักษร (`generateRoomCode()`) หรือรหัสที่กำหนดเอง (auto-join `FACE` ถ้าไม่ระบุ)
- แชทข้อความคู่ขนาน ส่งผ่าน WebRTC data channel เป็นหลัก (fallback ไป Socket.IO relay ถ้า data channel ยังไม่เปิด)
- ปุ่ม 🔊 ต่อข้อความ, ปุ่ม toggle "ส่งเสียงข้อความของฉันให้คู่สนทนา" — **เปิดอัตโนมัติทุกครั้งที่เข้าโหมด person** ([app.js:525](videocall/public/app.js#L525))
- **จอยสติ๊ก** (ลาก หรือ WASD) — ควบคุมลูกตาซ้าย/ขวา/บน/ล่าง
- **D-pad** (กด หรือลูกศร) — ◄► หันหัว, ▲▼ เปิด/ปิดปาก, ปุ่มกลาง/Space รีเซ็ต — ปรับความเร็วได้ที่ Settings (ช้า/ปกติ/เร็ว = `dpadSpeed` 0.5/1/1.5)
- ส่งค่าควบคุมผ่าน WebRTC data channel (ถ้ามี peer) **และ** publish ไป MQTT topic `robot/emotion` พร้อมกันเสมอ (throttled ~15Hz ดู §7.4)
- โมเดล 3D (Three.js + URDF `head.urdf`) ไม่แสดงในโหมด person (แสดงเฉพาะโหมด `ai`/`robot`) — person mode ใช้พื้นที่แสดงวิดีโอคอลแทน แต่ยังคงเชื่อมต่อ MQTT อยู่เบื้องหลัง

### 3.3 คีย์บอร์ดควบคุม (ใหม่ — โหมด `person` เท่านั้น ยกเว้น Alt)
ทำงานเฉพาะเมื่อไม่ได้พิมพ์อยู่ในช่องข้อความและไม่มี modal เปิดอยู่ ([app.js:907](videocall/public/app.js#L907)):

| ปุ่ม | ผล | ใช้ได้ในโหมดไหน |
|---|---|---|
| ลูกศร ◄►▲▼ | เหมือนกด D-pad (กดหลายทิศพร้อมกันได้) | person เท่านั้น |
| `W A S D` | เหมือนลากจอยสติ๊ก (ลูกตา) | person เท่านั้น |
| `Space` | รีเซ็ต D-pad กลับตำแหน่งกลาง | person เท่านั้น |
| `Alt` ซ้าย | เปิด/ปิด Speech (STT) | ทุกโหมด |
| `Alt` ขวา | โหมด person: toggle peer TTS / โหมดอื่น: toggle AI TTS | ทุกโหมด |

ปล่อยปุ่มทั้งหมดอัตโนมัติเมื่อ window เสีย focus (`blur` event) ป้องกันค้างขยับต่อเนื่อง

### 3.4 STT — Speech-to-Text
สองโหมดใน Settings (`settings.sttMode`), ค่าเริ่มต้น = `browser`:

| โหมด | กลไก | หมายเหตุ |
|---|---|---|
| `browser` (ค่าเริ่มต้น) | Web Speech API (`SpeechRecognition`), ฟังต่อเนื่อง | Chrome/Edge เท่านั้น — iOS Safari ไม่รองรับ |
| `whisper` | บันทึกเสียงจนเงียบ (silence detection, RMS 0.015, เงียบ 1500ms) → `POST /api/stt` → Groq Whisper (`whisper-large-v3-turbo`, `language: th`) | ต้องมี Groq API key |

**มือถือ:** `getUserMedia` กับ `SpeechRecognition` แย่งไมค์กัน — เว็บ `track.stop()` ตอนเปิด STT แล้วขอไมค์ใหม่ตอนปิด สลับกลับ WebRTC ผ่าน `RTCRtpSender.replaceTrack()` (ทุก peer connection จอง audio transceiver ไว้ล่วงหน้าเสมอ ไม่ต้อง renegotiate SDP)

**`/face` (kiosk):** เรียก STT อัตโนมัติทันทีที่โหลดหน้า

**เส้นทางข้อความจาก STT:** โหมด `ai` → `sendToAI()` | โหมด `person`/`robot` → `sendToPeer()`

### 3.5 TTS — Text-to-Speech
- ใช้ `speechSynthesis` ของเบราว์เซอร์ล้วนๆ, เลือกเสียงไทยชายอัตโนมัติ (`getThaiVoice()`, ค่าเริ่มต้นหาเสียง male ก่อน)
- Peer TTS: สอง flag อิสระกัน — `myTTSEnabled` (ให้อ่านข้อความของฉันที่ฝั่งคู่สนทนา) กับ `peerTTSEnabled` (คู่สนทนาขอให้อ่านข้อความของเขาที่ฝั่งฉัน) — sync กันผ่าน Socket.IO event `peer-tts`
- iOS ต้องมี user gesture ก่อน (`unlockTTS()`)
- **Accessibility TTS แยกต่างหาก:** `announceAccessibility(text)` อ่านสถานะระบบออกเสียงทันที (เช่น "เปิดไมโครโฟนแล้ว", "คู่สนทนาเข้าร่วมแล้ว", "เชื่อมต่อแล้ว พร้อมพูดคุย") — คนละกลไกกับ `speak()` (AI reply) และ `speakPeerMessage()` (ข้อความคู่สนทนา)

### 3.6 YOLO Object Detection
- Client capture เฟรมจากกล้อง local ทุก 400ms → JPEG (quality 0.7) → `POST /api/detect` → proxy ไป `yolo_server.py` (`127.0.0.1:5001`)
- โมเดล `yolov8n.pt` (ultralytics) — **กรอง confidence ที่ฝั่ง server แล้ว** ด้วย `conf=0.60` ตอนเรียก `model()` ([yolo_server.py:13](yolo_server.py#L13)) จึงไม่มีกล่อง confidence ต่ำกว่า 60% หลุดออกมาถึง client เลย (ฝั่ง client ยังมีเช็ค `conf < 0.5` ซ้ำอยู่ที่ [app.js:316](videocall/public/app.js#L316) แต่ไม่มีผลจริงเพราะ server กรองไว้เข้มกว่าแล้ว)
- วาด bounding box สีตาม hash ของ label ลงบน `<canvas>` ทับวิดีโอ local
- **ทำงานอัตโนมัติเฉพาะโหมด `ai`** — โหมด `person` มีปุ่ม "ตรวจจับ" ให้เปิดเองแต่ **ซ่อนโดยค่าเริ่มต้น** (`settings.showDetectButton = false`, ฟีเจอร์ debug) เปิดได้ที่ Settings
- ถ้า `yolo_server.py` ไม่ได้รัน → `/api/detect` catch error คืน `[]` เงียบๆ

### 3.7 Session Tracking
- ล็อกอินด้วยชื่อ (ไม่มีรหัสผ่าน) → `POST /api/session/start` บันทึกแถวใหม่ใน SQLite
- นับเวลาใช้งานแบบ live (`M:SS` ใน header) → ส่งกลับตอนออกผ่าน `POST /api/session/end` หรือ `sendBeacon` ไป `/api/session/end-beacon` (`beforeunload`/`pagehide`/`visibilitychange→hidden`)
- ดูประวัติทั้งหมดได้ที่ `GET /api/sessions` (200 รายการล่าสุด) — ไม่มีหน้า UI แสดงผล, ไม่มี auth ป้องกัน

### 3.8 Accessibility (เพิ่มใหม่)
- `aria-live`, `aria-pressed`, `aria-label` ครบทุกปุ่มควบคุมหลัก
- Focus trap ในทุก modal (Settings/Help) — `Tab`/`Shift+Tab` วนอยู่ใน modal, `Escape` ปิด, คืน focus กลับที่เดิมตอนปิด
- `announceAccessibility()` อ่านออกเสียงเหตุการณ์สำคัญ (เปิด/ปิดไมค์, เพื่อนเข้า/ออกห้อง, เชื่อมต่อสำเร็จ) — ออกแบบมาสำหรับผู้ใช้ตาบอด
- Speaker (🔊) บนทุกข้อความจากคู่สนทนา — ออกแบบมาสำหรับ use case หูหนวก↔ตาบอด (อ่านข้อความที่พลาดฟังซ้ำได้)

---

## 4. AI ที่รองรับ

ตั้งค่าได้ที่ Settings → Provider, routing ทั้งหมดผ่าน `POST /api/ai`:

| Provider | Base URL | โมเดล default | ต้องการ key |
|---|---|---|---|
| **Groq** | `api.groq.com/openai/v1` | `llama-3.3-70b-versatile` | `KEYS.groq` |
| **OpenRouter** | `openrouter.ai/api/v1` | `qwen/qwen-2.5-72b-instruct` | `KEYS.openrouter` |
| **9Arm** | `gateway.9arm.co/v1` | `qwen3.6-35b-a3b` | `KEYS['9arm']` |
| **OpenAI-compatible** | กำหนด Base URL เอง | `gpt-4o-mini` | apiKey จาก client |
| **Anthropic** | `api.anthropic.com/v1/messages` | `claude-sonnet-4-6` | apiKey จาก client (ไม่มี server-side key) |
| **Google Gemini** | REST `generateContent` โดยตรง | `gemini-2.0-flash` | `KEYS.gemini` |

- API key ฝั่ง server อ่านจากไฟล์ `apikey` (root ของโปรเจกต์ นอก `videocall/`) รูปแบบ `Provider: key` บรรทัดละตัว หรือ env vars (`GROQ_API_KEY`, `OPENROUTER_API_KEY`, `GEMINI_API_KEY`, `9ARM_KEY`)
- `GET /api/provider-defaults` บอก frontend ว่า provider ไหนมี key พร้อมใช้บ้าง (ไม่ auto-fill ทับค่าที่ผู้ใช้เคย save เองใน localStorage)
- **หมายเหตุ:** ฟีเจอร์ AI เป็นของเสริม ซ่อนจากเมนูโดยค่าเริ่มต้น (§2) — โฟกัสหลักของโปรเจกต์คือวิดีโอคอล operator↔ลูกค้า

---

## 5. REST API ทั้งหมด (`videocall/server.js`)

| Method + Path | Body / Params | คืนค่า | หมายเหตุ |
|---|---|---|---|
| `GET /face` | — | `public/index.html` | SPA เดียวกัน แค่ path ต่างกัน ให้ `app.js` ตรวจจับแล้ว auto-join |
| `GET /api/provider-defaults` | — | `{provider, model, baseUrl, modelLists, keys}` | บอก key/provider ที่ config ไว้บน server |
| `POST /api/stt` | raw audio bytes, header `X-Mime-Type` | `{text}` | Groq Whisper, บังคับภาษาไทย |
| `POST /api/ai` | `{provider, baseUrl, apiKey, model, messages, systemPrompt}` | `{content}` | Router ไปยัง provider ต่างๆ (§4) |
| `GET /api/ice-config` | — | `{iceServers[]}` | STUN (Google) + TURN ฟรี (openrelay.metered.ca) + TURN เองถ้าตั้ง env `TURN_URL/USER/PASS` |
| `POST /api/session/start` | `{name}` | `{sessionId}` | เริ่มนับเวลา |
| `POST /api/session/end` | `{sessionId, usageSeconds}` | `{ok:true}` | จบ session ปกติ |
| `POST /api/session/end-beacon` | `{sessionId, usageSeconds}` | 204 no content | สำหรับ `navigator.sendBeacon` ตอนปิดแท็บ |
| `GET /api/sessions` | — | array ของ session (≤200 แถวล่าสุด) | ไม่มี auth ป้องกัน |
| `POST /api/detect` | raw JPEG | array กล่อง detection หรือ `[]` | proxy ไป `yolo_server.py:5001` |

**ไม่มีในโค้ดปัจจุบัน** (เคยมีในเวอร์ชันก่อน): `POST /api/translate` (ฟีเจอร์แปลภาษาถูกถอดออกทั้งหมด — commit `5d0fa0e`/`2f24ced`), `POST /api/stt-correct` (AI speech correction — commit `ee76bed`/`9bfec32`/`01a856a`) — ทั้งสอง endpoint ยังปรากฏใน `videocall/CLAUDE.md` แต่เป็นเอกสารเก่าที่ยังไม่ได้อัปเดต ไม่มีอยู่จริงใน `server.js`/`app.js` ปัจจุบัน

---

## 6. Socket.IO — Signaling & Chat Relay

Path เริ่มต้น (`/socket.io/`), CORS เปิดกว้าง (`origin: '*'`), transports `['websocket', 'polling']`, `destroyUpgrade: false` (ปล่อยให้ `/ws/mqtt` upgrade ผ่านไปหา MQTT proxy ได้)

| Event (client → server) | payload | server ทำอะไร |
|---|---|---|
| `join-room` | `roomId` (string) | ออกจากห้องเดิมทั้งหมด, join ห้องใหม่, ตอบกลับผู้ join เอง (`room-joined`) พร้อมรายชื่อ peer เดิม, broadcast `peer-joined` ให้คนอื่นในห้อง |
| `signal` | `{to, signal}` | relay WebRTC offer/answer/ICE candidate ไปหา socket id `to` ตรงๆ |
| `chat-message` | `{roomId, message}` | broadcast ให้ทุกคนในห้อง (ไม่รวมตัวเอง) — fallback เมื่อ data channel ยังไม่เปิด |
| `peer-tts` | `{roomId, enabled}` | broadcast สถานะเปิด/ปิดเสียงอ่านข้อความให้ peer รู้ |

| Event (server → client) | payload | ใช้ทำอะไร |
|---|---|---|
| `room-joined` | `{roomId, peers[]}` | เริ่ม `startCall(pid, true)` กับ peer เดิมทุกคน (เป็น initiator) |
| `peer-joined` | `peerId` | เริ่ม `startCall(peerId, false)` (รอรับ offer) |
| `signal` | `{from, signal}` | ส่งต่อเข้า `RTCPeerConnection` ที่ถูกต้อง |
| `peer-left` | `peerId` | cleanup peer connection, รีเซ็ต `peerTTSEnabled`, แสดงสถานะ "กำลังรอ" อีกครั้งใน `/face` |
| `chat-message` | `{from, message}` | แสดงในแชท + พูดออกเสียงถ้า peer TTS เปิดอยู่ |
| `peer-tts` | `{enabled}` | sync สถานะเสียงกับ peer |

---

## 7. MQTT — การควบคุมหุ่นยนต์จริง

### 7.1 เส้นทางเชื่อมต่อ (browser)
```
Browser  --wss://<host>/ws/mqtt-->  server.js proxy (WebSocket upgrade handler, net.createConnection)
                                          │
                                          ▼
                                   Mosquitto (local, mosquitto-local.conf) :9001
```
- URL ที่ browser ใช้จริง (derive อัตโนมัติจาก URL ปัจจุบัน, ไม่ persist): `wss://<host>/ws/mqtt`
- ตั้งค่าเองได้ที่ Settings → MQTT Broker URL + Topic (ค่าเริ่มต้น topic ควบคุม: `robot/control`)
- Client library: `mqtt.js` (CDN `unpkg.com/mqtt@5`)

### 7.2 Mosquitto — ตอนนี้รันในเครื่อง (LAN) ไม่ใช่ public broker แล้ว
`mosquitto/mosquitto-local.conf` — พอร์ตที่เปิดฟัง:

| พอร์ต | โปรโตคอล | ใช้กับ |
|---|---|---|
| `1883` | plain MQTT TCP | `deep.py` (root, LAN client ต่อ Arduino) |
| `9001` | plain WebSocket | `server.js` proxy `/ws/mqtt` (browser ใช้ผ่าน proxy นี้) |
| `9443` | WSS (encrypted) | เชื่อมตรงจาก browser แบบเข้ารหัส (ต้องมี cert — auto-gen โดย `generateMqttCerts()`) |

รันด้วย `start-local.bat` ซึ่งเรียก `mosquitto.exe -c mosquitto-local.conf` (ต้องติดตั้ง Mosquitto สำหรับ Windows แยกต่างหาก, path ที่คาดหวัง: `C:\Program Files\Mosquitto\mosquitto.exe`)

⚠️ **ข้อควรระวังที่บันทึกไว้ใน `deep.py` เอง** ([deep.py:13-17](deep.py#L13-L17)): ถ้าเครื่องมี Mosquitto Windows service ติดตั้งแยกต่างหากที่ bind `127.0.0.1:1883` ไว้ด้วย จะชนกับ instance ของ `start-local.bat` — ต้อง `net stop mosquitto` แล้วตั้งเป็น Manual ถ้าจะรันแบบถาวร

### 7.3 Topics
| Topic | ทิศทาง | เนื้อหา |
|---|---|---|
| `robot/control` (หรือ topic ที่ตั้งใน Settings) | subscribe เท่านั้น (ฟัง client อื่นที่อาจ publish มา) | frame เดี่ยว `{Head,Mouth,Analog}` |
| `robot/emotion` | publish จาก joystick/D-pad (throttled) และ publish จาก AI response (`publishEmotion()`) — array ของ frame | ทั้ง live control และ AI emotion sequence ใช้ topic เดียวกันนี้ |

Browser subscribe ทั้งสอง topic พร้อมกัน (`connectMQTT()`) — แยกจัดการด้วย `applyRobotPayload()` (frame เดี่ยว, ทันที) กับ `playEmotionSequence()` (array, เล่นเรียง 800ms/frame) โดยเช็คว่า payload string ขึ้นต้นด้วย `[` หรือไม่เพื่อแยกสอง case

**กัน jitter ระหว่าง data channel กับ MQTT** ([app.js:641-649](videocall/public/app.js#L641-L649)): เมื่อมี WebRTC data channel เปิดอยู่ (สดกว่า, full-rate) โค้ดจะ**ข้าม**ข้อความ `robot/emotion` ที่เป็น frame เดี่ยว (ไม่ใช่ array) จาก MQTT ทิ้งไป — ป้องกันหน้าหุ่น 3D กระตุกสลับตำแหน่งเก่า/ใหม่ ส่วน AI emotion sequence (array) ยังเล่นจาก MQTT ตามปกติเสมอ

### 7.4 Publish throttling (ใหม่)
Joystick ลากได้ 60+ Hz แต่ path MQTT→`deep.py`→Arduino รับไม่ไหว (บวม backlog, หุ่นสะดุด) — `publishRobotStateMQTT()` throttle การ publish ไป `robot/emotion` ให้เหลือ ~15Hz (`MQTT_PUBLISH_GAP_MS = 66`) แบบ trailing-edge (เฟรมล่าสุดก่อนปล่อยเสมอถูกส่งจริง) ส่วน WebRTC data channel (`sendToPeer`) และ local 3D preview ไม่ผ่าน throttle นี้ — ยังคงอัตราเต็ม

### 7.5 Wire format
```json
{ "Head": 45, "Mouth": 30, "Analog": { "x": 0.0, "y": 0.0 } }
```
| Field | ช่วงค่า | ความหมาย |
|---|---|---|
| `Head` | โหมด `person`: **0–80 (กลาง=40)** · โหมดอื่น: 20–100 (กลาง≈65) | องศา servo หันหัว — **person mode มีช่วงค่าและจุดกลางต่างจากโหมดอื่น**, encode/decode ต้องเช็ค `state.mode === 'person'` ทุกจุด ([app.js:579](videocall/public/app.js#L579), [app.js:706-709](videocall/public/app.js#L706-L709)) |
| `Mouth` | 20–150 (คำนวณจาก `mouthOpen` 0-1 × 130 + 20) | Servo ปาก (20=หุบ, 150=อ้า/ยิ้ม) |
| `Analog.x` | -1..1 | ตาซ้าย-ขวา |
| `Analog.y` | -1..1 | ตาบน-ล่าง |

Array `[frame1, frame2, ...]` = เล่นเรียงกัน ห่างกัน 800ms ในเบราว์เซอร์ (ฝั่ง `deep.py` รอสัญญาณ `"RUN COMPLETE"` จาก Arduino แทน)

### 7.6 ฝั่งฮาร์ดแวร์จริง — `deep.py` (root) เวอร์ชันล่าสุด
```
Mosquitto local (1883) → deep.py (root, LAN client) → Arduino (Serial, COM3 default) → Servo หุ่น InMoov
```
โค้ดปัจจุบันต่างจากเวอร์ชันก่อนหน้าอย่างมาก:

- **BROKER = `192.168.1.146`** (LAN IP ของเครื่องที่รัน Mosquitto ผ่าน `start-local.bat`) ไม่ใช่ `test.mosquitto.org` แบบเดิมอีกแล้ว — ค่านี้ hardcode ไว้ ต้องแก้เองถ้า IP เครื่องเปลี่ยน
- **Subscribe ทั้ง `robot/emotion` และ `robot/control`** (เดิม subscribe แค่ topic เดียว)
- **Command coalescing** ([deep.py:83-142](deep.py#L83-L142)): มี worker thread แยกอ่านคำสั่งล่าสุดเท่านั้น (`_pending`) ทิ้งคำสั่งเก่าที่ยังไม่ส่งถ้ามีคำสั่งใหม่มาซ้อน — แก้ปัญหาหุ่นสะดุดจากการ execute ทุกเฟรมที่ browser ส่งมาถี่ๆ
- แยก timeout สำหรับ live frame เดี่ยว (`LIVE_FRAME_TIMEOUT = 1.0`s, ไม่ warn ถ้า timeout) กับ AI emotion sequence (`SEQUENCE_FRAME_TIMEOUT = 30`s, warn ถ้า timeout) — sequence ที่กำลังเล่นอยู่จะถูกขัดจังหวะทันทีถ้ามีคำสั่งใหม่ (เช่น operator จับจอยสติ๊ก) เข้ามาระหว่างเล่น
- `videocall/deep.py` เป็นเวอร์ชันเก่ากว่ามาก (BROKER=`localhost`, subscribe topic เดียว, ไม่มี coalescing) — **ไม่ใช่ตัวที่ใช้งานจริงแล้ว**, root `deep.py` คือตัวที่ต้องรัน

---

## 8. WebRTC — วิดีโอคอล

- **ICE servers:** STUN ของ Google (2 เซิร์ฟเวอร์) + STUN/TURN ฟรีจาก `openrelay.metered.ca` (3 รายการ) + TURN ของผู้ใช้เอง (Settings หรือ env `TURN_URL/USER/PASS`) — ดึงจาก `GET /api/ice-config`
- **Data channel** ชื่อ `'chat'` สร้างโดยฝั่ง initiator (คนที่ join ห้องทีหลัง) ก่อนสร้าง offer เสมอ ใช้ส่งทั้งข้อความแชทและคำสั่งควบคุมหุ่น (แยกกันด้วยการเช็ค JSON `{Head,Mouth,Analog}` ก่อนตีความเป็นแชท ผ่าน `applyRobotPayload()`)
- **Audio transceiver** จองไว้ล่วงหน้าเสมอตั้งแต่สร้าง `RTCPeerConnection` เพื่อให้ mute/resume ไมค์ระหว่าง STT (§3.4) ทำผ่าน `replaceTrack()` ได้โดยไม่ต้อง renegotiate SDP — โค้ดนี้ **ไม่มี `onnegotiationneeded` handler** เลย ห้ามเพิ่ม track ชนิดใหม่หลัง offer/answer แรกโดยไม่จองล่วงหน้าแบบนี้
- `oniceconnectionstatechange` → auto `pc.restartIce()` เมื่อ state เป็น `failed`, แสดงสถานะ "การเชื่อมต่อขาดหาย…" เมื่อ `disconnected`
- ห้องเริ่มต้น (auto-join ถ้าไม่ระบุเอง): `FACE`

---

## 9. Frontend — โครงสร้างไฟล์และ Library (`videocall/public/`)

| ไฟล์ | หน้าที่ |
|---|---|
| `index.html` | Markup ทั้งหมด (login, header, video stage, chat, robot panel, joystick/D-pad, modals) — SPA เดียว ไม่มี router |
| `app.js` | Logic ทั้งหมด (~2070 บรรทัด) vanilla JS `'use strict'`, ES2020, ไม่มี framework |
| `style.css` | CSS ทั้งหมด, CSS custom properties เป็น design token |
| `robot-viewer.js` | Three.js wrapper โหลด/ขยับโมเดล URDF หน้าหุ่น (scale factor `0.1196`, joint mapping สำหรับ head/jaw/eyes) |
| `robot/head.urdf` + `meshes/` | โมเดล 3D หน้าหุ่น (STL meshes) |
| `face/index.html` | หน้าคงที่แยกต่างหาก (ไม่ใช่เส้นทางที่ server ใช้จริง — server serve `public/index.html` ให้ path `/face` ผ่าน route handler แทน) |

**Library ภายนอก (CDN, ไม่มี npm bundle ฝั่ง client):**
- `mqtt@5` — MQTT client
- `three@0.134.0` + `STLLoader` + `OrbitControls` — render โมเดล 3D
- `/socket.io/socket.io.js` — เสิร์ฟจาก server เอง (ไม่ใช่ CDN)

**State หลักใน `app.js`:**
```js
state       = { mode: 'ai'|'person'|'robot', micOn, camOn, speechOn, localStream, aiTyping }
robotState  = { analogX, analogY, headAngle, mouthOpen, padDir }
settings    = { showAiMode, showDetectButton, showTimingLog, dpadSpeed,
                provider, model, sttMode, ttsEnabled, mqttUrl, ... }  // persist ใน localStorage key 'vc_settings'
peers       = { [peerId]: { pc, dc, audioSender } }
```

`DEFAULT_SETTINGS.showAiMode = false` และ `showDetectButton = false` — สองฟีเจอร์นี้ (AI mode, YOLO toggle button) เป็นของที่ตั้งใจซ่อนจาก operator ทั่วไป เปิดได้เฉพาะคนที่เข้าไปกดใน Settings เอง

---

## 10. Backend — Dependencies (`videocall/package.json`)

| Package | ใช้ทำอะไร |
|---|---|
| `express` | HTTP server + REST routing + static file serving |
| `socket.io` | Signaling + chat relay |
| `better-sqlite3` | เก็บ session log (synchronous SQLite) |
| `selfsigned` | สร้าง self-signed TLS cert (ทั้งเว็บ HTTPS dev และ Mosquitto WSS) |

ต้องการ **Node.js 18+** (ใช้ native `fetch`/`FormData`/`File`)

---

## 11. Environment / Config

| ตัวแปร/ไฟล์ | ใช้ทำอะไร | บังคับไหม |
|---|---|---|
| `../apikey` (นอก `videocall/`) | AI provider keys รูปแบบ `Provider: key` | ไม่บังคับ — ไม่มีก็ใช้วิดีโอคอลได้ปกติ แค่ AI mode ใช้ไม่ได้ |
| `GROQ_API_KEY`, `OPENROUTER_API_KEY`, `GEMINI_API_KEY`, `9ARM_KEY`/`NINEARM_KEY` | env var fallback ของ key ข้างบน | ไม่บังคับ |
| `DB_PATH` | path ของไฟล์ SQLite (default `videocall.db` ใน `videocall/`) | ไม่บังคับ |
| `NODE_ENV=production` | สลับโหมด server จาก self-signed HTTPS dev → plain HTTP (ให้ cloud platform/tunnel ทำ TLS แทน) — **`start-local.bat` ตั้งค่านี้เสมอ** แม้รันในเครื่อง เพราะใช้ Cloudflare Tunnel ทำ HTTPS ให้ | ไม่บังคับ |
| `PORT` / `PORT_HTTP` / `PORT_HTTPS` | เปลี่ยนพอร์ต (default: prod `3000`, dev HTTP `3000`→redirect HTTPS `3443`) | ไม่บังคับ |
| `TURN_URL`, `TURN_USER`, `TURN_PASS` | เพิ่ม TURN server ของตัวเองใน ICE config | ไม่บังคับ |
| `videocall/.ssl/` | self-signed cert ของเว็บ HTTPS dev mode (auto-gen ครั้งแรก) | auto |
| `mosquitto/certs/` | self-signed cert ของ Mosquitto WSS :9443 (auto-gen ครั้งแรก) | auto |

---

## 12. รันเองบนเครื่อง (Local Dev) — `start-local.bat`

วิธีรันจริงที่ใช้อยู่ตอนนี้ไม่ใช่แค่ `node server.js` ธรรมดาแล้ว — `start-local.bat` (root) ทำ 4 ขั้นตอนอัตโนมัติ:

1. เช็ค `node` และ `cloudflared` ต้องมีใน PATH ก่อน (ถ้าไม่มี `cloudflared`: `winget install Cloudflare.cloudflared`)
2. `npm install` ใน `videocall/` ถ้ายังไม่มี `node_modules`
3. เริ่ม **Mosquitto local** (`C:\Program Files\Mosquitto\mosquitto.exe -c mosquitto\mosquitto-local.conf -v`) — เปิด 1883/9001/9443
4. เริ่ม **Node.js server** ใน `videocall/` ด้วย `NODE_ENV=production PORT=3000 node server.js`
5. ถามว่าจะเริ่ม **YOLO server** ด้วยไหม (`python yolo_server.py`, พอร์ต 5001)
6. เริ่ม **Cloudflare Tunnel** (`cloudflared tunnel --url http://localhost:3000`) — ได้ URL สาธารณะ `*.trycloudflare.com` ที่ MQTT ก็ทำงานผ่าน URL เดียวกันนี้ที่ path `/ws/mqtt` โดยอัตโนมัติ

ถ้าจะรันแบบ manual ทีละส่วนแทน:
```bash
cd videocall
npm install
node server.js          # https://localhost:3443 (dev, self-signed cert)
```
รันแยกถ้าต้องการฟีเจอร์เสริม:
- `python yolo_server.py` — YOLO detection (พอร์ต 5001)
- Mosquitto broker (ดู `mosquitto/mosquitto-local.conf`)
- `python deep.py` (root, **ไม่ใช่** `videocall/deep.py`) — เชื่อม MQTT เข้า Arduino จริง ต้องแก้ `BROKER` ใน `deep.py` ให้ตรงกับ LAN IP เครื่องที่รัน Mosquitto ก่อน (ดู §7.6)

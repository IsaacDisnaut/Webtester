# Bug Report — For4Aug / Avatar Robot Videocall

> **UPDATE 2026-07-09: ตรวจสอบซ้ำทั้งหมดอีกครั้ง (RE-VERIFIED) — fix ทั้ง 7 บั๊กยังอยู่ครบในโค้ดปัจจุบัน, การทดสอบทั้งหมดผ่าน (269/269 round-trip + live server smoke test), และสแกน diff ที่แก้หลังรายงานเดิม (~870 บรรทัด) ไม่พบบั๊กใหม่ — ดูหลักฐานในหัวข้อ "Re-verification (2026-07-09)" ท้ายไฟล์**
>
> **UPDATE 2026-07-07: ทุกบั๊กในรายงานนี้ถูกแก้แล้ว (ALL FIXED) — ดูสถานะใต้หัวข้อแต่ละบั๊ก และหัวข้อ "Fix verification" ท้ายไฟล์**

- **Date:** 2026-07-07
- **Scope reviewed:** `videocall/server.js`, `videocall/public/app.js`, `deep.py` (root), `videocall/deep.py`, `yolo_server.py`, `start-local.bat`
- **สรุปภาษาไทย:** พบบั๊กหลัก 1 จุดคือ ฝั่ง operator (โหมด Person) เข้ารหัสมุมหัวโดยใช้จุดกึ่งกลาง 40 แต่ฝั่งจอหุ่นยนต์ (/face ซึ่งอยู่ในโหมด robot) ถอดรหัสด้วยจุดกึ่งกลาง 65 — ทำให้หัวหุ่น 3D บนจอ /face เอียงซ้ายผิดไป 25° ตลอดเวลา นอกจากนี้ยังมีปัญหาช่วงค่า Mouth เกินสเปกเซอร์โว, `/api/stt` พังบน Node 18, และ IP ที่ฮาร์ดโค้ดใน deep.py

---

## BUG-1 (HIGH) — Head angle decoded with the wrong center on the /face kiosk

> ✅ **FIXED** — introduced canonical wire constants `WIRE_HEAD_BASE=40` (range 0–80) and `WIRE_MOUTH_MIN=30`/`MAX=100` in `app.js`; both `publishRobotState()` and `applyRobotPayload()` now use them, so encode/decode no longer depends on either side's UI mode. Verified with a round-trip test (operator person-mode encode → kiosk robot-mode decode) across the full head/mouth range — exact match everywhere.

**Files:**
- Encode: `videocall/public/app.js:703-709` (`publishRobotState`)
- Decode: `videocall/public/app.js:579` (`applyRobotPayload`)

**What happens:**
`publishRobotState()` picks the wire encoding base from the **sender's** mode:

```js
const headBase = person ? 40 : 65;          // operator UI is 'person' → 40
```

but `applyRobotPayload()` picks the decoding base from the **receiver's** mode:

```js
robotState.headAngle = data.Head - (state.mode === 'person' ? 40 : 65);
```

The operator controls the robot from **Person mode** (base 40, Head clamped 0–80), while the `/face` kiosk display runs in **robot mode** (base 65). Every live joystick/D-pad frame the operator sends is therefore decoded 25° off on the kiosk:

- Operator centers the head → sends `Head: 40` → kiosk computes `40 − 65 = −25°`.
- Operator turns fully right → sends `Head: 80` → kiosk shows only `+15°`.

**Impact:** The 3D robot face shown to the customer on `/face` is permanently skewed ~25° left of what the operator commands, over both the WebRTC data channel and the MQTT fallback. The same asymmetry corrupts the reverse path: AI emotion frames (encoded around center 65 by `publishEmotion`) are decoded with base 40 if the receiver happens to be in Person mode.

**Suggested fix:** The wire format must not depend on either side's UI mode. Pick one canonical center (e.g. 65 to match the Arduino wire format documented in `videocall/CLAUDE.md`) for both encode and decode, and do any person-mode clamping only on `robotState.headAngle` before encoding — or include the base/mode in the payload so the receiver can decode correctly.

---

## BUG-2 (MEDIUM) — Wire-format range inconsistencies (Mouth up to 150; two different Head centers on the same MQTT topic)

> ✅ **FIXED** — one wire spec everywhere: Head 0–80 (center 40), Mouth 30–100. `publishRobotState`, `publishEmotion`, and `applyRobotPayload` all clamp with the shared `WIRE_*` constants; the default AI system prompt now instructs the same ranges (`{"Head":40,...}`, "Head 0-80, 40=center"), with a localStorage migration that replaces stale saved prompts still using the old 20–100/45 format. The wire-format table in `videocall/CLAUDE.md` was updated to match. Verified: emotion frames with `Head:150, Mouth:150, Analog.x:5` clamp to `80/100/1` before publishing, and out-of-range incoming frames clamp on decode.

**Files:** `videocall/public/app.js:710` (`publishRobotState`), `app.js:1552-1558` (`publishEmotion`), `deep.py` → Arduino

**What happens:**
- `publishRobotState()` encodes `Mouth = 20 + mouthOpen * 130`, so a fully-open mouth sends **Mouth: 150**. The documented servo range (and the clamp used in `publishEmotion`) is **30–100**. The Arduino receives out-of-range values from live control but never from AI emotions.
- The same MQTT topic `robot/emotion` carries live frames encoded with head center **40** (Person mode) *and* AI emotion frames clamped around center **65** (`publishEmotion` clamps Head to 20–150 with default 65). `deep.py` forwards both verbatim, so the physical head centers at two different positions depending on which path produced the frame.

**Impact:** Physical robot can be driven outside its servo limits (Mouth > 100) and the head "center" jumps by 25 servo-degrees between joystick control and AI emotion playback.

**Suggested fix:** Define one wire spec (center + min/max per field), clamp in a single shared encode function used by both `publishRobotState` and `publishEmotion`, and optionally clamp defensively in `deep.py` before writing to serial.

---

## BUG-3 (MEDIUM) — `/api/stt` crashes on Node 18 (`File` is not defined)

> ✅ **FIXED** — replaced `new File(...)` with `new Blob(...)` + filename argument to `formData.append`, which works on Node 18+. Verified by POSTing to `/api/stt` on a live server: the request travels the full Blob→FormData→Groq path and returns Groq's own 400 for invalid audio (no crash in our code).

**File:** `videocall/server.js:127`

```js
formData.append('file', new File([req.body], `audio.${ext}`, { type: mimeType }));
```

The file header says "Node.js 18+ required for native fetch", but the global `File` constructor only became available in **Node 20** (experimental in 19.2). On Node 18 every Whisper STT request throws `ReferenceError: File is not defined` and returns HTTP 500, so voice transcription silently never works.

**Suggested fix:** Either bump the requirement to Node 20+ (README/comment + `package.json` `engines`), or use `new Blob([req.body], { type: mimeType })` with `formData.append('file', blob, 'audio.' + ext)`, which works on Node 18.

---

## BUG-4 (MEDIUM) — Hardcoded LAN IP in root `deep.py`

> ✅ **FIXED (partially by design)** — broker/port/serial port now read from env vars `MQTT_BROKER`, `MQTT_PORT`, `ROBOT_SERIAL_PORT`; the current LAN IP is kept as the default so the existing setup keeps working unchanged. Also added a connect-retry loop so the bridge no longer dies if the broker isn't up yet. The *permanent* fix (stop the duplicate Mosquitto Windows service) still needs to be done manually as described below.

**File:** `deep.py:18`

```python
BROKER = "192.168.1.146"   # LAN IP — reaches the web app's broker, not the loopback service
```

The bridge breaks as soon as DHCP hands the machine a different address (or the script runs on another machine). The comment explains this is a workaround for a duplicate Mosquitto Windows service hijacking `127.0.0.1:1883` — but the workaround makes the setup silently machine-specific.

**Suggested fix:** Read the broker from an env var / CLI arg with a sane default (`os.environ.get("MQTT_BROKER", "localhost")`), and apply the permanent fix already noted in the comment (`net stop mosquitto`, set the duplicate service to Manual). Also note `client.connect()` at `deep.py:170` raises and kills the script if the broker is down — a retry loop would make the bridge more robust.

---

## BUG-5 (LOW) — Custom system prompt is silently discarded on every reload

> ✅ **FIXED** — `loadSettings()` no longer force-resets `systemPrompt`; a user-edited prompt now survives reloads. Prompts saved before this fix that still contain the old default ranges (`Head 20-100` / `"Head":45`) are auto-migrated to the new default so stale wire instructions don't persist.

**File:** `videocall/public/app.js:193-204` (`loadSettings`)

```js
return { ...DEFAULT_SETTINGS, ...saved, systemPrompt: DEFAULT_SETTINGS.systemPrompt, ... };
```

The Settings modal exposes a System Prompt textarea and saves it to `localStorage`, but `loadSettings()` unconditionally overwrites it with the default on the next page load. The user believes their edit persisted; it silently reverts.

**Suggested fix:** Either persist the user's prompt, or make the field read-only / remove it from the modal so the UI matches the actual behavior.

---

## BUG-6 (LOW) — `mqttTopic` setting is ignored on the publish path

> ✅ **FIXED** — live control frames now publish to `settings.mqttTopic` (default `robot/control`) via `liveControlTopic()`; AI emotion sequences keep the fixed `robot/emotion` topic. The MQTT message handler was unified so the "skip stale MQTT copy when a data channel is open" logic applies to live frames on *any* topic. Note: root `deep.py` already subscribes to both topics; if you change the topic in Settings, change it on both the operator and kiosk browsers.

**File:** `videocall/public/app.js:687`, `app.js:696`, `app.js:1563` (all publish hardcoded `'robot/emotion'`) vs `app.js:636` (subscribes `settings.mqttTopic`)

Changing "MQTT Topic" in Settings only changes what the browser *subscribes* to (default `robot/control`); every publish still goes to the hardcoded `robot/emotion`. Setting a custom topic therefore has no effect on control output and can mislead debugging.

---

## BUG-7 (LOW) — Single-frame emotion arrays lose sequence flow-control in `deep.py`

> ✅ **FIXED** — `is_sequence = isinstance(cmd, list)` in both `deep.py` and `videocall/deep.py`.

**File:** `deep.py:127` (`serial_worker`)

```python
is_sequence = len(frames) > 1
```

`publishEmotion` always publishes a JSON **array**, even for one frame. A one-frame AI emotion `[{...}]` is treated as a "live" frame (1 s wait, no timeout warning) instead of a sequence frame (30 s wait). A long single motion can be cut into by the next command before the Arduino reports `RUN COMPLETE`.

**Suggested fix:** `is_sequence = isinstance(cmd, list)`.

---

## Minor notes

- ✅ removed — dead `_origEndCall` code at the bottom of `app.js`.
- ✅ removed — dead client-side `conf < 0.5` filter in the detect loop (server already filters at 0.60).
- ⏳ open — `videocall/server.js` session endpoints accept any `sessionId` without auth; harmless locally, worth revisiting before public deployment.
- ⏳ open — two copies of the serial bridge exist (`deep.py` and `videocall/deep.py`); the `is_sequence` fix was applied to both, but consider deleting the older `videocall/deep.py`.
- ⏳ open (docs-only) — `videocall/CLAUDE.md` still documents `/api/translate` and `/api/stt-correct` endpoints that don't exist in `server.js`. **2026-07-09: ยืนยันว่าไม่ใช่บั๊ก runtime แล้ว** — frontend (`app.js`) ไม่มีการเรียกสอง endpoint นี้เหลืออยู่เลย (grep `api/translate|api/stt-correct` = 0 matches) จึงเป็นแค่เอกสารล้าสมัย ไม่มีโค้ดพัง. หมายเหตุเพิ่ม: CLAUDE.md ยังอธิบาย `publishRobotState` ด้วย wire format เก่า (65/20-150) และ `loadSettings` แบบ reset systemPrompt — ล้าสมัยเช่นกัน.

---

## Fix verification (2026-07-07)

All checks run after the fixes, on Node v24.14.1:

1. **Syntax / compile** — `node --check` passes on `server.js` and `app.js`; `python -m py_compile` passes on both `deep.py` files.
2. **Wire-format round-trip test** — a test harness extracts the *real* `applyRobotPayload`, `publishRobotState`, and `publishEmotion` functions from `app.js` and simulates operator (person mode) → kiosk (robot mode). **68/68 assertions pass**: head −40°…+40° and mouth 0…1 round-trip exactly; AI emotion frames clamp to Head ≤ 80 / Mouth ≤ 100 / |Analog| ≤ 1; out-of-range incoming frames clamp on decode; plain chat text and non-robot JSON are still rejected (data-channel chat/robot discrimination unchanged).
3. **Live server smoke test** — booted `server.js` (production mode, isolated test DB): `/api/provider-defaults`, `/api/ice-config`, `/api/session/start|end`, `/api/sessions`, `/`, `/face`, `/app.js` all return correct responses; `/api/stt` executes the new Blob upload path end-to-end (Groq correctly rejects garbage audio with its own 400 — no crash in our code); `/api/detect` returns `[]` gracefully with the YOLO server offline.

**Not covered (needs hardware):** physical Arduino motion with the canonical 0–80 head range. Person-mode joystick already sent 0–80 before this fix, so live control behavior on the robot is unchanged — but AI emotion sequences previously could send Head 20–150 and now send 0–80. Watch the first few AI animations on the real robot to confirm the servo centering looks right.

---

## Re-verification (2026-07-09)

ตรวจสอบซ้ำทั้งหมดหลังโค้ดมีการแก้ไขเพิ่มเติม (Robot tab ถูก merge เข้า Person, เพิ่ม keyboard controls, mobile mic pause/resume, MQTT throttle, Thai localization ฯลฯ) เพื่อยืนยันว่า fix เดิมไม่ถูกทำหาย และไม่มีบั๊กใหม่. Environment: Node v24.14.1, Python 3.10.11, Windows 11.

### 1. Fix ทั้ง 7 บั๊กยังอยู่ในโค้ดปัจจุบัน (ตรวจทีละจุด)

| Bug | หลักฐานในโค้ดปัจจุบัน |
|---|---|
| BUG-1 | `WIRE_HEAD_BASE=40` / `WIRE_MOUTH_MIN=30` / `MAX=100` ประกาศที่ `app.js:612-613`; decode ใช้ WIRE_* ที่ `app.js:621-622` (`applyRobotPayload`) และ encode ใช้ตัวเดียวกันที่ `app.js:750-751` (`publishRobotState`) — ไม่มีการอ้าง `state.mode` ในทั้งสอง path อีกแล้ว |
| BUG-2 | `publishEmotion` clamp ด้วย WIRE_* เดียวกันที่ `app.js:1599-1600`; encode ฝั่ง live ก็ clamp ที่ `app.js:750-751`; default system prompt ระบุ `Head 0-80, 40=center` แล้ว |
| BUG-3 | `server.js:128` ใช้ `new Blob([req.body], ...)` + filename argument (ไม่มี `new File` เหลือในไฟล์ — grep พบ Blob จุดเดียว) |
| BUG-4 | `deep.py:20-23` อ่าน `MQTT_BROKER` / `MQTT_PORT` / `ROBOT_SERIAL_PORT` จาก env; connect-retry loop อยู่ที่ `deep.py:178-184` (retry ทุก 5 วิ ไม่ตายถ้า broker ยังไม่ขึ้น) |
| BUG-5 | `app.js:200-204` — `loadSettings()` persist `systemPrompt` ของผู้ใช้ พร้อม migration ลบ prompt เก่าที่ยังมี `Head 20-100`/`"Head":45` |
| BUG-6 | `liveControlTopic()` ที่ `app.js:724` คืน `settings.mqttTopic`; publish live frame ใช้มันที่ `app.js:731,740`; AI emotion ยังใช้ `robot/emotion` คงที่ (`app.js:1609`); `deep.py:29` subscribe ทั้ง `robot/emotion` และ `robot/control` |
| BUG-7 | `is_sequence = isinstance(cmd, list)` ที่ `deep.py:131` และ `videocall/deep.py:121` |

### 2. Syntax / compile

- `node --check videocall/server.js` และ `node --check videocall/public/app.js` → ผ่าน
- `python -m py_compile deep.py videocall/deep.py` → ผ่าน

### 3. Wire-format round-trip test — **269/269 assertions ผ่าน**

Test harness (สร้างใหม่สำหรับรอบนี้) ดึงฟังก์ชัน *จริง* `applyRobotPayload`, `publishRobotState`, `publishEmotion` + ค่าคงที่ `WIRE_*` ออกจาก `app.js` ปัจจุบันด้วย brace-parser แล้วรันใน sandbox:

1. **Round-trip เต็มช่วง** — operator encode → kiosk decode ทุกคู่ค่า head −40..+40 (step 5) × mouth 0/0.25/0.5/0.75/1: head ตรงเป๊ะทุกค่า, mouth คลาดเคลื่อน < 0.01 (การปัดเศษ servo degree) — 255 assertions
2. **Encode clamping** — state เกินช่วง (headAngle 500 / mouthOpen 5 และค่าติดลบ) → wire ออกมาไม่เกิน Head 0–80, Mouth 30–100 เสมอ
3. **publishEmotion clamping** — frame AI `{"Head":150,"Mouth":150,"Analog":{"x":5,"y":-5}}` → clamp เป็น `80/100/±1` ก่อน publish ไป `robot/emotion` และ publish เป็น JSON array เสมอ
4. **Decode clamping** — frame ขาเข้าเกินช่วง (`Head:200, Mouth:300, Analog ±9`) → clamp เป็น `+40 / 1.0 / ±1`
5. **Payload discrimination** — ข้อความแชทธรรมดา และ JSON ที่ไม่ใช่คำสั่งหุ่น ถูก reject (ไม่โดนกินเป็นคำสั่งหุ่น); JSON หุ่นถูก accept

### 4. Live server smoke test (production mode, isolated test DB)

| ตรวจ | ผล |
|---|---|
| `GET /api/provider-defaults`, `/api/ice-config`, `/`, `/face`, `/app.js` | ทั้งหมด HTTP 200 |
| `POST /api/session/start` → `end` → `GET /api/sessions` | สร้าง row, อัพเดท `usage_seconds:7`, อ่านกลับได้ครบ (`{"id":1,"name":"bugreport-verify",...}`) |
| `POST /api/stt` (ไฟล์เสียงขยะ) | คำขอวิ่งผ่าน Blob→FormData→Groq เต็ม path — Groq ตอบ 400 `"could not process file"` เอง = **ไม่มี crash `File is not defined` ในโค้ดเรา** (BUG-3 ยืนยันแบบ live) |
| `POST /api/detect` (YOLO server ปิดอยู่) | ตอบ `[]` + HTTP 200 อย่างสุภาพ ไม่ error |

### 5. สแกนโค้ดที่แก้หลังรายงานเดิม — ไม่พบบั๊กใหม่

รีวิว diff ที่ยังไม่ commit ทั้งหมด (~870 บรรทัดใน `app.js`, `deep.py`, `server.js`, `index.html`, `style.css`): keyboard controls (Arrow/WASD/Alt), mobile mic release/reacquire ผ่าน reserved audio transceiver (`replaceTrack` ไม่ต้อง renegotiate), MQTT publish throttle ~15 Hz แบบ trailing-edge, command coalescing + `drain_serial()` ใน `deep.py`, modal focus trap, `/face` waiting status, remote video rotation — ทั้งหมดสอดคล้องกับ wire format canonical และไม่กระทบ fix เดิม. จุดเล็กที่สังเกต (ไม่ใช่บั๊ก): `connectMQTT()` ถูกเรียกซ้ำตอน boot (จาก `applyMode('person')` แล้วซ้ำจาก `initApp`) แต่ฟังก์ชันปิด client เก่าก่อนเสมอจึงไม่มีผลเสีย.

**สรุป: ณ 2026-07-09 ไม่พบบั๊กที่ยัง active ในโค้ด** — เหลือเพียงรายการ ⏳ ใน "Minor notes" ซึ่งเป็นเรื่อง hardening ก่อน deploy จริง / เอกสารล้าสมัย / โค้ดซ้ำซ้อน ไม่ใช่ defect ที่ทำงานผิด และการทดสอบกับ Arduino จริง (servo centering ของ AI animation) ยังต้องดูหน้างานตามหมายเหตุด้านบน.

---

## รอบเพิ่มฟีเจอร์ Light/Dark mode — ตรวจบั๊ก + การเข้าถึงผู้พิการ (2026-07-27)

- **Scope:** ฟีเจอร์ธีมสี Light (ค่าเริ่มต้น) / Dark ที่เพิ่มใน `videocall/public/style.css`, `index.html`, `app.js` (ดูรายละเอียดฟีเจอร์และรีวิว accessibility เต็มใน [REVIEW.md §22](REVIEW.md))
- **วิธีตรวจ:** อ่าน diff ที่ยังไม่ commit ทั้งหมดใน 8 มุม (line-by-line, removed-behavior, cross-file, reuse/simplify/efficiency, altitude, conventions) + ไล่ตรวจ contrast ทุกจุดที่วางตัวอักษรบนพื้นที่มืดเสมอ + ยืนยันสถานะบั๊ก accessibility ที่ค้างจากรอบก่อน

### BUG-8 (HIGH — visual/accessibility) — ป้ายชื่อคู่สนทนาอ่านไม่ออกในธีม Light

> ✅ **FIXED** — บังคับ `.remote-name { color:#fff }` เพราะป้ายนี้อยู่บนพื้นวิดีโอมืด (`rgba(0,0,0,.65)`) เสมอไม่ว่าธีมไหน

**File:** [style.css:559-569](videocall/public/style.css#L559-L569) (`.remote-name`)

**สาเหตุ:** `.remote-name` ไม่ได้กำหนด `color` ของตัวเอง จึงสืบทอด `--text` จาก body การเพิ่มธีม Light เปลี่ยน `--text` จากสีอ่อน (`#e2e8f0`) เป็นสีเข้ม (`#1e293b`) ป้ายชื่อจึงกลายเป็นตัวอักษรเข้มบนพื้นดำโปร่งแสง — อ่านไม่ออกเลยในธีมค่าเริ่มต้น

**Impact:** ชื่อคู่สนทนา (เช่น "คู่สนทนา") ที่ทับมุมล่างซ้ายของวิดีโอมองไม่เห็นในธีม Light ซึ่งเป็นค่าเริ่มต้น กระทบผู้ใช้ทุกคนโดยเฉพาะสายตาเลือนราง

**การไล่ตรวจ:** ตรวจ element อื่นที่วางบนพื้นมืดเสมอแล้วสืบทอด `--text` — พบว่ามีจุดนี้จุดเดียว (`.speaking-badge`, `.face-waiting-status`, `.local-label` กำหนดสี/พื้นเข้มของตัวเองไว้แล้ว จึงไม่พัง)

### BUG-9 (MEDIUM — accessibility/contrast) — `--primary` เป็นสีตัวอักษรในธีม Light ต่ำกว่าเกณฑ์ WCAG AA

> ✅ **FIXED (2026-07-27)** — ธีม Light ใช้ `--primary: #574fd6` (~6.0:1 บนพื้นขาว, ~5.4:1 บนพื้น `#f1f5f9`, ตัวอักษรขาวบนปุ่มพื้น primary ~6.0:1 — ผ่าน AA ทุกจุด) และเพิ่ม `--primary-hover` แยกทั้งสองธีม (Light `#463dc0` / Dark `#574fd6`) แทนค่า hover ที่เคย hardcode `#574fd6` ใน `.send-btn:hover` / `.btn.primary:hover` — ไม่งั้นสี hover จะชนกับสีปุ่มปกติของธีม Light · ธีม Dark คงเฉดแบรนด์ `#6c63ff` เดิมไม่เปลี่ยน · gradient ปุ่ม login คง hardcode ไว้ตามเดิม (เป็น element ตกแต่งขนาดใหญ่ ตัวอักษร bold บนครึ่งเข้มของ gradient)

**File:** [style.css:192-232](videocall/public/style.css#L192-L232) (`:root` — ธีม Light)

**สาเหตุ:** `--primary: #6c63ff` ถูกใช้เป็น**สีตัวอักษร**หลายจุด (รหัสห้อง `.room-code-display`, ป้าย "AI", ไอคอนหัวแชท, ตัวจับเวลา session) บนพื้นสว่างของธีม Light ได้ contrast ~4.3:1 ต่ำกว่าเกณฑ์ WCAG AA 4.5:1 สำหรับตัวอักษรปกติ (ธีม Dark ไม่มีปัญหานี้เพราะพื้นมืด)

**Suggested fix:** ในบล็อก `:root` (Light) เท่านั้น ลด `--primary` ให้เข้มขึ้น เช่น `#574fd6` (~5.0:1 บนพื้นขาว, ตัวอักษรขาวบนปุ่ม primary ยังผ่าน ~5.8:1) — ไม่กระทบธีม Dark เพราะ `[data-theme="dark"]` ทับกลับเป็น `#6c63ff` หรือแยกตัวแปร `--primary-text` เฉพาะกรณีใช้เป็นตัวอักษร

### หมายเหตุการเปลี่ยนพฤติกรรม (behavior change — ไม่ใช่บั๊กจากธีมโดยตรง)

- **`speakOnDemand()` เงียบเมื่อปิดลำโพง:** ✅ **แก้แล้ว (2026-07-27)** — กด 🔊 ขณะลำโพงปิด ตอนนี้ประกาศ "ลำโพงปิดอยู่ — เปิดลำโพงเพื่อฟังข้อความ" ผ่าน screen-reader live region (คนตาดีเห็นสถานะปุ่มลำโพงสีแดงอยู่แล้ว)
- **`#chat-messages` ถอด `aria-live`:** ✅ **ปิดช่องโหว่แล้ว (2026-07-27)** — `speakPeerMessage()` ตอนนี้ fallback ไปประกาศ `ข้อความ: <เนื้อหา>` ผ่าน live region เมื่อเส้นทาง TTS ใช้ไม่ได้ (peer-TTS ปิด / ลำโพงปิด / ไม่มี speechSynthesis) — ผู้ใช้ตาบอดจึงรู้เสมอว่ามีข้อความตัวอักษรเข้ามา โดยไม่พูดซ้ำสองรอบ (TTS กับ live region ทำงานทีละทางเท่านั้น) และไม่กลับไปสู่ปัญหาเดิมที่ TalkBack อ่านทุกอย่างรัว ๆ (interim STT/AI log ไม่เข้าเส้นทางนี้)

### บั๊ก accessibility ที่เคยเปิดค้าง — แก้แล้วทั้งหมดในรอบนี้ (2026-07-27)

- 🔴 **A8/P0:** ✅ **แก้แล้ว** — `showSystemMsg()` ([app.js:1818](videocall/public/app.js#L1818)) เรียก `announceAccessibility(text)` ทุกครั้ง — error วิกฤตทั้งหมด (กล้อง/ไมค์ถูกปฏิเสธ, ICE ล้มเหลว, connect_error, Whisper/AI error, วางสาย, บันทึก Settings) ถูกประกาศต่อ screen reader แล้ว · จุดที่มีประกาศสั้นของตัวเองอยู่แล้ว (peer เข้า/ออก, เปิด auto peer-TTS ตอนเข้าโหมด) ส่ง `{ announce: false }` เพื่อไม่พูดซ้ำสองรอบ · timing log debug (`showTimingLog`) แยกฟังก์ชันอยู่แล้ว ยังเงียบตามเดิม
- 🟡 **A9:** ✅ **แก้แล้ว** — `applyMode()` sync `aria-pressed` บน `.mode-btn` ทุกปุ่ม ([app.js:528-533](videocall/public/app.js#L528-L533)) + ค่าเริ่มต้นใน HTML (`ai=true`, `person=false` ตรงกับ class `active`)
- 🟡 **A7:** ✅ **แก้แล้ว** — ปุ่มคัดลอกประกาศ "คัดลอกรหัสแล้ว" เมื่อสำเร็จ และเพิ่ม `.catch` ที่แสดง+ประกาศรหัสห้องเมื่อ clipboard ถูกบล็อก (เดิม fail เงียบ)

### แก้เพิ่มระหว่างตรวจซ้ำ (hardening)

- **`announceAccessibility()` race จากการเรียกติดกัน:** timer 30ms ที่ตั้งข้อความของการเรียกครั้งก่อนไม่เคยถูก `clearTimeout` (เก็บแค่ timer ล้าง 5 วิ) — เมื่อ A8 ทำให้มีการประกาศติดกันได้จริง (เช่น "ล็อกอินแล้ว" → welcome) จึงเก็บ timer ทั้งสองตัวใน `srSetTimers`/`srClearTimers` และยกเลิกทั้งคู่ก่อนประกาศใหม่ ([app.js:1799-1815](videocall/public/app.js#L1799-L1815))

### ยืนยันแล้ว — ไม่พบบั๊กในส่วนที่แก้ (ธีม + wire-format)

- **ธีมสลับได้จริง + ไม่มี flash:** inline `<head>` script ตั้ง `data-theme` ก่อน CSS โหลด, `applyTheme()` sync ตอนโหลด/Save, `/face` คงพื้นดำผ่าน `body.face-mode` ทับตัวแปรธีม
- **`--text-primary` fallback ที่เคยกำกวมถูกแก้:** `.dpad-btn` เดิมใช้ `var(--text-primary, #e2e8f0)` (ตัวแปรไม่เคยถูกนิยาม → fallback สีอ่อนเสมอ) ตอนนี้ใช้ `var(--pad-btn-color)` ที่ theme-aware ถูกต้อง
- **wire-format กว้างขึ้นเป็น Head 0-90 center 45 สอดคล้องกันครบ:** `WIRE_HEAD_BASE=45`/`MAX=90` (app.js), `/face` decode center 45 + mouth หาร 70, `head.urdf` joint limit ±0.7854 rad (=45°) ตรงกับ `headLimit=45` โหมด person — encode/decode ยังกันเองถูก (ต่อยอดจากการยืนยันใน [REVIEW.md §20](REVIEW.md))
- `node --check videocall/public/app.js` → ผ่าน

**สรุปรอบนี้:** ฟีเจอร์ธีมทำงานถูกต้อง พบบั๊กที่ฟีเจอร์ทำให้เกิด 1 จุด (BUG-8 — แก้แล้ว) และจุด contrast ที่ควรปรับ 1 จุด (BUG-9 — เปิดไว้ให้ผู้ใช้ตัดสินเฉดแบรนด์) · บั๊ก accessibility ที่ค้างอยู่ (A8/P0 เด่นสุด) ไม่ได้ถูกฟีเจอร์ธีมแก้หรือทำให้แย่ลง แนะนำจัดการ A8/P0 เป็นลำดับแรกเพราะกระทบ operator ตาบอดโดยตรง

---

## รอบแก้บั๊กตามรายการค้าง + ตรวจสอบซ้ำ (2026-07-27)

แก้ทุกรายการที่เปิดค้างในรายงานนี้ (BUG-9, A8/P0, A9, A7 + หมายเหตุพฤติกรรม 2 จุด) — สถานะอัปเดตไว้ใต้แต่ละหัวข้อด้านบนแล้ว พร้อมพบและแก้ race เล็ก 1 จุดใน `announceAccessibility` ระหว่างตรวจซ้ำ

### การตรวจสอบซ้ำ (verification)

1. **Syntax** — `node --check videocall/public/app.js` → ผ่าน
2. **A8** — ไล่ crosscheck จุดเรียก `showSystemMsg` ทั้ง 25 จุด: ทุกจุดเป็นเหตุการณ์ one-shot (ไม่มีจุดยิงถี่ที่จะทำให้ screen reader พูดรัว); 3 จุดที่มีประกาศสั้นคู่กันอยู่แล้วส่ง `{ announce: false }` ครบ (peer-joined, peer-left, auto peer-TTS) — ไม่มีการพูดซ้ำสองรอบเหลืออยู่
3. **A9** — `aria-pressed` sync ใน `applyMode` ครอบคลุมทุกครั้งที่สลับโหมด รวมตอน boot (`initApp` เรียก `applyMode` เสมอ) และค่าเริ่มต้นใน HTML ตรงกับ class `active`
4. **A7** — เส้นทาง success ประกาศผล, เส้นทาง fail (clipboard ถูกบล็อก/non-secure context) แสดง+ประกาศรหัสห้องให้พิมพ์เองได้
5. **BUG-9** — คำนวณ contrast ยืนยัน: `#574fd6` บนขาว ~6.0:1, บน `#f1f5f9` ~5.4:1, ขาวบน `#574fd6` ~6.0:1 — ผ่าน WCAG AA ทุกจุดที่ `--primary` ถูกใช้เป็นตัวอักษร/พื้นปุ่มในธีม Light; ธีม Dark ไม่ถูกแตะ (override กลับเป็น `#6c63ff`)
6. **speakPeerMessage fallback** — ตรวจผู้เรียกทั้ง 2 จุด (socket `chat-message`, data-channel `onmessage`): เป็นข้อความ peer เท่านั้น (robot payload ถูกกรองด้วย `applyRobotPayload` ก่อนถึงเส้นทางแชท) + guard `!clean` กัน JSON ล้วน; เส้นทาง TTS กับ live region เป็น either/or ไม่มีทางซ้อน
7. **ผลข้างเคียงต่อ policy "minimal aria-live"** — ประกาศที่เพิ่มทั้งหมดเป็นเหตุการณ์สำคัญครั้งเดียว (error/สถานะเปลี่ยน/ผลการกดปุ่ม/ข้อความเข้า) ไม่มี stream ต่อเนื่อง; interim STT, AI typing, timing log ยังเงียบต่อ screen reader ตามเดิม

**คงเหลือ (นอกขอบเขตรายงานนี้ — ติดตามใน BUGREVIEW.md/REVIEW.md):** P1 (ประกาศตำแหน่ง D-pad ทั้งที่ MQTT หลุด — false confidence), A10 (role="log", label ช่อง join/chat), #21 switch-access/prefers-reduced-motion, #22 live caption, และการทดสอบบนอุปกรณ์จริง (TalkBack บน Android) ซึ่งการตรวจแบบ static แทนไม่ได้

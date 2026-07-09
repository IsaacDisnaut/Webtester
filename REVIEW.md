# รีวิวเว็บแอป VideoCall — DeepdarkFamtasy
**วันที่รีวิว:** 25 มิถุนายน 2569  
**ขอบเขต:** `videocall/public/app.js`, `index.html`, `style.css`, `server.js`, `yolo_server.py`  
**เวอร์ชัน:** branch `main` (รวม working-tree changes)

---

## 1. ภาพรวมของเว็บ

เว็บแอปนี้เป็นระบบวิดีโอคอลสำหรับโต้ตอบกับ AI หรือคนจริง โดยมีฟีเจอร์หลักดังนี้:

| โหมด | คำอธิบาย |
|---|---|
| **คุยกับ AI** | พิมพ์หรือพูดภาษาไทย → AI ตอบกลับ + แสดงสีหน้าผ่านโมเดล 3D หุ่นยนต์ |
| **คุยกับคน** | WebRTC peer-to-peer วิดีโอคอลกับคนอื่น แชร์รหัสห้องเพื่อเชื่อมต่อ |
| **โหมดหุ่นยนต์** | ควบคุมหัวหุ่นยนต์ InMoov ผ่าน joystick และ D-pad ส่งคำสั่งผ่าน MQTT → Arduino |

---

## 2. ฟีเจอร์ที่มีอยู่

### 2.1 AI Chat
- รองรับหลาย provider: Groq, OpenRouter, 9Arm, Gemini, Anthropic, OpenAI-compatible
- ระบบ prompt สั่งให้ AI พูดภาษาไทยและฝัง emotion JSON ทุก response
- ประวัติการสนทนา (aiHistory) ส่งเป็น context ให้ AI ทุกครั้ง
- กด End เพื่อรีเซ็ตบทสนทนา

### 2.2 Speech-to-Text (STT)
- **Whisper mode** (ค่าเริ่มต้น): บันทึกเสียงจนเงียบแล้วส่ง Groq Whisper ถอดความ — แม่นยำสูง
- **Browser STT mode**: ใช้ Web Speech API ต่อเนื่อง (Chrome/Edge เท่านั้น)
- มี STT correction ด้วย AI เพื่อแก้คำผิดจาก context บทสนทนา
- แสดง interim text ขณะพูด (ใน Browser mode)

### 2.3 Text-to-Speech (TTS)
- ใช้ browser speechSynthesis เลือกเสียงภาษาไทย
- ปรับเพศเสียง (ชาย/หญิง) และความเร็ว
- ทุกข้อความมีปุ่ม 🔊 กดฟังซ้ำได้
- iOS: ต้องกดปุ่มก่อนเพื่อ unlock เสียง

### 2.4 YOLO Object Detection
- ส่ง frame จากกล้องไปที่ `yolo_server.py` (localhost:5001) ทุก 400ms
- วาด bounding box เฉพาะที่ confidence ≥ 50% บน canvas overlay
- ทำงานอัตโนมัติใน AI mode — หยุดเมื่อเปลี่ยนโหมด
- ถ้า yolo_server.py ไม่ได้เปิด → คืน `[]` เงียบๆ ไม่ error

### 2.5 WebRTC (คุยกับคน)
- peer-to-peer ผ่าน WebRTC + Socket.IO signaling
- รองรับ STUN (Google) + TURN (openrelay.metered.ca) ฟรี
- Data channel สำหรับ chat message และ robot control
- ICE restart อัตโนมัติเมื่อ connection failed

### 2.6 หุ่นยนต์
- โมเดล 3D URDF (Three.js) แสดงท่าทางหุ่นในเบราว์เซอร์
- MQTT publish/subscribe สำหรับควบคุม Arduino ผ่าน `deep.py`
- Joystick ควบคุมตา, D-pad ควบคุมหัวและปาก
- Emotion JSON ใน AI response ถูกแยกและ publish ไป `robot/emotion` อัตโนมัติ

### 2.7 อื่นๆ
- ระบบล็อกอินด้วยชื่อ + บันทึก session ลง SQLite
- แปลภาษาไทย-อังกฤษ (Translation button)
- Peer TTS: ให้อีกฝ่ายได้ยินข้อความของเราเป็นเสียง
- Cloudflare Tunnel (`start-local.bat`): เปิดให้คนนอก network เข้าได้ทันที

---

## 3. บั๊กที่พบและสถานะ

| # | ไฟล์ | ระดับ | ปัญหา | สถานะ |
|---|---|---|---|---|
| 1 | `server.js` | 🔴 บั๊กหนัก | Groq บังคับใช้ Llama เสมอ ทำให้ model dropdown ไม่มีผล | **แก้แล้ว** |
| 2 | `index.html` | 🟡 Visual | `#detect-btn` ไม่มี class `off` ตอนเริ่มต้น ดูเหมือน ON ทั้งที่ detection ปิด | **แก้แล้ว** |
| 3 | `app.js` | 🟡 Visual | `stopDetect()` ไม่ sync class ปุ่ม Detect | **แก้แล้ว** |
| 4 | `app.js` | 🟡 Visual | `startDetect()` ไม่ sync class ปุ่ม Detect | **แก้แล้ว** |
| 5 | `app.js` | 🟢 Stale | `endCall()` เซ็ต `aiAvatar.style.display` บน parent ที่ hidden อยู่แล้ว | **แก้แล้ว** |
| 6 | `app.js` | 🟢 Cosmetic | comment block YOLO ซ้ำกัน | **แก้แล้ว** |
| 7 | `style.css` | 🟢 Cosmetic | rule `.timing-log` ซ้ำกัน 2 ชุด | **แก้แล้ว** |
| 8 | `index.html` | 🔴 Accessibility | `lang="en"` ทั้งที่เนื้อหาเป็นภาษาไทย — screen reader อ่านผิดเสียง | **แก้แล้ว** |
| 9 | `index.html` | 🔴 Accessibility | `#chat-messages` ไม่มี `aria-live` — screen reader ไม่ประกาศข้อความใหม่ | **แก้แล้ว** |
| 10 | `index.html` | 🟡 Accessibility | ปุ่มควบคุมทั้ง 6 ไม่มี `aria-label` มีแค่ `title` ซึ่ง screen reader บางตัวข้าม | **แก้แล้ว** |
| 11 | `app.js` | 🟡 Accessibility | รหัสห้องไม่ถูกอ่านออกเสียง คนตาบอดได้ยินรหัสห้องไม่ได้ | **แก้แล้ว** |
| 12 | `app.js` | 🟡 Accessibility | เหตุการณ์ peer เข้า/ออกไม่มีเสียงแจ้งเตือน | **แก้แล้ว** |
| 13 | `server.js` | 🔵 Note | `available` และ `keys` ใน `/api/provider-defaults` ให้ข้อมูลซ้ำกัน | ไม่แก้ (ไม่กระทบ) |
| 14 | `app.js` | 🔵 Note | race condition ใน detection loop ถ้าสลับโหมดเร็วมาก — self-heal ใน ~1 วินาที | ไม่แก้ (risk ต่ำ) |

---

## 4. ประเมิน: คนหูหนวก ↔ คนตาบอด

### 4.1 flow การสนทนา

```
คนหูหนวก (Device A)           คนตาบอด (Device B)
─────────────────────────────────────────────────
พิมพ์ข้อความ ──────────────→ speakPeerMessage() อ่านออกเสียง ✅
                             (ต้องกด 🔊 ก่อน)

               ←──────────── พูด → STT → ข้อความปรากฏบนจอ ✅
```

### 4.2 สิ่งที่ใช้งานได้ ✅

- **คนตาบอดพูด** → STT แปลงเป็นข้อความ → คนหูหนวกอ่านบนจอ
- **คนหูหนวกพิมพ์** → ถ้ากด 🔊 แล้ว → ข้อความถูกอ่านออกเสียงให้คนตาบอดฟัง
- ทุกข้อความมีปุ่ม 🔊 กดฟังซ้ำได้
- Translation ไทย-อังกฤษช่วยได้หากต่างภาษา

### 4.3 ปัญหาที่แก้แล้ว ✅

| ปัญหา | แก้อย่างไร |
|---|---|
| Screen reader ไม่ประกาศข้อความใหม่ | เพิ่ม `aria-live="polite"` ใน `#chat-messages` |
| คนตาบอดได้ยินรหัสห้องไม่ได้ | `generateRoomCode()` เรียก `announceAccessibility()` อ่านรหัสออกเสียง |
| Peer เข้า/ออกไม่มีเสียง | เพิ่ม TTS แจ้ง "คู่สนทนาเข้าร่วมแล้ว" / "คู่สนทนาออกจากห้องแล้ว" |
| เชื่อมต่อสำเร็จไม่มีเสียง | พูด "เชื่อมต่อแล้ว พร้อมพูดคุย" เมื่อ WebRTC เชื่อมสำเร็จ |

### 4.4 ข้อจำกัดที่ยังเหลืออยู่ ⚠️

1. **คนหูหนวกต้องกด 🔊 เอง** — ปุ่มนี้อยู่ในหัวแชทและไม่ได้เปิดอัตโนมัติ คนตาบอดไม่มีทางบังคับให้อีกฝ่ายเปิดได้
2. **ไม่มี keyboard shortcut** สำหรับฟังก์ชันหลัก (เปิด STT, ส่งข้อความ) — คนตาบอดต้องใช้ Tab navigat ไปเรื่อยๆ
3. **รหัสห้องต้องพิมพ์เอง** — คนตาบอดต้องจำรหัสที่ฟังมาแล้วพิมพ์ใน Join field ซึ่งยาก
4. **ไม่มี visual notification** สำหรับเสียงใดๆ — คนหูหนวกไม่รู้ว่า TTS ของระบบกำลังพูดอยู่หรือเปล่า

### 4.5 ขั้นตอนแนะนำสำหรับเดโม

```
คนหูหนวก:
1. เปิดเว็บ → ใส่ชื่อ → "คุยกับคน"
2. กด 🔊 ในหัวแชท (สำคัญมาก — ทำให้คนตาบอดได้ยินข้อความ)
3. แชร์รหัสห้องให้อีกฝ่ายทางอื่น (SMS, บอกปาก)

คนตาบอด:
1. เปิดเว็บ → ใส่ชื่อ → "คุยกับคน"
2. เปิด STT → พูดรหัสห้อง (ถ้า STT รับได้) หรือให้คนช่วยพิมพ์
3. เมื่อเชื่อมต่อ → ระบบอ่านออกเสียง "เชื่อมต่อแล้ว พร้อมพูดคุย"
4. พูดตามปกติ — ข้อความขึ้นบนจอคนหูหนวก
```

---

## 5. ปัญหาด้าน UX ที่ควรปรับก่อนเดโม

### 5.1 Peer TTS ไม่ได้เปิดอัตโนมัติ (🔴 สำคัญ)

ปุ่ม 🔊 ในหัวแชทต้องกดด้วยตนเอง ถ้าคนหูหนวกลืมกด → คนตาบอดได้ยินเงียบหมด  
**แนะนำ:** แสดง prompt ถามทันทีเมื่อเข้าโหมดคุยกับคน: *"ต้องการให้อีกฝ่ายได้ยินข้อความของคุณเป็นเสียงไหม?"*

### 5.2 รหัสห้องเปลี่ยนทุกครั้งที่รีเฟรช (🟡 ปานกลาง)

ไม่มีการ persist รหัสห้อง หากหน้าจอ reload รหัสจะหาย peer ต้องเชื่อมใหม่  
**แนะนำ:** บันทึกรหัสห้องใน sessionStorage และ rejoin อัตโนมัติเมื่อ reload

### 5.3 ไม่มี visual indicator ว่า TTS กำลังพูดอยู่ (🟡 ปานกลาง)

คนหูหนวกเห็นว่า AI กำลัง "Speaking…" ผ่าน badge แต่ในโหมด peer-to-peer ไม่มี indicator ว่าระบบกำลังอ่านข้อความอยู่

### 5.4 STT ต้องรอจนเงียบ 1.5 วินาที (🟢 เล็กน้อย)

ในโหมด Whisper ระบบรอ silence 1,500ms ก่อนส่ง — รู้สึกช้าสำหรับคนที่หยุดพักระหว่างประโยค

---

## 6. ปัญหาด้าน Infrastructure สำหรับเดโม

### 6.1 MQTT Broker สาธารณะ (🔴 เสี่ยงสูง)

ค่าเริ่มต้นใช้ `wss://test.mosquitto.org:8081` ซึ่งเป็น public broker ที่ไม่มี uptime guarantee  
→ หาก broker ล่มระหว่างเดโม หุ่นยนต์จะไม่ขยับ  
**แนะนำ:** เปลี่ยนเป็น local Mosquitto: ตั้งค่าใน Settings → `ws://localhost:9001`

### 6.2 YOLO Server ต้องเปิดแยก (🟡 ต้องจำ)

`yolo_server.py` ต้องรันแยกบนเครื่องเดียวกับ server  
`start-local.bat` ถามให้เปิด YOLO แล้ว — แต่ถ้าตอบ `n` detection จะเงียบๆ ไม่แจ้ง

### 6.3 Cloudflare Quick Tunnel URL เปลี่ยนทุกครั้ง (🟡 ปานกลาง)

URL เช่น `https://margaret-mesa-quebec-attach.trycloudflare.com` จะเปลี่ยนทุกครั้งที่รีสตาร์ท  
→ ต้องแชร์ URL ใหม่ทุกครั้ง  
**แนะนำ:** ถ้าต้องการ URL คงที่ให้สมัคร Cloudflare account ฟรีแล้วสร้าง named tunnel

### 6.4 Groq STT ต้องการ API key และ quota (🟡 ปานกลาง)

Whisper STT ผ่าน Groq API หาก key หมด quota ระหว่างเดโม → STT ไม่ทำงาน  
**แนะนำ:** เตรียม key สำรอง หรือเปลี่ยนเป็น Browser STT mode ก่อนเดโม

---

## 7. สิ่งที่ทำงานได้ดีแล้ว

- ✅ เปิดเว็บ → AI ตอบได้ทันที ไม่ต้อง config พิเศษ
- ✅ TTS อ่านคำตอบ AI ออกเสียงภาษาไทยได้ถูกต้อง
- ✅ YOLO detection ทำงานอัตโนมัติใน AI mode ไม่ต้องกดเพิ่ม
- ✅ Cloudflare Tunnel รัน 1 คลิกด้วย `start-local.bat`
- ✅ WebRTC ใช้ TURN server ฟรี รองรับข้ามเครือข่าย
- ✅ Emotion JSON จาก AI ขยับหน้าหุ่นและส่งไป Arduino อัตโนมัติ
- ✅ Session tracking บันทึกผู้ใช้ + เวลาใช้งานลง SQLite
- ✅ Graceful fallback ทุก service: กล้องไม่มี / YOLO ไม่เปิด / MQTT ล่ม → เว็บยังใช้งานได้

---

## 8. Checklist ก่อนเดโม

- [ ] เปิด `start-local.bat` → เลือก `y` ที่ YOLO
- [ ] คัดลอก Cloudflare URL แจ้งผู้เข้าร่วม
- [ ] เปลี่ยน MQTT broker เป็น local: Settings → `ws://localhost:9001`
- [ ] ทดสอบ TTS ภาษาไทยในเบราว์เซอร์ก่อน (บางเครื่องต้องโหลด voice ก่อน)
- [ ] ตรวจ Groq API quota ยังพอ
- [ ] ทดสอบ WebRTC ข้ามเครือข่ายกับมือถือจริงก่อน
- [ ] ถ้าใช้ scenario หูหนวก↔ตาบอด: คนหูหนวกต้องกด 🔊 ก่อนเริ่ม

---

## 9. รีวิวติดตามผล — มุมมองผู้ใช้ทั่วไปและผู้พิการ (3 กรกฎาคม 2569)

**ขอบเขต:** `videocall/public/index.html`, `app.js`, `style.css` (สถานะปัจจุบันหลังการแก้ไขใน §3-4)

รีวิวรอบนี้เจาะเฉพาะการใช้งานจริงของ **ฝั่งผู้ควบคุม (person mode)** เทียบกับเป้าหมายโปรเจกต์ใน [CLAUDE.md](CLAUDE.md) — ให้ผู้พิการทำงานแทนหน้าหุ่นยนต์ผ่านเว็บได้

### 9.1 สิ่งที่ทำได้ดีอยู่แล้ว

- **คีย์บอร์ดควบคุมหุ่นครบ** — WASD คุมลูกตา, ลูกศรคุม D-pad, Space รีเซ็ต ([index.html:333-341](videocall/public/index.html#L333-L341)) ช่วยผู้ใช้ที่ลากจอยสติ๊ก/กดปุ่มเล็กด้วยเมาส์ไม่ถนัดได้มาก
- **แชทข้อความคู่ขนานกับเสียงเสมอ** ทุกโหมด ([index.html:270-283](videocall/public/index.html#L270-L283)) เป็นทางเลือกสำหรับคนที่พูด/ฟังลำบาก
- ปุ่มควบคุมหลัก (Mic/Camera/Speech/Detect/End) มี `aria-label` ครบ ([index.html:166-206](videocall/public/index.html#L166-L206))
- ปุ่มควบคุมหลักขนาด 52×52px ([style.css:588-589](videocall/public/style.css#L588-L589)) ผ่านเกณฑ์ touch target ขั้นต่ำ 44px
- `#chat-messages` และรหัสห้องมี `aria-live` แล้ว (แก้ไปแล้วใน §4.3)

### 9.2 ปัญหาที่พบใหม่

| # | ไฟล์ | ระดับ | ปัญหา | กลุ่มที่กระทบ | สถานะ |
|---|---|---|---|---|---|
| 15 | `index.html` | 🔴 Accessibility | ปุ่มไอคอนล้วนไม่มี `aria-label`: `#settings-open-btn`, `#send-btn`, D-pad ทั้ง 5 ปุ่ม ▲◄⦿►▼, `#help-close-btn`/`#settings-close-btn` — มีแค่ `title` ซึ่ง screen reader หลายตัวไม่อ่าน | ตาบอด/สายตาเลือนราง | **แก้แล้ว** |
| 16 | `index.html` | 🔴 Accessibility | สถานะสำคัญไม่ใช่ `aria-live`: `#room-status`, `#mqtt-status-text`, `#speech-indicator` "Listening" — คนตาบอดไม่รู้ว่าสายต่อติดหรือไมค์กำลังฟังอยู่ไหม | ตาบอด/สายตาเลือนราง | **แก้แล้ว** |
| 17 | `style.css` | 🟡 UX | `.dpad-btn` เหลือ 36×36px บนจอ ≤680px ต่ำกว่ามาตรฐาน touch target 44px | มือสั่น/ควบคุมกล้ามเนื้อละเอียดยาก | **แก้แล้ว** (ขยายเป็น 44×44px / dpad-center 38×38px) |
| 18 | `style.css` | 🟡 UX | ตัวอักษรเล็กมากหลายจุด (`.6rem`–`.75rem`) กระจายทั่วป้ายปุ่ม/สถานะ ไม่มีปุ่มปรับขนาดตัวอักษรในแอป ต้องพึ่ง browser zoom เท่านั้น | สายตาเลือนราง/ผู้สูงอายุ | **บางส่วน** — ปรับ font-size ขึ้น (.6–.7rem → .68–.75rem) ทุกจุดที่ระบุ; ยังไม่มีปุ่มปรับขนาดตัวอักษรในแอป (ต้องออกแบบ UI เพิ่ม — เกินขอบเขตรอบนี้) |
| 19 | `style.css` | 🟢 Cosmetic | `--text-muted: #64748b` บนพื้น `#080c14` รวมกับ font-size เล็ก — contrast อยู่ระดับก้ำกึ่ง (~4.1:1) | สายตาเลือนราง | **แก้แล้ว** — เปลี่ยนเป็น `#7d8ba3` (~5.7:1 ผ่าน WCAG AA) |
| 20 | `index.html`/`app.js` | 🟢 UX | ภาษาปนกัน: ปุ่มหลัก/หน้า login/ข้อความระบบเป็นอังกฤษ แต่ tutorial เป็นไทยทั้งหมด ทั้งที่ `lang="th"` | ผู้ใช้ทั่วไป/ผู้สูงอายุ | **แก้แล้ว** — แปล UI หลัก, ข้อความ system/error, สถานะห้อง/MQTT เป็นไทยทั้งหมด; ฟอร์ม Settings (Provider/Model/API Key ฯลฯ) จงใจคงศัพท์เทคนิคอังกฤษไว้ตามธรรมเนียมซอฟต์แวร์สาย dev |
| 21 | ทั้งระบบ | 🔵 Note | ไม่รองรับ switch-access (กดปุ่มเดียวไล่โฟกัส) และไม่มี `prefers-reduced-motion`/high-contrast mode ใน CSS | ผู้พิการรุนแรงทางการเคลื่อนไหว | ยังไม่แก้ (ของานออกแบบเพิ่มเติม นอกขอบเขตรอบนี้) |
| 22 | `app.js` | 🔵 Note | ไม่มี transcript/caption แบบเรียลไทม์ของเสียงพูดฝั่งคู่สนทนา (มีแค่ STT ของฝั่งตัวเองที่พิมพ์ส่ง) หากอีกฝ่ายพูดผ่านไมค์ล้วนไม่พิมพ์ คนหูหนวกจะไม่เห็นข้อความ | หูหนวก/บกพร่องทางการได้ยิน | ยังไม่แก้ (ฟีเจอร์ใหญ่ นอกขอบเขตรอบนี้) |

### 9.3 ฟีเจอร์ใหม่ — เปิด STT อัตโนมัติที่ `/face`

`/face` คือจอ kiosk ที่ติดตั้งอยู่หน้าหุ่นยนต์จริง ไม่มีใครนั่งคอยกดปุ่ม Speech เอง — `initApp()` จึงเรียก `toggleSpeech()` ทันทีหลัง `applyMode('robot')` เพื่อเริ่มฟังเสียงอัตโนมัติ (เคารพโหมด STT ที่ตั้งไว้ใน Settings ทั้ง Whisper และ Browser STT) ([app.js:353-358](videocall/public/app.js#L353-L358))

### 9.4 เปลี่ยนค่าเริ่มต้น STT เป็น Browser STT + แก้บั๊ก STT ไม่ส่งข้อความบน `/face`

- `DEFAULT_SETTINGS.sttMode` เปลี่ยนจาก `'whisper'` → `'browser'` ([app.js:179](videocall/public/app.js#L179)) — ใช้ Web Speech API ของเบราว์เซอร์ (ผ่านบริการ Google) แทน Groq Whisper เป็นค่าเริ่มต้น ทั้งหน้าเข้าใช้งานปกติและ `/face`
- **พบบั๊ก:** โหมด `robot` (`/face`) ไม่เคยถูกจัดการในเงื่อนไขส่งข้อความ STT ทั้งฝั่ง Browser STT ([app.js `recognition.onresult`](videocall/public/app.js)) และฝั่ง Whisper ([app.js `transcribeWhisper`](videocall/public/app.js)) — เดิมเช็คแค่ `state.mode === 'person'` แล้ว fallback ไป `sendToAI()` ซึ่งผิด (ไม่มี AI ฝั่ง /face) ทำให้เสียงที่พูดที่หน้าหุ่นไม่เคยถูกส่งไปหาอีกฝ่ายเลย ข้อความไปกองอยู่เงียบๆ ใน `chatInput` ที่ซ่อนอยู่ (`.chat-col` ถูกซ่อนด้วย `body.face-mode` CSS)
- **แก้แล้ว:** ทั้งสองจุดตอนนี้ส่ง `sendToPeer()` เมื่อ `state.mode === 'person' || 'robot'` และส่ง `sendToAI()` เฉพาะ `state.mode === 'ai'` เท่านั้น — ข้อความจากฝั่ง `/face` จึงถูกส่งเข้าห้องผ่าน data channel/socket ไปโผล่ในแชทของฝั่งผู้ควบคุม (person mode) ได้จริง แม้ว่า UI แชทของฝั่ง `/face` เองจะยังถูกซ่อนไว้ตามเดิม
- **พบบั๊กเดียวกันซ้ำอีกจุด:** `sendMessage()` (เส้นทางช่องแชทที่ซ่อนอยู่) ก็เช็คแค่ `state.mode === 'person'` เหมือนกัน — แก้ให้ตรงกันแล้ว
- เพิ่ม diagnostic log (`[Chat] sent via...` / `[Chat] received via...`) ที่ `sendToPeer()`, `chat-message` socket handler, และ `dc.onmessage` เพื่อ debug เส้นทางส่ง/รับข้อความได้ง่ายขึ้นในอนาคต

### 9.5 บั๊ก: STT ตรวจจับเสียงไม่ได้บนมือถือ (Android + Chrome)

**อาการ:** Browser STT ทำงานปกติบนเดสก์ท็อป (ทั้งหน้าปกติและ `/face`) แต่บนมือถือ Android + Chrome เหมือนตรวจจับคำพูดไม่ได้เลย

**สาเหตุ:** โค้ดเดิมพยายามป้องกันปัญหาไมค์ชนกันระหว่าง WebRTC (`getUserMedia`) กับ Web Speech API บนมือถือ ด้วยการแค่ mute แทร็กเสียง (`track.enabled = false`) แต่การ mute แบบนี้ไม่ได้คืนสิทธิ์ไมโครโฟนในระดับ OS ให้จริงๆ — Android Chrome ขอสิทธิ์ไมค์ให้ SpeechRecognition ผ่าน session แยกต่างหากจาก `getUserMedia` เมื่อ `getUserMedia` ยังถือไมค์ไว้อยู่ (แม้ track จะถูก mute) ตัว recognizer เลยไม่ได้เสียงอะไรเข้ามาเลย ([app.js `enableSpeech`/`disableSpeech`](videocall/public/app.js))

**แก้แล้ว:** เปลี่ยนจาก mute เป็นการ **หยุด (stop) แทร็กเสียงจริงๆ** เพื่อคืนไมค์ให้ระบบตอนเปิด STT บนมือถือ แล้วดึง track ออกจาก `RTCRtpSender` ของทุก peer connection (`replaceTrack(null)`) จากนั้นเมื่อปิด STT จะขอ `getUserMedia({audio:true})` ใหม่แล้วสลับ track กลับเข้า sender เดิม (`replaceTrack(newTrack)`) — เคารพสถานะปุ่ม mute (`state.micOn`) ไม่ reacquire ไมค์ถ้าผู้ใช้ปิดไมค์ไว้อยู่ก่อนแล้ว มี log `[STT] mic released...` / `[STT] mic reacquired...` ให้ debug ผลกระทบข้างเคียงที่ทราบอยู่แล้ว: ระหว่างที่ STT กำลังฟังบนมือถือ อีกฝ่ายจะไม่ได้ยินเสียงพูดสดผ่าน WebRTC (เพราะไมค์ถูกยกให้ตัวรู้จำเสียงแทน) เป็น trade-off เดิมที่โค้ดเก่าตั้งใจไว้อยู่แล้ว แค่ทำให้ทำงานได้จริง

---

## 10. รีวิวรอบใหม่ — ยืนยันการแก้ไขทั้งหมด (3 กรกฎาคม 2569)

รีวิวรอบนี้ไล่ตรวจโค้ดปัจจุบันทั้งหมดใหม่ตั้งแต่ต้น (ไม่อ้างอิงจากที่แก้ไปว่า "น่าจะโอเคแล้ว") เพื่อยืนยันว่าทุกอย่างใน §9 ยังคงถูกต้องอยู่จริงในโค้ด และมองหาปัญหาใหม่ที่อาจหลุดมาจากการแก้ไขรอบก่อนๆ

### 10.1 ยืนยันแล้ว — ยังใช้งานได้ถูกต้อง

| หัวข้อ | ตรวจสอบ | ผล |
|---|---|---|
| Accessibility (#15) | grep ปุ่มไอคอนล้วนทั้งหมด (`settings-open-btn`, `send-btn`, D-pad 5 ปุ่ม, `help-close-btn`, `settings-close-btn`) | มี `aria-label` ครบทุกปุ่ม |
| `aria-live` (#16) | `#room-status`, `#mqtt-status-text`, `#speech-indicator` | มีครบ |
| Touch target (#17) | `.dpad-btn` บนมือถือ | 44×44px, `.dpad-center` 38×38px |
| Contrast (#19) | `--text-muted` | `#7d8ba3` บนพื้น `#080c14` (~5.7:1 ผ่าน AA) |
| ภาษา UI หลัก (#20) | grep ข้อความอังกฤษที่เหลือใน `index.html`/`app.js` | เหลือเฉพาะฟอร์ม Settings (ศัพท์เทคนิค ตามที่ตั้งใจไว้) UI หลัก/ข้อความระบบเป็นไทยหมด |
| STT routing bug (§9.4) | `recognition.onresult`, `transcribeWhisper`, `sendMessage` | ทั้ง 3 จุดส่ง `sendToPeer()` ให้ `person`/`robot` และ `sendToAI()` เฉพาะ `ai` ถูกต้องตรงกัน |
| Syntax/Structure | `node --check app.js`, brace-balance ของ `style.css`, `<div>` เปิด/ปิดใน `index.html`, `node server.js` boot | ผ่านทั้งหมด ไม่มี error |

### 10.2 พบปัญหาใหม่ระหว่างรีวิวรอบนี้ — แก้แล้วก่อนส่งมอบ

**บั๊ก: การแก้ปัญหาไมค์มือถือ (§9.5) ทำให้เสียงหลุดหายถาวรได้ในบางลำดับเหตุการณ์**

ตอนไล่โค้ด `pauseLocalAudioForSTT()`/`resumeLocalAudioAfterSTT()` ที่เพิ่งแก้ไปพบว่า:

1. `/face` เรียก `toggleSpeech()` (auto-start STT) **ก่อน** ที่จะมีใครเชื่อมต่อเข้ามาในห้องเลย เพราะฉะนั้น `pauseLocalAudioForSTT()` รอบแรกจะรันตอนที่ `peers` ยังว่างเปล่า — แทร็กเสียงถูก `stop()` และลบออกจาก `state.localStream` ไปแล้วตั้งแต่ตอนนั้น
2. เมื่อผู้ควบคุมเชื่อมต่อเข้ามาทีหลัง `createPeerConnection()` จะเห็นว่า `state.localStream` มีแค่ track วิดีโอ (เสียงหายไปแล้ว) จึงไม่เพิ่ม audio sender ให้เลยตั้งแต่ต้น
3. ต่อให้ภายหลัง STT ปิดแล้วพยายาม "คืน" ไมค์ ก็ไม่มี audio sender ให้ใส่ track กลับเข้าไป — และต่อให้ลอง `pc.addTrack()` เพิ่มทีหลัง ก็ใช้ไม่ได้จริงเพราะการเพิ่ม track ชนิดใหม่หลัง offer/answer แรกไปแล้วต้อง renegotiate SDP ใหม่ ซึ่งโค้ดนี้ไม่มี `onnegotiationneeded` handler เลย

ผลคือ **ผู้ควบคุมจะไม่ได้ยินเสียงสดจากฝั่ง `/face` เลยตลอดทั้ง session** (ไม่ใช่แค่ระหว่าง STT ฟังอยู่ตามที่ตั้งใจ) เพราะ audio m-line ไม่เคยถูกเจรจาไว้ในการเชื่อมต่อครั้งแรกเลย

**แก้แล้ว:** ปรับ `createPeerConnection()` ให้จอง audio transceiver ไว้ล่วงหน้าเสมอ (`pc.addTransceiver('audio', {direction:'sendrecv'})`) ไม่ว่าตอนนั้นจะมี track เสียงจริงอยู่หรือไม่ก็ตาม ทำให้ audio m-line ถูกเจรจาไว้ในทุกการเชื่อมต่อตั้งแต่ offer/answer แรกเสมอ จากนั้น `pauseLocalAudioForSTT()`/`resumeLocalAudioAfterSTT()` แค่ `replaceTrack(null)` / `replaceTrack(track)` บน sender ที่จองไว้แล้ว — ไม่ต้อง renegotiate และใช้ได้ไม่ว่าผู้ควบคุมจะเชื่อมต่อก่อนหรือหลัง STT เริ่มฟัง ([app.js `createPeerConnection`](videocall/public/app.js))

### 10.3 ยังไม่แก้ (ของเดิมจาก §9.2, priority ต่ำ นอกขอบเขตรอบนี้)

- **#18** ยังไม่มีปุ่มปรับขนาดตัวอักษรในแอป (ปรับ font-size ขึ้นแล้ว แต่ยังต้องพึ่ง browser zoom สำหรับการขยายเพิ่มเติม)
- **#21** ไม่รองรับ switch-access และไม่มี `prefers-reduced-motion`/high-contrast mode
- **#22** ไม่มี live caption ของเสียงพูดฝั่งคู่สนทนา (มีแค่ STT ของฝั่งตัวเองที่พิมพ์ส่ง)
- ผลข้างเคียงที่ทราบอยู่แล้วจาก §9.5: ระหว่าง STT กำลังฟังอยู่บนมือถือ อีกฝ่ายจะไม่ได้ยินเสียงพูดสดชั่วคราว (คนละกรณีกับบั๊กใน §10.2 ที่แก้แล้ว — อันนี้คือ "ไม่ได้ยินเฉพาะตอน STT ฟังอยู่" ซึ่งเป็น trade-off ที่ตั้งใจ ไม่ใช่ "ไม่ได้ยินเลยทั้ง session")

**สรุป:** ทุกปัญหาที่รายงานเข้ามาในเซสชันนี้ (§9.2–9.5) ได้รับการแก้ไขและตรวจสอบซ้ำแล้ว รวมถึงพบและแก้บั๊กใหม่ 1 จุด (§10.2) ก่อนที่จะกลายเป็นปัญหาจริงในโปรดักชัน แนะนำให้ทดสอบใช้งานจริงบนอุปกรณ์จริง (เดสก์ท็อป + มือถือ Android) อีกครั้งเพื่อยืนยัน โดยเฉพาะ flow: /face โหลดหน้า → ผู้ควบคุมเชื่อมต่อทีหลัง → ตรวจว่าได้ยินเสียงจาก /face ตอนที่ STT ไม่ได้ฟังอยู่ (มือถือ) หรือได้ยินตลอด (เดสก์ท็อป)

---

## 11. Declutter UI + Accessibility ตาม CODEXREVIEW.md (4 กรกฎาคม 2569)

รอบนี้อ้างอิงจากไฟล์ [CODEXREVIEW.md](CODEXREVIEW.md) (รีวิว UX เชิงผู้พิการ/operator/ลูกค้าแยกต่างหาก) ไล่ตรวจว่าข้อเสนอแนะแต่ละข้อมีอยู่แล้วในโค้ดหรือยัง แล้วลงมือทำทุกข้อที่ประเมินว่า "ควรเพิ่ม" (ไม่เพิ่มความรกของ UI และช่วยงานหลักโดยตรง) ส่วนข้อที่ประเมินว่าเพิ่มความรกหรือ effort สูงเกินสัดส่วนของ prototype ถูกจัดเป็น "ชะลอไว้ก่อน" — รายละเอียดเชิงเหตุผลของแต่ละข้อ (ทำไมทำ/ไม่ทำ) อยู่ใน CODEXREVIEW.md ทั้งหมด ตารางด้านล่างสรุปเฉพาะการเปลี่ยนแปลงโค้ดจริง

### 11.1 โหมด AI ถูกซ่อนเป็นค่าเริ่มต้น (ไม่ลบโค้ด)

| # | ไฟล์ | เรื่อง | สถานะ |
|---|---|---|---|
| 23 | `app.js`/`index.html` | แท็บ "คุยกับ AI" ในเมนูหลักซ่อนเป็นค่าเริ่มต้น (`DEFAULT_SETTINGS.showAiMode = false`, `applyAiModeVisibility()`) เปิดกลับได้ที่ Settings → ทั่วไป | **แก้แล้ว** |
| 24 | `app.js` | Mode เริ่มต้นของ operator (ไม่ใช่ `/face`) เปลี่ยนจาก "คุยกับ AI" เป็น "คุยกับคน" | **แก้แล้ว** |
| 25 | `index.html` | Tagline หน้า login เปลี่ยนจาก "คุยกับ AI หรือเชื่อมต่อกับใครก็ได้ ทุกที่" เป็น "เชื่อมต่อกับหุ่นยนต์เพื่อพูดคุยกับลูกค้า" | **แก้แล้ว** |

### 11.2 Accessibility เพิ่มเติม

| # | ไฟล์ | เรื่อง | สถานะ |
|---|---|---|---|
| 26 | `app.js`/`index.html` | `aria-pressed` ครบทุกปุ่ม toggle (mic, camera, speech ทั้ง Browser/Whisper STT, detect, peer-tts) | **แก้แล้ว** |
| 27 | `style.css` | `:focus-visible` outline ให้ปุ่มควบคุม/ไอคอน/mode-nav/D-pad/modal buttons — ก่อนหน้านี้มีแค่ `outline:none` ไม่มี state แทน | **แก้แล้ว** |
| 28 | `app.js`/`index.html` | Escape-to-close, focus trap (วน Tab ในโมดัล), คืน focus กลับปุ่มเดิมตอนปิด ให้ Help modal และ Settings modal | **แก้แล้ว** |
| 29 | `app.js` | เสียงประกาศ (`announceAccessibility`) ตอนเปิด/ปิดไมโครโฟน | **แก้แล้ว** |
| — | — | **แก้คำอธิบายที่คลาดเคลื่อนจาก §9–10:** `announceAccessibility()` เป็นเสียงพูดตรง (`SpeechSynthesisUtterance`) ไม่ใช่ aria-live region อย่างที่เคยอธิบายไว้ — ส่วนที่เป็น `aria-live` จริงคือ `room-status`/`mqtt-status-text`/`speech-indicator`/`chat-messages` | หมายเหตุแก้ไข |

### 11.3 ลดความรก / ซ่อนฟีเจอร์ debug

| # | ไฟล์ | เรื่อง | สถานะ |
|---|---|---|---|
| 30 | `app.js`/`index.html` | ปุ่ม "ตรวจจับ" (YOLO Detect) ซ่อนออกจากแถบควบคุมหลักเป็นค่าเริ่มต้น (`settings.showDetectButton`) เปิดกลับได้ที่ Settings | **แก้แล้ว** |
| 31 | `app.js`/`index.html` | Timing log ("⏱ STT 0.00s…") ซ่อนออกจากแชทเป็นค่าเริ่มต้น (`settings.showTimingLog`) ยัง log ลง console เสมอ | **แก้แล้ว** |

### 11.4 งานบริการลูกค้า

| # | ไฟล์ | เรื่อง | สถานะ |
|---|---|---|---|
| 32 | `app.js`/`index.html`/`style.css` | Label ค้างจอ "เสียงถึงลูกค้า: เปิด/ปิด" ข้างปุ่ม 🔊 ในหัวแชท แทนที่จะต้อง hover ดู title | **แก้แล้ว** |
| 33 | `app.js`/`index.html`/`style.css` | Dropdown "วลีด่วน" เหนือช่องพิมพ์ (เฉพาะโหมด "คุยกับคน") — เลือกแล้วส่งทันที | เพิ่มแล้ว → **ลบออกใน §11.8** ตามคำขอผู้ใช้ |
| 34 | `app.js`/`index.html`/`style.css` | Overlay "กำลังเชื่อมต่อเจ้าหน้าที่…" บนจอ `/face` ตอนยังไม่มี operator เชื่อมต่อ ซ่อนอัตโนมัติเมื่อ `pc.ontrack` ยิง (มีสื่อจริงไหลเข้า) | **แก้แล้ว** |
| 35 | `app.js` | `confirm()` ก่อนวางสาย — ถามเฉพาะตอนมีการเชื่อมต่อจริง (`state.mode==='person'` และมี peer) ไม่ถามในโหมด AI หรือก่อนมีคู่สนทนา | **แก้แล้ว** |

### 11.5 หุ่นยนต์ / responsive

| # | ไฟล์ | เรื่อง | สถานะ |
|---|---|---|---|
| 36 | `app.js`/`index.html` | `settings.dpadSpeed` (ช้า/ปกติ/เร็ว) คูณเข้ากับ step การขยับหัว/ปากของ D-pad แทนการเพิ่มปุ่มในแถบควบคุมหลัก | **แก้แล้ว** |
| 37 | `style.css` | Breakpoint แท็บเล็ตเพิ่ม (`max-width:1024px` ลดความกว้างคอลัมน์แชท) และเพิ่มความสูงแชทมือถือ 280px → 320px | **แก้แล้ว** |

### 11.6 บั๊กใหม่ที่พบระหว่างตรวจรอบนี้

**แถบควบคุมลอย (`.controls`: mic/camera/speech/detect/end) ไม่เคยถูกซ่อนบนจอ `/face`**

ตอนไล่เช็คว่า `body.face-mode` ซ่อน UI ครบจริงไหมตามที่ CODEXREVIEW.md อ้างว่า "ลูกค้าไม่เห็นข้อมูลเทคนิคใดๆ" พบว่า CSS เดิมซ่อนเฉพาะ `.header`/`.chat-col`/`.room-bar`/`.local-wrap`/`.remote-wrap`/`.robot-controls-row` แต่ไม่ได้รวม `.controls` ซึ่งเป็นแถบปุ่มลอย (`position:absolute; bottom:0`) ทับอยู่บนวิดีโอ/หน้าหุ่น หมายความว่าลูกค้าที่นั่งหน้าจอ kiosk `/face` เห็นและสามารถกดปุ่มเหล่านี้ได้จริง **รวมถึงปุ่ม "วางสาย"** ทั้งที่ไม่ควรมีใครไปแตะจอนี้เลย (ไม่มี operator นั่งดูแล เสียงถูก auto-STT ไว้แล้ว)

**แก้แล้ว:** เพิ่ม `.controls` เข้าไปในรายการที่ `body.face-mode` ซ่อน (`display:none !important`) ([style.css `body.face-mode`](videocall/public/style.css))

### 11.7 ยืนยันความถูกต้อง

- `node --check app.js` ผ่าน ไม่มี syntax error
- brace-balance ของ `style.css` เท่ากัน (เปิด `{` = ปิด `}`)
- `<div>` เปิด/ปิดใน `index.html` เท่ากัน (78/78)
- ทุก element id ใหม่ที่ `app.js` อ้างถึง (`s-show-ai-mode`, `s-show-detect-btn`, `s-show-timing-log`, `s-dpad-speed`, `quick-phrase-select`, `quick-phrases-wrap`, `peer-tts-status`, `face-waiting-status`) มีอยู่ใน `index.html` จริงครบ ตรวจด้วย grep นับจำนวน id ละ 1 ครั้งพอดี

**ยังไม่แก้ (ชะลอไว้ก่อนตามการประเมินใน CODEXREVIEW.md):** shortcut คีย์ M/C สำหรับ mic/camera, ปุ่มขนาดใหญ่ขึ้น, preset gesture (มองตรง/พยักหน้า ฯลฯ), live caption ของเสียงฝั่งตรงข้าม, high-contrast/large-text mode, audio level meter, แยกสถานะ "Robot" กับ "Customer" เป็นคนละตัว, แยก Admin Settings เป็น role ต่างหาก, ปุ่มพับเก็บแผงควบคุมหุ่นยนต์, การ์ดสถานะหลายใบแบบ Operator Console เต็มรูปแบบ, ลบไฟล์ `videocall/public/face/index.html` ที่เป็น dead code (พบใน §10 ของรีวิวก่อนหน้า/CODEXREVIEW.md)

### 11.8 เอาฟีเจอร์ออกตามคำขอผู้ใช้ (หลัง §11 ใช้งานจริง)

หลังลองใช้งานจริง ผู้ใช้ตัดสินใจเอา 2 ฟีเจอร์ออก:

| # | ไฟล์ | เรื่อง | สถานะ |
|---|---|---|---|
| 38 | `app.js`/`index.html`/`style.css` | ลบ dropdown "วลีด่วน" ทั้งหมด (HTML `#quick-phrases-wrap`, CSS `.quick-phrases`, JS `quickPhrasesWrap`/mode-visibility/change-handler) — #33 ด้านบนถูกย้อนกลับ | **ลบแล้ว** |
| 39 | `app.js`/`index.html` | ลบตัวเลือก "AI Voice Gender" (ชาย/หญิง) ออกจาก Settings — ลบ `settings.voiceGender` ออกจาก `DEFAULT_SETTINGS`/`populateSettingsForm`/`readSettingsForm`, ย่อ `getThaiVoice()` ให้ไม่รับ parameter เพศ ยังคงพยายามเลือกเสียงผู้ชายเป็นค่าเริ่มต้นแบบ hardcode (ตรงกับ system prompt) แต่ผู้ใช้สลับเองไม่ได้แล้ว | **ลบแล้ว** |

ยืนยันด้วย `node --check app.js` ผ่าน, `<div>` เปิด/ปิดใน `index.html` เท่ากัน (77/77), CSS brace-balance เท่ากัน, grep ไม่พบ `voiceGender`/`quick-phrase`/`quickPhrase`/`s-voice-gender` หลงเหลือ

---

## 12. รีวิวทุกฟีเจอร์เทียบเป้าหมายโปรเจกต์ใน CLAUDE.md (4 กรกฎาคม 2569)

**ขอบเขต:** ไล่อ่านโค้ดปัจจุบันทั้งหมดใหม่ — `videocall/public/app.js` (2,018 บรรทัด), `index.html`, `server.js`, `yolo_server.py` — แล้วประเมิน **ทุกฟีเจอร์** เทียบกับเป้าหมายใน [CLAUDE.md](CLAUDE.md):

> ให้ผู้พิการหรือคนทั่วไป (operator หน้าคอม) ทำงานบริการลูกค้า (ลูกค้าหน้าหุ่นยนต์) ผ่าน Video call ควบคุมหุ่นยนต์ผ่านเว็บ — **โฟกัสการสื่อสารพูดคุย ไม่ต้องใส่ใจ talk with AI**

เกณฑ์ประเมิน: 🎯 = ตรงเป้าหมายหลัก · 🧩 = ฟีเจอร์สนับสนุน · 🔬 = นอกเป้าหมาย (debug/ทดลอง — ซ่อนไว้ถูกต้องแล้ว)

### 12.1 ตารางสรุปทุกฟีเจอร์

| ฟีเจอร์ | ประเภท | สถานะ | ประเมินเทียบเป้าหมาย |
|---|---|---|---|
| Video call WebRTC (operator ↔ /face) | 🎯 | ใช้งานได้ | หัวใจของโปรเจกต์ ทำงานครบ: ห้องอัตโนมัติ FACE, STUN+TURN, ICE restart, จอง audio transceiver ล่วงหน้า |
| จอ kiosk `/face` สำหรับลูกค้า | 🎯 | ใช้งานได้ | auto-login เป็น "FACE", auto-join ห้อง, auto-STT, ซ่อน UI ทั้งหมด, overlay "กำลังเชื่อมต่อเจ้าหน้าที่…" |
| ควบคุมหุ่นยนต์ (จอยสติ๊ก + D-pad + คีย์บอร์ด) | 🎯 | ใช้งานได้ | ส่งทั้ง data channel (เร็ว) และ MQTT `robot/emotion` (ไป Arduino) พร้อมกัน ปรับความเร็ว D-pad ได้ |
| แชทข้อความ + Peer TTS | 🎯 | ใช้งานได้ | เปิดเสียงถึงลูกค้าอัตโนมัติเมื่อเข้าโหมดคุยกับคน มี label สถานะค้างจอ |
| STT (Browser default / Whisper) | 🎯 | ใช้งานได้ | เสียงลูกค้าที่ /face → ข้อความในแชท operator; แก้บั๊กไมค์มือถือแล้ว (§9.5, §10.2) |
| MQTT ผ่าน proxy `/ws/mqtt` | 🧩 | ใช้งานได้ | ค่าเริ่มต้นใหม่ชี้ same-origin proxy → Mosquitto local :9001 — ตัดความเสี่ยง public broker (§6.1) ออกแล้ว |
| โมเดล 3D InMoov (Three.js URDF) | 🧩 | ใช้งานได้ | แสดงบน /face เป็น "หน้า" หุ่น และ preview ให้ operator เห็นท่าทางที่สั่ง |
| ระบบ session + SQLite | 🧩 | ใช้งานได้ | บันทึกชื่อ/เวลาใช้งาน, sendBeacon ครอบ 3 event ปิดแท็บ, มี `/api/sessions` ดูย้อนหลัง |
| Login screen + session timer chip | 🧩 | ใช้งานได้ | เรียบง่าย ภาษาไทย validate ชื่อว่าง |
| Help modal (คู่มือภาษาไทย) | 🧩 | ใช้งานได้ | ครอบคลุมทุกโหมด + คีย์ลัด — แต่มีจุด stale (ดู §12.4) |
| Settings modal | 🧩 | ใช้งานได้ | แยกหมวด ทั่วไป/AI/STT/MQTT/TURN มี focus trap + Escape |
| Accessibility (aria, เสียงประกาศ, คีย์บอร์ด) | 🧩 | ใช้งานได้ | สะสมจาก §3–§11 ครบตามที่รายงานไว้ |
| คุยกับ AI (multi-provider) | 🔬 | ซ่อนเป็นค่าเริ่มต้น | ถูกต้องตาม CLAUDE.md ("ยังไม่ต้องใส่ใจ talk with AI") — โค้ดยังอยู่ เปิดกลับได้ใน Settings |
| YOLO object detection | 🔬 | ซ่อนเป็นค่าเริ่มต้น | ฟีเจอร์ demo/debug — ปุ่มซ่อนแล้ว, `/api/detect` คืน `[]` เงียบๆ ถ้า yolo_server ไม่รัน |
| Timing log | 🔬 | ซ่อนเป็นค่าเริ่มต้น | ยัง log ลง console เสมอ เหมาะสมแล้ว |

### 12.2 รีวิวรายฟีเจอร์ — เส้นทางงานหลัก (operator ↔ ลูกค้า)

**1. การเชื่อมต่อสาย (WebRTC)** — [app.js:1639-1717](videocall/public/app.js#L1639-L1717)
- ทั้งสองฝั่ง auto-join ห้อง `FACE` (operator ตอนเข้าโหมดคุยกับคน, /face ตอนโหลดหน้า) → **ไม่ต้องแลกรหัสห้องเลยในการใช้งานปกติ** ปัญหา "คนตาบอดต้องจำรหัสห้อง" (§4.4 ข้อ 3) จึงหมดไปโดยปริยายสำหรับ workflow หลัก — รหัสห้องยังใช้ได้สำหรับคุยกันเอง 2 คน
- จอง audio transceiver ทุก connection (แก้ §10.2) + วิดีโอ track จาก `state.localStream`
- `pc.restartIce()` เมื่อ failed, สถานะ disconnected ขึ้น "การเชื่อมต่อขาดหาย…" และโชว์ overlay รอ ที่ /face
- ⚠️ ข้อจำกัดเชิงสถาปัตยกรรม: ห้อง `FACE` เป็นห้องสาธารณะห้องเดียว — ถ้ามี operator 2 คนเปิดพร้อมกัน ทุกคนจะ call หากันหมด (mesh) ไม่มีการกันคนที่สาม เหมาะกับ prototype หุ่น 1 ตัว/operator 1 คนเท่านั้น

**2. จอลูกค้า `/face`** — [app.js:364-369](videocall/public/app.js#L364-L369), [server.js:40](videocall/server.js#L40)
- ทำครบตามโจทย์ "ลูกค้าอยู่หน้าหุ่นยนต์": ไม่มี login, ไม่มีปุ่มใดๆ (แถบ `.controls` ถูกซ่อนแล้วตาม §11.6), หน้าหุ่น 3D เต็มจอ, STT เปิดเองฟังเสียงลูกค้า, เสียงพูดของ operator ออกลำโพง, ข้อความ operator ถูกอ่านออกเสียงอัตโนมัติ (peer TTS เปิด auto)
- overlay "กำลังเชื่อมต่อเจ้าหน้าที่…" แสดง/ซ่อนตาม `ontrack` / `peer-left` / disconnected — ลูกค้ารู้สถานะโดยไม่เห็นศัพท์เทคนิค

**3. การควบคุมหุ่นยนต์** — [app.js:542-907](videocall/public/app.js#L542-L907)
- จอยสติ๊ก (ลูกตา, ลาก/WASD), D-pad (หัว/ปาก, กดค้าง/ลูกศร, กดหลายทิศพร้อมกันได้), Space รีเซ็ต, ความเร็ว 3 ระดับจาก Settings
- ส่งคำสั่งซ้ำทุก 50ms ระหว่างกดค้าง → ผ่าน 2 ช่องทางพร้อมกัน: data channel (ให้จอ /face ขยับหน้า 3D ทันที) + MQTT `robot/emotion` (ให้ `deep.py` → Arduino → เซอร์โวจริง)
- ปล่อยปุ่มคีย์บอร์ดตอน window blur ก็เคลียร์ state ถูกต้อง — ไม่มีอาการ "หัวหมุนค้าง"
- ⚠️ หมายเหตุ: wire format ที่ publish ใช้ `Head = 65 + headAngle` (ช่วงจริง 30–100) แต่คอมเมนต์/เอกสารบางจุดบอก center = 65 ช่วง 20–150 — ตรงกันในทางปฏิบัติ แต่ scale ของ D-pad (±35°) ไม่ mirror ช่วงเต็มของเซอร์โว (20–150) เป็นการจำกัดเชิงตั้งใจที่ควรจดไว้ให้คนจูน Arduino ทราบ

**4. แชท + เสียง (การสื่อสารสองทาง)** — ครบทั้ง 4 ทิศทาง:
- operator พิมพ์ → ลูกค้า *ได้ยินเสียง* (peer TTS auto-on) ✅
- operator พูด (กดปุ่มพูด) → STT → ส่งเป็นข้อความ + ลูกค้าได้ยิน ✅ (และเสียงสดผ่าน WebRTC อยู่แล้วบนเดสก์ท็อป)
- ลูกค้าพูดหน้าหุ่น → auto-STT → โผล่ในแชท operator ✅ (แก้ routing bug แล้วใน §9.4)
- เสียงสดสองทางผ่าน WebRTC ✅ (ยกเว้น trade-off มือถือระหว่าง STT ฟังอยู่ — §9.5)

**5. STT สองโหมด** — Browser STT (default, ต่อเนื่อง, exponential backoff กัน restart รัว) / Whisper (Groq, ตัดที่ความเงียบ 1.5s) — สลับได้ใน Settings ทั้งคู่เคารพโหมดที่เลือกแม้ที่ /face

### 12.3 ฟีเจอร์สนับสนุน

- **MQTT proxy `/ws/mqtt`** ([server.js:334-364](videocall/server.js#L334-L364)) — ค่าเริ่มต้น `mqttUrl` ตอนนี้ derive จาก origin ปัจจุบันเสมอ (จงใจไม่ persist — [app.js:201](videocall/public/app.js#L201)) แปลว่าเปิดผ่าน Cloudflare tunnel ก็ได้ MQTT ผ่าน URL เดียวกันเลย checklist §8 ข้อ "เปลี่ยน broker เป็น local" **ไม่จำเป็นอีกต่อไป** — เป็น default แล้ว
- **Session tracking** — ครบวงจร start/end/beacon + ตาราง `/api/sessions` — ตอบโจทย์ "ผู้พิการทำงาน" ในแง่มีหลักฐานเวลาทำงาน แต่ยังไม่มีหน้า UI ดูรายงาน (ต้องเรียก API ตรง)
- **AI Settings** — ระบบ provider/key/model ทำงานตามที่ออกแบบ ปุ่ม Save ตอนอยู่โหมดคุยกับคนจะ reconnect MQTT ให้เอง
- **Help modal** — เนื้อหาสอนครบทั้ง workflow และคีย์ลัด

### 12.4 ปัญหา/ความคลาดเคลื่อนที่พบรอบนี้

| # | ที่ | ระดับ | ปัญหา |
|---|---|---|---|
| 40 | `index.html` help modal | 🟡 Stale docs | คู่มือยังอ้าง "เพศเสียงได้ที่ **AI Voice Gender**" ทั้งที่ตัวเลือกนี้ถูกลบไปแล้วใน §11.8 (#39) — ผู้ใช้จะหาไม่เจอ |
| 41 | เอกสาร (`videocall/CLAUDE.md`, REVIEW.md §2.7) | 🟡 Stale docs | ฟีเจอร์ **Translation** (`/api/translate`, ปุ่มแปลภาษา) และ **STT correction** (`/api/stt-correct`) **ไม่มีอยู่ในโค้ดแล้ว** — grep ทั้ง `app.js`/`server.js`/`index.html` ไม่พบ endpoint/ฟังก์ชันเหล่านี้เลย แต่เอกสารอ้างอิงยังบรรยายละเอียดอยู่ |
| 42 | `app.js` [2012-2014](videocall/public/app.js#L2012-L2014) | 🟢 Dead code | `const _origEndCall = endCall;` ประกาศไว้แล้วไม่ถูกใช้ (คอมเมนต์เองก็บอกว่าไม่ทำอะไร) |
| 43 | `public/face/index.html` | 🟢 Dead code | ไฟล์ /face เวอร์ชันเก่ายังอยู่ (เคยรายงานใน §11.7 ว่าชะลอการลบไว้ — ยืนยันว่ายังอยู่จริง) |
| 44 | สถาปัตยกรรมห้อง `FACE` | 🔵 Note | ห้องเดียวสาธารณะ ไม่มี authentication/การจองสาย — operator หลายคนหรือคนแปลกหน้าที่รู้ URL เข้าห้องชนกันได้ พอสำหรับ prototype แต่ต้องแก้ก่อนใช้งานจริงหลายหุ่น/หลาย operator |
| 45 | `endCall()` โหมดคุยกับคน | 🔵 Note | "วางสาย" แล้ว rejoin `FACE` ทันที — ถ้าอีกฝ่าย (จอ /face) ยังอยู่ในห้อง สายจะต่อกลับเองภายในไม่กี่วินาที การวางสายจึงเป็นแค่ "รีเซ็ตการเชื่อมต่อ" ไม่ใช่การจบงานจริง สอดคล้องกับ kiosk workflow แต่ควรรู้ไว้ว่าปุ่มนี้ไม่ได้ "ปิดบริการ" |

(#40 คือปัญหาเดียวที่ควรแก้เร็ว — แก้ข้อความคู่มือ 1 บรรทัด; #41 แก้โดยอัปเดต `videocall/CLAUDE.md`; ที่เหลือเป็นเรื่องจดไว้เพื่อรอบถัดไป)

### 12.5 สรุปเทียบเป้าหมาย CLAUDE.md

| เป้าหมาย | สถานะ |
|---|---|
| ลูกค้าอยู่หน้าหุ่นยนต์ คุยกับ operator ผ่านเว็บ | ✅ ครบ — /face kiosk + auto ทุกอย่าง ลูกค้าไม่ต้องแตะจอ |
| operator อยู่หน้าคอม ให้บริการพูดคุย | ✅ ครบ — โหมดคุยกับคนเป็น default, เสียง+ข้อความ+TTS สองทาง |
| ควบคุมหุ่นยนต์ผ่านเว็บ | ✅ ครบ — จอยสติ๊ก/D-pad/คีย์บอร์ด → 3D preview + Arduino ผ่าน MQTT |
| ผู้พิการใช้ทำงานได้ | ✅ ส่วนใหญ่ — a11y สะสมจาก §3–§11; ที่เหลือคือ #18/#21/#22 (นอกขอบเขตเดิม) |
| ไม่โฟกัส talk with AI | ✅ ซ่อนเป็นค่าเริ่มต้นแล้ว โค้ดยังอยู่ เปิดกลับได้ |

**ข้อสรุป:** ทุกฟีเจอร์ที่เป็นเส้นทางงานหลักตาม CLAUDE.md ใช้งานได้จริงและตรงเป้าหมาย ฟีเจอร์นอกเป้าหมาย (AI/YOLO/timing) ถูกลดบทบาทอย่างถูกต้องโดยไม่ลบโค้ด สิ่งที่ควรทำต่อคือรายการใน §12.4 (โดยเฉพาะ #40 แก้คู่มือ 1 จุด และ #41 อัปเดตเอกสารอ้างอิงให้ตรงโค้ด) และพิจารณาเรื่องห้อง `FACE` สาธารณะ (#44) ก่อนขยายเกิน prototype

---

## 13. แก้บั๊ก: หุ่นยนต์กระตุก/ไม่ smooth เมื่อสั่งงานผ่าน MQTT (4 กรกฎาคม 2569)

**อาการ:** ควบคุมหุ่นด้วยจอยสติ๊ก/D-pad แล้วเซอร์โวจริงขยับกระตุกเป็นช่วงๆ หน่วง ไม่ลื่นไหล

**สาเหตุ (3 จุดประกอบกัน):**

1. **เบราว์เซอร์ publish ถี่เกินขีดของฮาร์ดแวร์** — จอยสติ๊กเรียก `publishRobotState()` ทุก pointer-move (60+ Hz) และ D-pad ทุก 50ms ยิงเข้า MQTT ทุกเฟรม
2. **`deep.py` เปิด thread ใหม่ต่อ 1 message แล้วเขียน serial ทันทีโดยไม่มี flow control** — Arduino มี serial buffer แค่ 64 bytes และเล่น motion ทีละคำสั่งจนจบ (`RUN COMPLETE`) คำสั่งที่ยิงเร็วกว่านั้นจึงค้างคิว → หุ่นไล่เล่น "ตำแหน่งเก่า" ทีละอันตามหลังมือผู้ใช้ = อาการกระตุก/หน่วงที่เห็น
3. **`deep.py` ยังต่อ `test.mosquitto.org:8081` (public broker ข้ามอินเทอร์เน็ต)** ทั้งที่ระบบมี Mosquitto local แล้ว (§6.1 แก้ฝั่งเว็บไปแล้วแต่ไม่ได้แก้ฝั่ง Python) — latency แกว่ง 100–500ms ทำให้คำสั่งมาถึงเป็นชุดสลับช่วงเงียบ

**แก้แล้ว:**

| ไฟล์ | การแก้ |
|---|---|
| `deep.py` (root + `videocall/deep.py` sync กัน) | (1) เปลี่ยน broker เริ่มต้นเป็น `localhost:1883` TCP (มี flag `USE_TLS_WEBSOCKETS` สลับกลับ public broker ได้) (2) เลิก thread-per-message → **serial worker เดี่ยว + เก็บเฉพาะคำสั่งล่าสุด (coalescing)** — เฟรมเก่าที่ยังไม่ถูกส่งจะถูกทับทิ้ง ไม่เกิดคิวค้าง (3) ทุกเฟรมรอ `RUN COMPLETE` เป็น flow control (live frame timeout 1s แบบไม่เตือน, sequence 30s เหมือนเดิม) (4) `drain_serial()` ก่อนส่ง กัน `RUN COMPLETE` ตกค้างหลอก wait รอบถัดไป (5) เฟรม live ที่เข้ามาใหม่ interrupt sequence ที่กำลังเล่นได้ — operator แย่งคุมคืนจาก AI emotion ได้ทันที |
| `app.js` `publishRobotStateMQTT()` | Throttle การ publish MQTT เหลือ ~15 Hz แบบ trailing-edge — เฟรมสุดท้าย (เช่นตอนปล่อยจอย/กดรีเซ็ต) ถูกส่งเสมอ ไม่มีทางค้างตำแหน่งเก่า ส่วน **data channel ยังส่งเต็มอัตราเหมือนเดิม** หน้า 3D บน /face จึงลื่นเท่าเดิม |
| `app.js` MQTT `message` handler | จอที่มี data channel เปิดอยู่จะข้ามเฟรม live เดี่ยวที่มาจาก MQTT (ซ้ำกับ DC ที่สดกว่า) — ตัดอาการหน้า 3D บน /face สั่นเด้งไปมาระหว่างตำแหน่งใหม่จาก DC กับตำแหน่งเก่าจาก MQTT และตัด loopback ของฝั่ง operator เอง; **AI emotion sequence (JSON array) ยังเล่นผ่าน MQTT ตามเดิม** |

**ยืนยัน:** `python -m py_compile deep.py` ผ่าน, `node --check app.js` ผ่าน

**สิ่งที่ควรทดสอบกับฮาร์ดแวร์จริง:** (1) ลากจอยค้างวนเป็นวงกลม — หัว/ตาต้องไล่ตามต่อเนื่องไม่สะดุด (2) กด D-pad ค้าง — ต้องขยับเนียนด้วยความเร็วคงที่ (3) ปล่อยมือ — หุ่นต้องหยุดที่ตำแหน่งล่าสุดจริง ไม่เด้งกลับตำแหน่งเก่า (4) ให้ AI ส่ง emotion sequence แล้วขยับจอยแทรก — จอยต้องแย่งคุมได้ทันที · หมายเหตุ: ความเร็วสูงสุดตอนนี้ถูก pace ด้วยจังหวะ `RUN COMPLETE` ของเฟิร์มแวร์ ถ้าเฟิร์มแวร์เล่น motion ช้า หุ่นจะขยับ "ทีละก้าวใหญ่ขึ้น" แทนที่จะกระตุก — ถ้าอยากให้ไวขึ้นต้องลดเวลา motion ในฝั่ง Arduino

---

*รีวิวโดย Claude Code — 25 มิถุนายน 2569, ติดตามผล 3 กรกฎาคม 2569, แก้ไขปัญหา + เพิ่ม auto-STT ที่ /face + แก้บั๊กมือถือ + รีวิวยืนยันรอบสุดท้าย — 3 กรกฎาคม 2569, declutter UI + accessibility ตาม CODEXREVIEW.md + เอาฟีเจอร์วลีด่วน/เลือกเพศเสียงออกตามคำขอผู้ใช้ — 4 กรกฎาคม 2569, รีวิวทุกฟีเจอร์เทียบเป้าหมาย CLAUDE.md — 4 กรกฎาคม 2569*

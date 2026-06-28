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

*รีวิวโดย Claude Code — 25 มิถุนายน 2569*

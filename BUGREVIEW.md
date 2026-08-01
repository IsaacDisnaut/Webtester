# BUGREVIEW — ตรวจสอบบั๊กของโปรเจค Avatar Robot VideoCall
**วันที่รีวิว:** 20 กรกฎาคม 2569
**ผู้รีวิว:** Claude Code
**ขอบเขต:** working-tree ที่ยังไม่ commit ใน submodule `videocall/` (`public/app.js`, `public/index.html`, `public/face/index.html`, `public/robot/head.urdf`, `public/style.css`, `CLAUDE.md`, `SKILL.md`) เทียบกับ commit ล่าสุด `54ad72d`, บวกไฟล์ที่แก้ในโปรเจคหลัก (`mosquitto/mosquitto-local.conf`, `start-local.bat`)

**บริบท:** งานนี้ต่อยอดจาก `REVIEW.md` §14–19 และ `CODEXREVIEW.md` (รีวิว "operator ตาบอด + TalkBack" เมื่อ 14–15 กรกฎาคม 2569) ซึ่งพบบั๊ก A1–A10 (REVIEW.md) และ P0–P2 (CODEXREVIEW.md) ไปแล้วรอบหนึ่ง โค้ดปัจจุบันแก้ A1–A6 ครบและทดสอบซ้ำแล้ว รีวิวรอบนี้คือ **ตรวจยืนยันของเก่าที่ยังไม่ปิด (A7–A10, P1 บางข้อ) กับโค้ดจริงล่าสุด + หาบั๊กใหม่ที่ยังไม่เคยมีบันทึก**

---

## สรุปผล

| # | บั๊ก | ความรุนแรง | สถานะ |
|---|---|---|---|
| 1 | ข้อผิดพลาดสำคัญ (กล้อง/ไมค์/WebRTC/STT/AI/เครือข่าย) ไม่ถูกประกาศให้ screen reader เลย | **สูง** | ยังไม่แก้ (ยืนยันซ้ำ = A8/P0) |
| 2 | D-pad ประกาศตำแหน่งหัว/ปากทุกครั้งแม้ MQTT ไม่ได้เชื่อมต่อ | **สูง** | ยังไม่แก้ (ยืนยันซ้ำ = P1 ใน CODEXREVIEW.md) |
| 3 | เอกสาร `CLAUDE.md` ระบุทิศทาง Head servo สลับกับพฤติกรรมจริงของโค้ด | **กลาง** | บั๊กใหม่ (พบรอบนี้) |
| 4 | แท็บโหมด "คุยกับ AI / คุยกับคน" ไม่ประกาศสถานะ active | **กลาง** | ยังไม่แก้ (ยืนยันซ้ำ = A9) |
| 5 | ปุ่มคัดลอกรหัสห้องกดแล้วไม่มีเสียงยืนยัน | **ต่ำ** | ยังไม่แก้ (ยืนยันซ้ำ = A7) |
| 6 | `#chat-messages` ไม่มี `role="log"`, typing indicator ไม่มี text alternative, `#join-input`/`#chat-input` ไม่มี label | **ต่ำ** | ยังไม่แก้ (ยืนยันซ้ำ = A10) |
| 7 | ปุ่ม 🔊 อ่านออกเสียง และปุ่มส่งข้อความ ยังมี label ภาษาอังกฤษ/สองภาษาหลงเหลือ | **ต่ำ** | บั๊กใหม่ (ตกหล่นจากการล้าง label รอบ A6) |
| 8 | `deep.py` (root) ผูก default MQTT broker เป็น LAN IP ส่วนตัวของเครื่องเดิม | **สูง** | **✅ แก้แล้ว + ทดสอบ end-to-end แล้ว (21 ก.ค. 2569)** |
| 9 | `yolo.py`/`yolo_server.py` ผูก path แพ็กเกจ Python ส่วนตัว (`D:\python_packages`) | **กลาง** | ยังไม่แก้ |
| 10 | `videocall/CLAUDE.md` อ้างอิงฟีเจอร์ Translation/STT-correction ที่ถูกลบไปแล้ว + เอกสาร D-pad ล้าสมัย | **ต่ำ** | ยังไม่แก้ |

---

## รายละเอียด

### 1. ข้อผิดพลาดสำคัญไม่ถูกประกาศให้ screen reader — สูง (ยืนยันซ้ำ A8/P0)

`showSystemMsg()` ([app.js:1785](videocall/public/app.js#L1785)) เขียนข้อความลงในแชทเท่านั้น ไม่เคยเรียก `announceAccessibility()` เลยแม้แต่ครั้งเดียว และ `#chat-messages` ถูกถอด `aria-live` ออกไปแล้วโดยตั้งใจ (เพื่อไม่ให้ TalkBack อ่านทุกข้อความในแชท) ผลคือเหตุการณ์ระดับวิกฤตต่อไปนี้ **เงียบสนิทสำหรับ operator ตาบอด**:

- ไม่ได้รับอนุญาตกล้อง/ไมค์ ([app.js:433](videocall/public/app.js#L433))
- ไม่พบกล้อง/ไมค์ ([app.js:435](videocall/public/app.js#L435), [437](videocall/public/app.js#L437))
- WebRTC ICE connection ล้มเหลว ([app.js:2053](videocall/public/app.js#L2053))
- signaling server เชื่อมต่อผิดพลาด — `socket.on('connect_error', ...)` ([app.js:2007](videocall/public/app.js#L2007))
- ถอดความเสียง (Whisper) ผิดพลาด ×2 จุด ([app.js:1555](videocall/public/app.js#L1555), [1557](videocall/public/app.js#L1557))
- ไมโครโฟนมีปัญหา ([app.js:1509](videocall/public/app.js#L1509)), ไม่มีเสียงถูกบันทึก ([app.js:1467](videocall/public/app.js#L1467))
- AI ตอบผิดพลาด / เครือข่ายผิดพลาดขณะคุยกับ AI ([app.js:1918](videocall/public/app.js#L1918), [1930](videocall/public/app.js#L1930))
- วางสาย ([app.js:2167](videocall/public/app.js#L2167))

**ผลกระทบ:** operator ตาบอดที่กำลังคุยกับลูกค้าหน้าหุ่นยนต์ อาจไม่รู้เลยว่ากล้องถูกปฏิเสธสิทธิ์ (ลูกค้าไม่เห็นหน้า operator), สายหลุดจาก ICE failure, หรือ Whisper ถอดเสียงพัง — ทั้งหมดนี้เป็นความล้มเหลวของ "ช่องทางหลักในการทำงาน" ตรงเป้าหมายโปรเจคใน `CLAUDE.md` (ให้ผู้พิการทำงานผ่าน video call ได้) โดยตรง

**แนวแก้ที่แนะนำ:** เพิ่มพารามิเตอร์ `announce` ให้ `showSystemMsg(text, announce = false)` แล้วเรียก `announceAccessibility(text, true)` ควบคู่ที่ call site ข้างต้นทั้งหมด (คอมเมนต์ A8 เดิมใน REVIEW.md ก็เสนอแนวทางนี้ไว้แล้ว)

### 2. D-pad ประกาศตำแหน่งแม้ MQTT ไม่ได้เชื่อมต่อ — สูง (ยืนยันซ้ำ P1)

`announceDPadState()` ([app.js:1052](videocall/public/app.js#L1052)) และ `applyDPadTap()` ([app.js:1041](videocall/public/app.js#L1041)) อ่านค่าจาก `robotState` (state ในเบราว์เซอร์) ล้วนๆ ไม่เคยเช็ค `mqttClient.connected` เลย ขณะที่การส่งคำสั่งจริงใน `publishRobotStateMQTT()` ([app.js:786-787](videocall/public/app.js#L786-L787)) จะ `return` เงียบๆ ทันทีถ้า `!mqttClient.connected`

`announceMqttChange()` ([app.js:142](videocall/public/app.js#L142)) ที่เพิ่มใน A1 แก้ได้แค่ "ประกาศตอนสถานะเปลี่ยน" (ต่อหุ่นแล้ว/หุ่นหลุด) แต่หลังจากนั้น **ทุกครั้งที่กด D-pad ระบบยังคงพูด "หัวซ้าย 12" อย่างมั่นใจ** ทั้งที่คำสั่งไม่ถูกส่งออกไปเลย เพราะ `announceDPadState` ไม่ได้ผูกกับสถานะ MQTT ปัจจุบัน — นี่คือ "false confidence" ที่ CODEXREVIEW.md เคยเตือนไว้เป็นประเด็น P1 ("การควบคุมหุ่นยนต์ประกาศ 'หัว/ปากเปลี่ยน' แม้ MQTT ไม่พร้อม") และยังไม่ถูกปิด

**แนวแก้ที่แนะนำ:** ใน `announceDPadState`/tap-boost path เช็ค `mqttClient && mqttClient.connected` ก่อน แล้วประกาศ "หุ่นยนต์ออฟไลน์ — คำสั่งไม่ถูกส่ง" แทน (จำกัดความถี่ ไม่ spam ทุกแท็บ) ตามที่ CODEXREVIEW.md เสนอไว้

### 3. เอกสาร CLAUDE.md ระบุทิศทาง Head servo สลับด้าน — กลาง (พบใหม่)

`CLAUDE.md` ([videocall/CLAUDE.md:568](videocall/CLAUDE.md#L568)) ระบุว่า:

> `Head` 0–90 (center 45) — Servo degrees for head rotation (**0 = left, 90 = right**)

แต่โค้ดจริงทำตรงกันข้าม: ปุ่ม D-pad ซ้าย (`data-dir="left"`, aria-label "หัวซ้าย") เรียก `applyDPad()` ซึ่ง **เพิ่ม** `robotState.headAngle` ([app.js:1027](videocall/public/app.js#L1027)) และ `publishRobotState()` แปลงเป็นค่า wire ด้วย `WIRE_HEAD_BASE(45) + headAngle` แล้ว clamp 0–90 — headAngle ยิ่งมาก ค่า `Head` ยิ่งเข้าใกล้ 90 ดังนั้น **`Head` เท่ากับ 90 คือ "หันซ้าย" ไม่ใช่ "หันขวา"** ตามที่ตารางบอก (และตรงกันข้ามคือ `Head=0` คือ "หันขวา") ระบบเสียงประกาศเองก็ยึด convention เดียวกับโค้ด: `announceDPadState` พูด "ซ้าย" เมื่อ `headAngle > 0` ([app.js:1052-1058](videocall/public/app.js#L1052-L1058)) — สอดคล้องกับพฤติกรรมจริง ไม่สอดคล้องกับตารางในเอกสาร

**ผลกระทบ:** ถ้าใครต่อฮาร์ดแวร์ (servo คอหุ่น InMoov ผ่าน `deep.py`/Arduino) โดยอิงตารางนี้เป็นสเปค อาจเข้าใจผิดว่า wire value สูง = หันขวา แล้วเดินสายหรือ calibrate servo กลับด้านกับที่ D-pad/UI สื่อสารจริง (กด "หัวซ้าย" บนจอ แต่หุ่นหันขวาจริง) — เป็นความเสี่ยงเฉพาะตอน integrate ฮาร์ดแวร์จริง ไม่กระทบพฤติกรรมซอฟต์แวร์ล้วนๆ (ฝั่ง JS สอดคล้องกันเองทั้งระบบ)

**แนวแก้ที่แนะนำ:** แก้ตารางใน `CLAUDE.md:568` และบรรทัด mapping ที่ [CLAUDE.md:313](videocall/CLAUDE.md#L313) ให้เป็น `0 = right, 90 = left` (หรือยืนยันทิศทางจริงจากหุ่น InMoov ก่อน แล้วเขียนให้ตรง — ถ้าฝั่งฮาร์ดแวร์ตั้งใจให้ "left" หมายถึงมุมมองจากตัวหุ่นเอง ไม่ใช่จากผู้ดู ให้ระบุไว้ในเอกสารให้ชัดว่าเป็นมุมมองไหน)

### 4. แท็บโหมดไม่ประกาศสถานะ active — กลาง (ยืนยันซ้ำ A9)

`applyMode()` ([app.js:518-522](videocall/public/app.js#L518-L522)) toggle เฉพาะ CSS class `.active` บนปุ่ม `.mode-btn` ([index.html:61](videocall/public/index.html#L61), [67](videocall/public/index.html#L67)) ไม่มี `aria-pressed`/`aria-selected`/`aria-current` เลย ผลกระทบตอนนี้เบา (ค่าเริ่มต้นซ่อนแท็บ "คุยกับ AI" เหลือปุ่มเดียวผ่าน `applyAiModeVisibility()`) แต่ถ้าเปิด `showAiMode` กลับมา operator ที่ใช้ screen reader จะไม่รู้ว่ากำลังอยู่โหมดไหน

### 5. ปุ่มคัดลอกรหัสห้องไม่มีเสียงยืนยัน — ต่ำ (ยืนยันซ้ำ A7)

`copyCodeBtn.addEventListener('click', ...)` ([app.js:2345-2350](videocall/public/app.js#L2345-L2350)) เปลี่ยนแค่ `textContent` เป็น "คัดลอกแล้ว!" แล้ว `setTimeout` เปลี่ยนกลับใน 1.5 วิ ไม่มีการเขียนลง live region เลย — screen reader ไม่อ่านการเปลี่ยน text ของปุ่มที่ไม่ใช่ live region จึง operator ไม่รู้ว่าคัดลอกสำเร็จหรือยัง

### 6. ช่องโหว่ ARIA เล็กๆ ที่เหลือ — ต่ำ (ยืนยันซ้ำ A10)

- `#chat-messages` ([index.html:308](videocall/public/index.html#L308)) มี `aria-label` บน `<div>` เปล่าที่ไม่มี role รองรับ — ควรเป็น `role="log"` เพื่อให้ label มีผลจริงใน accessibility tree
- typing indicator (จุดเด้ง 3 จุด, [app.js:1750-1754](videocall/public/app.js#L1750-L1754)) ไม่มี `aria-hidden`/label ใดๆ — swipe ไปเจอ element ว่างเปล่า
- `#join-input` ([index.html:107](videocall/public/index.html#L107)) และ `#chat-input` ([index.html:315](videocall/public/index.html#L315)) มีแต่ `placeholder` ไม่มี `<label>`/`aria-label`

### 7. Label ภาษาอังกฤษหลงเหลือ — ต่ำ (พบใหม่ — ตกหล่นจากรอบ A6)

A6 (REVIEW.md §15) ตั้งใจล้าง label ภาษาอังกฤษ/สองภาษาออกทั้งหมด แต่ยังตกหล่น 2 จุด:

- ปุ่มอ่านออกเสียงข้อความคู่สนทนา: `speakBtn.title = 'Read aloud / อ่านออกเสียง'` ([app.js:1733](videocall/public/app.js#L1733)) — เป็นภาษาอังกฤษนำ และไม่มี `aria-label` เลย (มีแต่ `title` ซึ่งเบราว์เซอร์/screen reader บางตัวไม่อ่านให้)
- ปุ่มส่งข้อความ: `title="Send message" aria-label="ส่งข้อความ (Send message)"` ([index.html:316](videocall/public/index.html#L316)) — ยังมีวงเล็บอังกฤษเหลืออยู่ ต่างจากปุ่มอื่นๆ ที่ล้างหมดแล้ว

---

## จุดที่ตรวจแล้วไม่พบบั๊ก (เพื่อไม่ให้ตรวจซ้ำ)

- Wire-format canonicalization (`Head 0-90 center 45`, `Mouth 30-100`) สอดคล้องกันครบระหว่าง `app.js` (`WIRE_HEAD_*`), `public/face/index.html` (ค่า default ตอนยังไม่มีข้อความ) และ `public/robot/head.urdf` (`limit lower/upper` ขยายจาก ±0.5236 เป็น ±0.7854 rad = ±45°) — เดิมค่า default ใน `/face` (Head=65, Mouth=20, หาร 130) ไม่ตรงกับค่าคงที่จริงเลย ตอนนี้แก้เป็น Head=45/Mouth=30/หาร 70 ตรงกันแล้ว
- MQTT self-echo loopback dedup (`isRecentSelfPub`/`rememberSelfPub`, [app.js:206-214](videocall/public/app.js#L206-L214)) — ทำงานถูกต้อง ป้องกัน echo ของตัวเองมากวนจอย โดยไม่กระทบข้อความจากอีกฝั่งจริง
- Joystick tap-vs-drag detection (`DRAG_START_PX`), `touchcancel` handling, D-pad tap-boost + click-vs-touch double-fire guard (`lastHandledAt`) — ตรวจ logic ครบ ไม่พบ race condition หรือ double-apply ในเส้นทางปกติ
- `announceAccessibility` clear-then-set + auto-clear 5 วิ, region คู่ polite/assertive — ทำงานตามที่เอกสารอธิบายไว้ใน REVIEW.md §16/§19
- `mosquitto/mosquitto-local.conf`, `start-local.bat` — เป็นแค่แก้ path (`DeepdarkFamtasy` → `For4Aug` จากการเปลี่ยนชื่อโฟลเดอร์โปรเจค) และเพิ่ม step รัน `deep.py` bridge เข้า flow ไม่พบปัญหา logic
- `create_google_form.gs` — เรียก Google Apps Script `FormApp` API ถูกต้อง ไม่พบบั๊ก (ไม่ใช่ส่วนหนึ่งของระบบซอฟต์แวร์หลัก)

---

## ลำดับความสำคัญที่แนะนำ

1. **#1 (ข้อผิดพลาดสำคัญไม่ถูกประกาศ)** — กระทบ core use case ของโปรเจคโดยตรง (operator พิการทำงานผ่าน video call) ควรแก้ก่อนใช้งานจริงแบบไม่มีผู้ช่วยเหลือใกล้ชิด
2. **#2 (D-pad ประกาศตำแหน่งทั้งที่ MQTT หลุด)** — ความเสี่ยงด้าน "ความน่าเชื่อถือของคำสั่งควบคุมหุ่นยนต์จริง" โดยตรง
3. **#3 (เอกสารทิศทาง Head สลับ)** — แก้ก่อน integrate ฮาร์ดแวร์จริงรอบถัดไป กัน servo เดินสายผิดทิศ
4. **#4–#7** — งานเก็บรายละเอียดด้าน accessibility ตามที่ REVIEW.md §14.2 จัดลำดับไว้แล้ว (A7/A9/A10) บวกจุดใหม่เล็กๆ (label ภาษาอังกฤษหลงเหลือ)

*อ้างอิงงานก่อนหน้า: `REVIEW.md` §1–19, `CODEXREVIEW.md` (รีวิว operator ตาบอด 2026-07-15), `BUGREPORT.md` (verify รอบ 2026-07-09)*

---

## รอบที่ 2 (20 กรกฎาคม 2569) — ขยายขอบเขตไปฝั่ง backend/Python

รอบแรกตรวจเฉพาะ diff ฝั่ง frontend (`app.js`/`index.html`/`style.css`) ที่ยังไม่ commit รอบนี้ไม่มีโค้ดใหม่เพิ่มเข้ามา (git diff เหมือนเดิมทุกไฟล์) จึงขยายขอบเขตไปตรวจ `server.js`, `deep.py` (ทั้งสองชุด), `yolo.py`/`yolo_server.py`, `api.py`, Docker/compose ที่ยังไม่เคยตรวจละเอียดในรอบก่อน พบบั๊กใหม่ 3 กลุ่ม:

### 8. `deep.py` (root) ผูก default broker เป็น LAN IP ส่วนตัวของเครื่องเดิม — **สูง — ✅ แก้แล้วและทดสอบแล้ว (21 กรกฎาคม 2569 — ดูรอบที่ 3 ท้ายไฟล์)**

[`deep.py:20`](deep.py#L20) (โค้ดก่อนแก้):
```python
BROKER = os.environ.get("MQTT_BROKER", "192.168.1.146")  # LAN IP — reaches the web app's broker, not the loopback service
```

ค่า default ไม่ใช่ `localhost`/`127.0.0.1` แต่เป็น IP วง LAN ของเครื่องที่พัฒนาไฟล์นี้ไว้ (ตามคอมเมนต์ในไฟล์ อธิบายว่ามาจากปัญหา Mosquitto Windows Service ตัวเก่าที่แอบ bind `127.0.0.1:1883` แย่งพอร์ตกับ instance ที่ `start-local.bat` เปิดขึ้นมาใหม่ — เป็น workaround เฉพาะเครื่องนั้น) `start-local.bat` ([start-local.bat:57](start-local.bat#L57)) รันไฟล์นี้ตรงๆ โดยไม่ได้ตั้งค่า `MQTT_BROKER` env var ให้ และไม่มีเอกสารที่ไหนบอกผู้ใช้ใหม่ว่าต้องตั้งค่านี้เอง (README.md มีบรรทัดเดียวคือ "Run start-local.bat")

**ผลกระทบ:** ผู้ใช้ที่ clone โปรเจคนี้ไปรันบนเครื่อง/เครือข่ายอื่น (ซึ่งไม่มี IP `192.168.1.146` อยู่จริงในวง LAN ของตัวเอง) จะเห็น `deep.py` วน retry "MQTT connect failed ... — retrying in 5 s" ไม่รู้จบในหน้าต่าง cmd แยกที่ผู้ใช้ทั่วไปมักไม่ทันสังเกต — **หุ่นยนต์จะไม่ขยับเลยแม้ UI จะทำงานปกติทุกอย่าง** เป็นบั๊ก "ใช้ได้แค่เครื่องที่เขียนโค้ดนี้" ที่ร้ายแรงที่สุดเท่าที่พบในโปรเจคนี้ เพราะไม่มี error ที่ผู้ใช้เห็นในเว็บเลย (ฝั่งเว็บเห็นแค่ MQTT broker ของตัวเองต่อติด — `deep.py` เป็นอีก client หนึ่งที่แยกกันเชื่อมต่อ)

**แนวแก้ที่แนะนำ:** เปลี่ยน default กลับเป็น `"localhost"` และย้ายเรื่อง LAN-IP-workaround ไปเป็นคำแนะนำใน README/comment สำหรับกรณีเจอ conflict เท่านั้น (ตรวจสอบ `net stop mosquitto` ตามที่คอมเมนต์แนะนำไว้แล้วเป็นทางแก้ถาวรที่ดีกว่า) หรืออย่างน้อยให้ `start-local.bat` echo คำเตือนชัดๆ ว่าอาจต้องตั้ง `set MQTT_BROKER=...` เอง

### 9. `yolo.py`/`yolo_server.py` ผูก path แพ็กเกจ Python ส่วนตัวของเครื่องเดิม — **กลาง**

พบในทั้ง 4 ไฟล์ (root และสำเนาใน `videocall/`):

- [yolo_server.py:2](yolo_server.py#L2), [yolo.py:2](yolo.py#L2)
- [videocall/yolo_server.py:2](videocall/yolo_server.py#L2), [videocall/yolo.py:2](videocall/yolo.py#L2)

```python
sys.path.insert(0, r"D:\python_packages")
```

Hardcode path เฉพาะเครื่องเดิมที่เก็บ `ultralytics`/`opencv-python`/`numpy` ไว้นอก site-packages ปกติ ถ้าเครื่องอื่นไม่มีโฟลเดอร์นี้และไม่ได้ `pip install` แพ็กเกจพวกนี้แบบปกติ สคริปต์จะ `ModuleNotFoundError` ทันทีตอน `import cv2`/`from ultralytics import YOLO` — ฟีเจอร์ YOLO object detection ใช้ไม่ได้เลยบนเครื่องอื่น เป็นบั๊กรูปแบบเดียวกับข้อ 8 (ค่าคงที่เฉพาะเครื่องที่ไม่มีการ fallback/env var/เอกสาร)

**แนวแก้ที่แนะนำ:** ลบบรรทัดนี้ออก (ให้ผู้ใช้ `pip install -r requirements.txt` ตามปกติ) หรือครอบด้วย `if os.path.isdir(...)` เพื่อไม่ให้ทำอะไรบนเครื่องที่ไม่มีโฟลเดอร์นี้

### 10. `videocall/CLAUDE.md` อ้างอิงฟีเจอร์ที่ถูกลบออกจากโค้ดไปแล้ว — **ต่ำ (แต่เข้าใจผิดได้ง่าย)**

`git log` แสดงว่ามีการลบฟีเจอร์ 3 อย่างไปแล้วจริง (commit `01a856a`, `ee76bed`, `9bfec32` — "remove live translation feature", "remove /api/stt-correct endpoint and all client-side STT correction logic", "remove AI Speech Correction from Settings UI and tutorial") ตรวจสอบกับโค้ดปัจจุบันยืนยันว่าลบจริง (ไม่มี match ของ `translate`, `stt-correct`, `correctSTTWithContext` ใน `server.js`/`app.js` เลย) แต่ `videocall/CLAUDE.md` ยังคงมีทั้ง 3 ส่วนนี้อยู่เต็มๆ ราวกับยังใช้งานได้จริง:

- หัวข้อ **"Translation"** ทั้งหมด: `translateText(text)`, `addTranslation(msgWrap, text)`, `toggleTranslate()`, `#translate-btn` ในรายการ event wiring
- Endpoint **`POST /api/translate`** ในรายการ REST Endpoints
- Endpoint **`POST /api/stt-correct`** และหัวข้อ **"STT — context correction"**: `correctSTTWithContext(rawText)`

เพิ่มเติม: หัวข้อ `robotState`/`applyDPad()` ในเอกสารบอกว่ามี field `padDir: 'left'|'right'|'up'|'down'|null` เป็นตัวขับ D-pad และ `headAngle` clamp คงที่ที่ ±35 — โค้ดจริงเปลี่ยนไปใช้ `activeDpadDirs` (Set รองรับกดหลายทิศพร้อมกัน, [app.js:1020](videocall/public/app.js#L1020)) แล้ว และ `headAngle` clamp เป็น ±45 ในโหมด person / ±35 โหมดอื่น ([app.js:1024](videocall/public/app.js#L1024)) — `padDir` ยังหลงเหลือเป็น field ที่ไม่ถูกใช้งานจริงใน `robotState` object ([app.js:600](videocall/public/app.js#L600))

**ผลกระทบ:** ไม่กระทบผู้ใช้ปลายทาง (ฟีเจอร์ที่ลบไปจริงๆ ก็ไม่ปรากฏใน UI) แต่ทำให้เอกสารอ้างอิงหลักของโปรเจค (ที่ตั้งใจให้ AI assistant/นักพัฒนาในอนาคตอ่านเพื่อทำงานต่อ) ชี้ทางผิด — เสียเวลาไปหา endpoint/ฟังก์ชันที่ไม่มีอยู่จริง

**แนวแก้ที่แนะนำ:** ลบ 3 ส่วนนี้ออกจาก `CLAUDE.md` และอัปเดตหัวข้อ `robotState`/`applyDPad()` ให้ตรงกับ `activeDpadDirs` + mode-dependent clamp ปัจจุบัน

---

**สรุปรอบที่ 2:** พบธีมใหม่ที่ไม่เคยถูกบันทึกมาก่อนคือ **ค่าคงที่ผูกกับเครื่องพัฒนาเดิมโดยไม่มี fallback/เอกสาร** (ข้อ 8–9) ซึ่งข้อ 8 ถือเป็นความเสี่ยงสูงสุดที่พบในทั้งโปรเจคจนถึงตอนนี้ เพราะทำให้ "การควบคุมหุ่นยนต์จริง" ใช้ไม่ได้เลยบนเครื่องอื่นโดยไม่มีสัญญาณเตือนในเว็บ ส่วนข้อ 10 เป็นหนี้เอกสาร (documentation debt) ที่ควรเคลียร์คู่กับบั๊กเอกสารทิศทาง Head ที่พบในรอบแรก (ข้อ 3)

---

## รอบที่ 3 (21 กรกฎาคม 2569) — แก้ข้อ 8 และทดสอบ end-to-end จริง

### สิ่งที่ทำ

1. **หยุด + ปิด Windows Service ตัวเก่าถาวร** — `Stop-Service mosquitto -Force` แล้ว `Set-Service mosquitto -StartupType Disabled` (ผ่าน elevated PowerShell) ยืนยันแล้วว่า `Status: Stopped`, `StartType: Disabled` และพอร์ต 1883 ว่างจริง (`Get-NetTCPConnection -LocalPort 1883` ไม่เจอ listener ใดๆ) — service ตัวนี้จะไม่ auto-start ตอนบูตเครื่องอีกต่อไป
2. **แก้ [`deep.py:20`](deep.py#L20)** จาก `BROKER = os.environ.get("MQTT_BROKER", "192.168.1.146")` เป็น `BROKER = os.environ.get("MQTT_BROKER", "localhost")` พร้อมอัปเดตคอมเมนต์ให้อธิบายเงื่อนไข Windows Service conflict, วิธีแก้ถาวร (`net stop mosquitto` + `sc config mosquitto start=disabled`), และวิธี override ต่อเครื่องผ่าน `MQTT_BROKER` env var ไว้เป็นทางเลือกสำรอง (ไม่ได้ลบความสามารถ override ทิ้ง — แค่ไม่บังคับใช้ค่าเฉพาะเครื่องเป็น default อีกต่อไป)

### ทดสอบ end-to-end จริง (ไม่ใช่แค่อ่านโค้ด)

| ขั้น | คำสั่ง | ผล |
|---|---|---|
| 1 | เปิด `mosquitto.exe -c mosquitto/mosquitto-local.conf -v` | บิด bind `0.0.0.0:1883`/`9001`/`9443` สำเร็จทั้ง ipv4/ipv6 (log: `Opening ipv4 listen socket on port 1883` ฯลฯ) — ก่อนหน้านี้พอร์ต 1883 ถูก service ตัวเก่ายึดอยู่ ตอนนี้ว่างแล้วจึง bind ได้เต็ม |
| 2 | `Get-NetTCPConnection -LocalPort 1883,9001,9443` | ทั้งสามพอร์ต bind บน `0.0.0.0`/`::` โดย process เดียว (instance ของโปรเจค) ไม่มีตัวไหนแย่งอีก |
| 3 | รัน `python deep.py` (ไม่ตั้ง `MQTT_BROKER` env var ใดๆ — ใช้ default ใหม่ล้วนๆ) | log: `Connecting to localhost:1883` → `MQTT connected (code Success)` → `Subscribed to robot/emotion` → `Subscribed to robot/control` — ต่อ broker ตัวที่ถูกต้องผ่าน `localhost` สำเร็จจริง |
| 4 | `mosquitto_pub -h localhost -p 1883 -t robot/control -m '{"Head":60,"Mouth":40,"Analog":{"x":0.2,"y":-0.1}}'` (จำลองเบราว์เซอร์ publish คำสั่งจอย/D-pad) | `deep.py` log ขึ้นทันที: `[robot/control] {...}` → `Frame 1/1: {'Head': 60, 'Mouth': 40, ...}` — พิสูจน์ว่าข้อความจากฝั่งเว็บไหลมาถึง `deep.py` ผ่าน `localhost` จริง ไม่ใช่แค่ "ต่อสำเร็จ" เฉยๆ แบบ false-positive ที่บั๊กเดิมจะให้ผลลัพธ์แบบนั้น |
| 5 | เก็บกวาดหลังทดสอบ | หยุด `deep.py`, หยุด instance mosquitto ทดสอบ, เช็ค `Get-NetTCPConnection`/`Get-Process python` ว่าง — ไม่เหลือ process ค้าง |

**สรุปรอบที่ 3:** ข้อ 8 ปิดสมบูรณ์ ทั้งสาเหตุ (service ตัวเก่าถูกปิดถาวร) และอาการ (`deep.py` default เปลี่ยนเป็น `localhost` แล้วพิสูจน์ด้วยการรันจริงว่ารับข้อความจากบั๊คเวอร์ตัวเดียวกับที่เว็บใช้ได้) หมายเหตุ: การแก้นี้ทำบนเครื่องที่ตรวจตอนนี้เท่านั้น — เครื่องอื่นที่รัน `deep.py`/`start-local.bat` จริง (เช่นเครื่องที่ต่อกับ Arduino ของหุ่นยนต์จริง) ถ้ามี Mosquitto Windows Serviceติดตั้งไว้เหมือนกัน ต้องรันขั้นตอนที่ 1 (`net stop mosquitto` + ปิด auto-start) บนเครื่องนั้นเองด้วย ค่า default ใหม่ (`localhost`) ถึงจะถูกต้อง — ไม่งั้นจะกลับไปเจอบั๊กเดิมซ้ำ ข้อ 9 และ 10 ยังไม่ได้แก้ในรอบนี้ (อยู่นอกขอบเขตที่ขอ)

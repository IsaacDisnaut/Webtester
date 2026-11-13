# Avatar Robot — Video Call

ระบบหุ่นยนต์ Avatar ให้ operator ที่อยู่หน้าคอมพูดคุยกับลูกค้าที่อยู่หน้าหุ่นยนต์ผ่าน video call และควบคุมหัว/ตา/ปากหุ่นผ่านเว็บ

- หน้า operator: `https://<tunnel-url>/`
- หน้าหุ่นยนต์ (เปิดบนจอที่หุ่น): `https://<tunnel-url>/face`

## ติดตั้งบนเครื่องใหม่ (Windows)

### 1. Clone พร้อม submodule

```
git clone --recurse-submodules https://github.com/IsaacDisnaut/Webtester.git
```

โฟลเดอร์ `videocall/` เป็น submodule — ถ้าลืม `--recurse-submodules` ไม่เป็นไร `start-local.bat` จะดึงให้เอง
แต่ **อย่าใช้ "Download ZIP"** เพราะ ZIP ไม่มี submodule และดึงตามทีหลังไม่ได้

### 2. ติดตั้งโปรแกรม

| โปรแกรม | คำสั่ง | ใช้ทำอะไร |
|---|---|---|
| Node.js LTS | `winget install OpenJS.NodeJS.LTS` | web server (จำเป็น) |
| cloudflared | `winget install Cloudflare.cloudflared` | URL สาธารณะ HTTPS (จำเป็น) |
| Mosquitto | `winget install EclipseFoundation.Mosquitto` (รันแบบ Admin) | MQTT ควบคุมหุ่น |
| Python 3 | `winget install Python.Python.3.12` | `deep.py` สะพาน MQTT → Arduino |

ใช้ Node.js เวอร์ชัน **LTS** เท่านั้น — เวอร์ชันใหม่กว่านั้น `better-sqlite3` อาจไม่มีไฟล์สำเร็จรูปให้ และ `npm install` จะล้ม
ติดตั้งเสร็จแล้วให้ **ปิดแล้วเปิด terminal ใหม่** ไม่งั้นจะยังหาคำสั่งไม่เจอ

ถ้าติดตั้ง Mosquitto ผ่าน winget มันจะสร้าง Windows service ที่แย่งพอร์ต 1883 — ปิดครั้งเดียว (Admin):

```
net stop mosquitto && sc config mosquitto start=disabled
```

### 3. Python packages

```
pip install paho-mqtt pyserial
```

ถ้าจะใช้ YOLO ด้วย: `pip install ultralytics opencv-python numpy`

### 4. สร้างไฟล์ `apikey`

ไฟล์นี้ไม่อยู่ใน git — สร้างไฟล์ชื่อ `apikey` (ไม่มีนามสกุล) ที่ root ของโปรเจค ข้าง `start-local.bat`:

```
Groq: gsk_xxxxxxxxxxxxxxxx
```

ขอ key ฟรีได้ที่ https://console.groq.com — ถ้าไม่มี video call ยังใช้ได้ แต่ Whisper STT และการแปลภาษาจะใช้ไม่ได้

### 5. Arduino (เฉพาะเครื่องที่ต่อหุ่น)

- Flash `arduino/robot_head/robot_head.ino` ลงบอร์ด
- ดูพอร์ตใน Device Manager ถ้าไม่ใช่ `COM3` ให้ตั้งก่อนรัน: `set ROBOT_SERIAL_PORT=COM5`

### 6. รัน

ดับเบิลคลิก `start-local.bat` — script จะ:

1. ดึง submodule และ `npm install` ให้ถ้ายังไม่มี
2. สร้าง TLS cert ของ Mosquitto และ config ตาม path ของเครื่องนี้ (ครั้งแรกครั้งเดียว)
3. เปิด Mosquitto, web server, `deep.py` แต่ละตัวในหน้าต่างแยก
4. รอจน server พร้อม แล้วเปิด Cloudflare Tunnel — URL `https://xxxx.trycloudflare.com` จะขึ้นในหน้าต่างหลัก

URL เปลี่ยนใหม่ทุกครั้งที่รัน

## แก้ปัญหา

| อาการ | สาเหตุ / วิธีแก้ |
|---|---|
| หน้าเว็บขึ้น **502 Bad Gateway** | web server ไม่ได้รัน — ดู error ในหน้าต่าง "VideoCall Server" |
| `Failed to dial a quic connection` | เครือข่ายบล็อก UDP — script ใช้ `--protocol http2` อยู่แล้ว รอสักครู่จะต่อได้เอง |
| หุ่นไม่ขยับ | ดูหน้าต่าง "Mosquitto MQTT" และ "Robot Bridge (deep.py)" ว่ามี error ไหม, เช็คพอร์ต COM |
| `[WARN] Mosquitto Windows service is running` | ปิด service ตามข้อ 2 |
| STT ขึ้น "ไม่มีเสียงจากไมโครโฟน" | ไมค์ถูกโปรแกรมอื่นจับอยู่ — ปิด LINE/Discord/Zoom/Teams แล้วลองใหม่ |

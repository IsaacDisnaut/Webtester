# Avatar Robot — Video Call

ระบบหุ่นยนต์ Avatar ให้ operator ที่อยู่หน้าคอมพูดคุยกับลูกค้าที่อยู่หน้าหุ่นยนต์ผ่าน video call และควบคุมหัว/ตา/ปากหุ่นผ่านเว็บ

- หน้า operator: `https://<tunnel-url>/`
- หน้าหุ่นยนต์ (เปิดบนจอที่หุ่น): `https://<tunnel-url>/face`

## ติดตั้งบนเครื่องใหม่ (Windows)

### 1. ติดตั้งโปรแกรมผ่าน terminal

เปิด terminal **แบบ Admin**: กด `Win + X` → เลือก **Terminal (Admin)** (หรือ Windows PowerShell (Admin)) แล้ววางทีละบรรทัด:

```
winget install -e --id Git.Git
winget install -e --id OpenJS.NodeJS.LTS
winget install -e --id Cloudflare.cloudflared
winget install -e --id Python.Python.3.12
winget install -e --id EclipseFoundation.Mosquitto
```

| โปรแกรม | ใช้ทำอะไร |
|---|---|
| Git | clone / pull โค้ด (จำเป็น) |
| Node.js LTS | web server (จำเป็น) |
| cloudflared | URL สาธารณะ HTTPS (จำเป็น) |
| Python 3 | `deep.py` สะพาน MQTT → Arduino |
| Mosquitto | MQTT ควบคุมหุ่น |

ถ้าขึ้นถามยอมรับเงื่อนไข (`Do you agree to all the source agreements terms?`) พิมพ์ `Y` แล้ว Enter
ถ้าขึ้น `'winget' is not recognized` — เปิด Microsoft Store ค้นหา **App Installer** กด Update/Install แล้วลองใหม่

ติดตั้งเสร็จแล้ว **ปิด terminal แล้วเปิดใหม่** (ไม่งั้นจะยังหาคำสั่งไม่เจอ) แล้วเช็คว่าครบ:

```
git --version
node --version
cloudflared --version
python --version
```

Mosquitto จะสร้าง Windows service ที่แย่งพอร์ต 1883 — ปิดครั้งเดียว (ใน terminal แบบ Admin):

```
net stop mosquitto
sc config mosquitto start=disabled
```

ใช้ Node.js เวอร์ชัน **LTS** เท่านั้น — เวอร์ชันใหม่กว่านั้น `better-sqlite3` อาจไม่มีไฟล์สำเร็จรูปให้ และ `npm install` จะล้ม

### 2. Clone พร้อม submodule

ใน terminal ไปที่โฟลเดอร์ที่จะเก็บโปรเจค (เช่น `cd D:\`) แล้ว:

```
git clone --recurse-submodules https://github.com/IsaacDisnaut/Webtester.git
cd Webtester
```

โฟลเดอร์ `videocall/` เป็น submodule — ถ้าลืม `--recurse-submodules` ไม่เป็นไร `start-local.bat` จะดึงให้เอง
แต่ **อย่าใช้ "Download ZIP"** เพราะ ZIP ไม่มี submodule และดึงตามทีหลังไม่ได้

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

## อัปเดตโค้ดเวอร์ชันใหม่ (pull)

เปิด terminal ที่โฟลเดอร์โปรเจค แล้วรัน **ทั้งสองบรรทัด**:

```
git pull
git submodule update --init
```

`git pull` อย่างเดียวไม่พอ — มันอัปเดตแค่โปรเจคหลัก ส่วนโค้ดเว็บใน `videocall/` (submodule) จะยังเป็นเวอร์ชันเก่าจนกว่าจะรันบรรทัดที่สอง

ถ้าไม่อยากพิมพ์สองบรรทัดทุกครั้ง ตั้งค่าครั้งเดียวต่อเครื่อง แล้วต่อไป `git pull` จะอัปเดต submodule ให้เอง:

```
git config submodule.recurse true
```

หลัง pull:

1. ปิดหน้าต่างทั้งหมดที่ `start-local.bat` เปิดไว้ แล้วดับเบิลคลิก `start-local.bat` ใหม่ (ถ้า dependencies เปลี่ยน script จะ `npm install` ให้เอง)
2. ในเบราว์เซอร์กด **Ctrl+F5** เพื่อโหลดหน้าเว็บใหม่ ไม่ใช้ไฟล์เก่าที่ cache ไว้

ถ้า `git pull` ขึ้น `Your local changes ... would be overwritten` แปลว่าเคยแก้ไฟล์ในเครื่องนี้เอง — เก็บการแก้ไว้ก่อนแล้ว pull ใหม่:

```
git stash
git pull
git submodule update --init
```

(เรียกคืนการแก้ที่เก็บไว้ด้วย `git stash pop` ถ้าต้องการ)

## แก้ปัญหา

| อาการ | สาเหตุ / วิธีแก้ |
|---|---|
| หน้าเว็บขึ้น **502 Bad Gateway** | web server ไม่ได้รัน — ดู error ในหน้าต่าง "VideoCall Server" |
| `Failed to dial a quic connection` | เครือข่ายบล็อก UDP — script ใช้ `--protocol http2` อยู่แล้ว รอสักครู่จะต่อได้เอง |
| หุ่นไม่ขยับ | ดูหน้าต่าง "Mosquitto MQTT" และ "Robot Bridge (deep.py)" ว่ามี error ไหม, เช็คพอร์ต COM |
| `[WARN] Mosquitto Windows service is running` | ปิด service ตามข้อ 1 |
| STT ขึ้น "ไม่มีเสียงจากไมโครโฟน" | ไมค์ถูกโปรแกรมอื่นจับอยู่ — ปิด LINE/Discord/Zoom/Teams แล้วลองใหม่ |

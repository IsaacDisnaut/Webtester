import json
import time
import threading
import paho.mqtt.client as mqtt
import serial

# ── Config ───────────────────────────────────────────────────
BROKER      = "test.mosquitto.org"
PORT        = 8081
SERIAL_PORT = "COM3"   # change to your port, e.g. /dev/ttyUSB0 on Linux
BAUD_RATE   = 115200

EMOTION_TOPIC = "robot/emotion"

# ── Serial ───────────────────────────────────────────────────
try:
    ser = serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=1)
    print(f"Serial port {SERIAL_PORT} opened at {BAUD_RATE} baud")
except serial.SerialException as e:
    print(f"Warning: could not open serial port {SERIAL_PORT}: {e}")
    ser = None

# ── Helpers ──────────────────────────────────────────────────
def send_to_serial(obj):
    if not (ser and ser.is_open):
        return
    line = json.dumps(obj, separators=(',', ':'))
    ser.write((line + "\n").encode('utf-8'))
    print(f"{SERIAL_PORT} sent: {line}")


def wait_for_run_complete(timeout=30):
    """Block until Arduino sends 'RUN COMPLETE' or timeout expires."""
    if not (ser and ser.is_open):
        return
    deadline = time.time() + timeout
    while time.time() < deadline:
        if ser.in_waiting > 0:
            line = ser.readline().decode('utf-8', errors='ignore').strip()
            if line:
                print(f"Arduino: {line}")
            if 'RUN COMPLETE' in line:
                return
        time.sleep(0.02)
    print("Warning: timed out waiting for Arduino RUN COMPLETE")


def play_emotion_sequence(payload_str):
    try:
        parsed = json.loads(payload_str)
        frames = parsed if isinstance(parsed, list) else [parsed]
        for i, frame in enumerate(frames):
            print(f"Emotion frame {i + 1}/{len(frames)}: {frame}")
            send_to_serial(frame)
            if i < len(frames) - 1:
                wait_for_run_complete()
    except Exception as e:
        print(f"Emotion parse error: {e}")


# ── MQTT ─────────────────────────────────────────────────────
def on_connect(client, _userdata, _flags, reason_code, _properties=None):
    print(f"MQTT connected (code {reason_code})")
    client.subscribe(EMOTION_TOPIC)
    print(f"Subscribed to {EMOTION_TOPIC}")


def on_message(_client, _userdata, msg):
    payload = msg.payload.decode('utf-8')
    print(f"\n[{msg.topic}] {payload[:120]}")
    print("-" * 30)
    threading.Thread(target=play_emotion_sequence, args=(payload,), daemon=True).start()


client = mqtt.Client(
    callback_api_version=mqtt.CallbackAPIVersion.VERSION2,
    transport="websockets"
)

client.on_connect = on_connect
client.on_message = on_message

client.tls_set()
client.connect(BROKER, PORT, 60)

print(f"Connecting to {BROKER}:{PORT} …")
client.loop_forever()

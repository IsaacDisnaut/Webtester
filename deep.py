import paho.mqtt.client as mqtt

BROKER = "test.mosquitto.org"
PORT = 8081
TOPIC = "robot/control"

def on_connect(client, userdata, flags, reason_code, properties=None):
    print(f"Connected with result code {reason_code}")
    client.subscribe(TOPIC)

def on_message(client, userdata, msg):
    print(f"Topic: {msg.topic}")
    print(f"Message: {msg.payload.decode('utf-8')}")
    print("-" * 30)

client = mqtt.Client(
    callback_api_version=mqtt.CallbackAPIVersion.VERSION2,
    transport="websockets"
)

client.on_connect = on_connect
client.on_message = on_message

# สำหรับ wss
client.tls_set()

client.connect(BROKER, PORT, 60)

print(f"Listening on {TOPIC} ...")
client.loop_forever()
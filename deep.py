"""
Robot MQTT receiver
Subscribes to the robot/control topic and prints incoming control messages.

Install dependency:
    pip install paho-mqtt

Usage examples:
    python deep.py                          # plain MQTT  localhost:1883
    python deep.py --host 192.168.1.10      # different host
    python deep.py --wss                    # WebSocket Secure localhost:9443
    python deep.py --wss --no-verify        # WSS with self-signed cert
    python deep.py --ws                     # plain WebSocket   localhost:9001
    python deep.py --topic my/topic         # custom topic

Message format published by the web app:
    {"Pad": "left"|"right"|"up"|"down"|null, "Analog": {"x": float, "y": float}}
"""

import json
import ssl
import argparse
import paho.mqtt.client as mqtt

DEFAULT_HOST  = "test.mosquitto.org"
DEFAULT_PORT  = 8081
DEFAULT_TOPIC = "robot/control"
DEFAULT_WSS   = True


def on_connect(client, userdata, _flags, reason_code, _properties=None):
    if str(reason_code) == "Success":
        print(f"[OK] Connected → subscribing to '{userdata['topic']}'")
        client.subscribe(userdata["topic"])
    else:
        print(f"[ERROR] Connection failed: {reason_code}")


def on_disconnect(_client, _userdata, _disconnect_flags=None, _reason_code=None, _properties=None):
    print("[INFO] Disconnected")


def on_message(client, userdata, msg):
    try:
        data   = json.loads(msg.payload.decode())
        pad    = data.get("Pad") or "none"
        analog = data.get("Analog", {})
        ax     = float(analog.get("x", 0))
        ay     = float(analog.get("y", 0))

        # Visual bar for analog axes
        def bar(v, width=10):
            filled = int(abs(v) * width)
            if v >= 0:
                return " " * width + "│" + "█" * filled + " " * (width - filled)
            else:
                return " " * (width - filled) + "█" * filled + "│" + " " * width

        print(
            f"  Pad: {pad:<6}  "
            f"EyeX: {bar(ax)}  {ax:+.3f}  "
            f"EyeY: {bar(ay)}  {ay:+.3f}"
        )
    except Exception as e:
        print(f"[WARN] Parse error: {e}  raw: {msg.payload}")


def main():
    parser = argparse.ArgumentParser(
        description="Receive InMoov robot MQTT control messages from the VideoCall web app"
    )
    parser.add_argument("--host",      default=DEFAULT_HOST,  help=f"Broker host  (default: {DEFAULT_HOST})")
    parser.add_argument("--port",      default=0, type=int,   help="Broker port  (default: 1883 / 9443 wss / 9001 ws)")
    parser.add_argument("--topic",     default=DEFAULT_TOPIC, help=f"MQTT topic   (default: {DEFAULT_TOPIC})")
    parser.add_argument("--wss",       action="store_true",   help="Use WebSocket Secure (wss://, port 9443)")
    parser.add_argument("--ws",        action="store_true",   help="Use plain WebSocket  (ws://,  port 9001)")
    parser.add_argument("--no-verify", action="store_true",   help="Skip TLS certificate verification (self-signed certs)")
    args = parser.parse_args()

    # Pick transport and default port (default: WSS on HiveMQ)
    use_wss = args.wss or (not args.ws and DEFAULT_WSS and not args.port)
    if use_wss or args.wss:
        transport    = "websockets"
        default_port = DEFAULT_PORT
    elif args.ws:
        transport    = "websockets"
        default_port = 9001
    else:
        transport    = "tcp"
        default_port = 1883

    port = args.port if args.port else default_port

    # Build client
    client = mqtt.Client(transport=transport, userdata={"topic": args.topic})
    client.on_connect    = on_connect
    client.on_disconnect = on_disconnect
    client.on_message    = on_message

    # TLS for WSS
    if use_wss or args.wss:
        if args.no_verify:
            client.tls_set(cert_reqs=ssl.CERT_NONE)
            client.tls_insecure_set(True)
        else:
            client.tls_set()

    proto = "wss" if (use_wss or args.wss) else ("ws" if args.ws else "mqtt")
    print(f"Connecting to {proto}://{args.host}:{port}  topic: {args.topic}")
    print("Press Ctrl+C to quit.\n")

    try:
        client.connect(args.host, port, keepalive=60)
        client.loop_forever()
    except KeyboardInterrupt:
        print("\n[INFO] Stopped.")
        client.disconnect()
    except Exception as e:
        print(f"[ERROR] {e}")


if __name__ == "__main__":
    main()

import sys
sys.path.insert(0, r"D:\python_packages")

import cv2
from ultralytics import YOLO

# yolov8n.pt detects all 80 COCO classes. Auto-downloads on first run (~6 MB).
model = YOLO("yolov8n.pt")
NAMES = model.names  # {0: 'person', 1: 'bicycle', ...}

cap = cv2.VideoCapture(0, cv2.CAP_DSHOW)
if not cap.isOpened():
    raise RuntimeError("Cannot open webcam")

while True:
    ret, frame = cap.read()
    if not ret:
        break

    results = model(frame, verbose=False)[0]

    for box in results.boxes:
        x1, y1, x2, y2 = map(int, box.xyxy[0])
        cx = (x1 + x2) // 2
        cy = (y1 + y2) // 2
        conf = float(box.conf[0])
        cls_name = NAMES[int(box.cls[0])]

        cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)

        label = f"{cls_name} {conf:.2f}  ({cx},{cy})"
        (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.55, 1)
        cv2.rectangle(frame, (x1, y1 - th - 6), (x1 + tw + 4, y1), (0, 255, 0), -1)
        cv2.putText(frame, label, (x1 + 2, y1 - 4),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 0, 0), 1)

        cv2.circle(frame, (cx, cy), 4, (0, 0, 255), -1)

    cv2.imshow("YOLO Detection  |  q = quit", frame)
    if cv2.waitKey(1) & 0xFF == ord("q"):
        break

cap.release()
cv2.destroyAllWindows()

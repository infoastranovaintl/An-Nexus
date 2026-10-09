"""Mock ESP32-CAM (CameraWebServer-style) for dashboard smoke tests.

Port mapping matches the dashboard's camPorts() scheme: a camera ip of
"host:8090" maps to http=8090, stream=8091, audio=8092.

Endpoints (all CORS-open, like the custom firmware the dashboard targets):
  GET /control?var=&val=&t=   -> {"result":"ok"}   (framesize/quality/fb_count)
  GET /status?t=              -> {"rssi":..,"uptime":..}
  GET /capture?t=             -> single JPEG
  GET /stream?t=              -> multipart/x-mixed-replace MJPEG stream

Run:  python scripts/mock_camera.py 8090
Then add a camera with ip=localhost:8090, token=test in the dashboard.
"""

import io
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

try:
    from PIL import Image, ImageDraw
except ImportError:
    Image = None
    ImageDraw = None

SIZE = 1600, 1200
FPS = 5
_fps_explicit = False  # once the dashboard commands fps, stop auto-deriving from framesize
# XIAO ESP32S3: JPEG HW encode time scales with pixels + quality
# UXGA q10 → ~110ms (5-8fps), SVGA q18 → 45ms (15fps), VGA q24 → 32ms (30fps), HVGA q28 → 22ms (30fps)
_quality = 92
_framesize = 10  # 7=HVGA 480×320, 8=VGA 640×480, 9=SVGA 800×600, 10=XGA 1024×768, 13=UXGA
FRAMESIZE_MAP = {7: (480, 320), 8: (640, 480), 9: (800, 600), 10: (1024, 768), 11: (1280, 1024), 13: (1600, 1200)}
FPS_BY_SIZE = {7: 30, 8: 24, 9: 18, 10: 12, 11: 8, 13: 5}


def make_frame(seq: int) -> bytes:
    if Image is not None:
        cur_size = FRAMESIZE_MAP.get(_framesize, SIZE)
        # map esp quality 10(best)-32(worst) to Pillow JPEG quality 92->60
        pillow_q = max(40, min(92, 102 - (_quality - 10) * 2))
        img = Image.new("RGB", cur_size, (16, 18, 24))
        d = ImageDraw.Draw(img)
        t = time.strftime("%H:%M:%S")
        d.rectangle([20, 20, 300, 60], fill=(220, 40, 40))
        d.text((28, 26), f"AN-NEXUS CAM {seq:04d} {t}", fill=(255, 255, 255))
        d.text((28, 44), f"{cur_size[0]}x{cur_size[1]} q={_quality} {pillow_q}", fill=(200, 200, 200))
        d.rectangle([0, 0, cur_size[0] - 1, cur_size[1] - 1], outline=(0, 180, 120), width=3)
        buf = io.BytesIO()
        img.save(buf, "JPEG", quality=int(pillow_q))
        return buf.getvalue()
    raise RuntimeError("Pillow not installed")


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, *a):
        pass

    def _send(self, code, ctype, body: bytes):
        self.send_response(code)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        q = parse_qs(parsed.query)
        route = parsed.path
        if route == "/control":
            global _quality, _framesize, SIZE, FPS, _fps_explicit  # type: ignore
            var = q.get("var", [""])[0]
            val = q.get("val", [""])[0]
            try:
                iv = int(val)
                if var == "quality":
                    _quality = iv
                elif var == "framesize":
                    _framesize = iv
                    SIZE = FRAMESIZE_MAP.get(iv, SIZE)
                    # auto-derive fps from size ONLY until the dashboard commands fps explicitly
                    if not _fps_explicit:
                        FPS = FPS_BY_SIZE.get(_framesize, 12)
                elif var == "fps":
                    FPS = max(1, min(30, iv))
                    _fps_explicit = True
            except:
                pass
            self._send(200, "application/json", f'{{"result":"ok","var":"{var}","val":"{val}","fps":{FPS}}}'.encode())
            return
        if route == "/status":
            self._send(200, "application/json", f'{{"rssi":-47,"uptime":4260,"fps":{FPS}}}'.encode())
            return
        if route == "/capture":
            try:
                body = make_frame(int(time.time()))
            except RuntimeError as e:
                self._send(500, "text/plain", str(e).encode())
                return
            self._send(200, "image/jpeg", body)
            return
        if route == "/stream":
            self.send_response(200)
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Type", "multipart/x-mixed-replace; boundary=frame")
            self.end_headers()
            seq = 0
            try:
                while True:
                    body = make_frame(seq)
                    seq += 1
                    head = b"--frame\r\nContent-Type: image/jpeg\r\nContent-Length: " + str(len(body)).encode() + b"\r\n\r\n"
                    self.wfile.write(head)
                    self.wfile.write(body)
                    self.wfile.write(b"\r\n")
                    self.wfile.flush()
                    time.sleep(1.0 / FPS)
            except (BrokenPipeError, ConnectionResetError):
                return
        self._send(404, "text/plain", b"not found")


def main():
    base = int(sys.argv[1]) if len(sys.argv) > 1 else 8090
    if Image is None:
        print("WARNING: Pillow not installed — /capture and /stream will 500", file=sys.stderr)
    servers = [ThreadingHTTPServer(("localhost", base + i), Handler) for i in (0, 1, 2)]
    for s in servers:
        threading.Thread(target=s.serve_forever, daemon=True).start()
    print(f"mock camera on :{base} (http) / :{base+1} (stream) / :{base+2} (audio) — {SIZE[0]}x{SIZE[1]} @ {FPS}fps")
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
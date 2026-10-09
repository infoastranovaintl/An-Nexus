"""
Live MJPEG upscaler proxy (Python) for the Hydropower CCTV dashboard.

Reads an ESP32 / XIAO MJPEG stream, upscales every frame, and re-serves it as
multipart/x-mixed-replace so the dashboard shows a larger, cleaner image while
the camera keeps streaming at its native fps (e.g. 30fps).

Two upscale engines:
  * default  — OpenCV LANCZOS (fast, CPU/GPU, no ML deps)
  * --esrgan — Real-ESRGAN (true AI detail). Requires: pip install realesrgan

Run:
  python scripts/upscale_proxy.py \
      --src "http://CAM:STREAM/stream?t=TOKEN" \
      --port 9000 --scale 2

Then point a dashboard camera's STREAM URL at http://PROXYHOST:9000/stream
(leave http/audio on the real camera so /control still works — see notes below).

Requires:  pip install opencv-python-headless numpy
Optional :  pip install realesrgan

Note on integration: the dashboard's camera model derives http/stream/audio
ports from one base IP. To route only the *stream* through this proxy while
keeping /control (quality/framesize) on the camera, add a per-camera
`streamOverride` URL field in src/store/cctv.ts and use it in streamUrl().
Say the word and I'll wire that field in.
"""
import argparse
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import cv2
import numpy as np

ESRGAN = None


def load_esrgan(scale: int):
    global ESRGAN
    try:
        from realesrgan import RealESRGANer  # type: ignore
        from basicsr.archs.rrdbnet_arch import RRDBNet  # type: ignore

        model = RRDBNet(num_in_ch=3, num_out_ch=3, num_feat=64, num_block=23, num_grow_ch=32)
        # 1x/2x/4x weights — pick the one matching scale
        scale_map = {1: "RealESRGAN_x1plus.pth", 2: "RealESRGAN_x2plus.pth", 4: "RealESRGAN_x4plus.pth"}
        weight = scale_map.get(scale, "RealESRGAN_x2plus.pth")
        ESRGAN = RealESRGANer(
            scale=scale,
            model_path=weight,
            model=model,
            tile=0,
            tile_pad=10,
            pre_pad=0,
            half=False,
        )
    except Exception as e:  # pragma: no cover
        print(f"[upscale_proxy] Real-ESRGAN unavailable ({e}); falling back to LANCZOS")
        ESRGAN = None


def upscale(frame: np.ndarray, scale: int, use_esrgan: bool) -> np.ndarray:
    if use_esrgan and ESRGAN is not None:
        out, _ = ESRGAN.enhance(frame, outscale=scale)
        return out
    h, w = frame.shape[:2]
    return cv2.resize(frame, (w * scale, h * scale), interpolation=cv2.INTER_LANCZOS4)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", required=True, help="source MJPEG URL from the camera")
    ap.add_argument("--host", default="0.0.0.0")
    ap.add_argument("--port", type=int, default=9000)
    ap.add_argument("--scale", type=int, default=2, choices=[1, 2, 3, 4])
    ap.add_argument("--esrgan", action="store_true", help="use Real-ESRGAN if installed")
    ap.add_argument("--quality", type=int, default=85, help="JPEG quality for re-stream")
    args = ap.parse_args()

    if args.esrgan:
        load_esrgan(args.scale)

    cap = cv2.VideoCapture(args.src)
    if not cap.isOpened():
        raise SystemExit(f"cannot open source stream: {args.src}")

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *a):
            pass

        def do_GET(self):
            if self.path.rstrip("/") not in ("/stream", "/"):
                self.send_response(404)
                self.end_headers()
                return
            self.send_response(200)
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Type", "multipart/x-mixed-replace; boundary=frame")
            self.end_headers()
            try:
                while True:
                    ok, frame = cap.read()
                    if not ok:
                        time.sleep(0.05)
                        continue
                    out = upscale(frame, args.scale, args.esrgan)
                    ok2, buf = cv2.imencode(".jpg", out, [cv2.IMWRITE_JPEG_QUALITY, args.quality])
                    if not ok2:
                        continue
                    data = buf.tobytes()
                    self.wfile.write(b"--frame\r\nContent-Type: image/jpeg\r\n")
                    self.wfile.write(b"Content-Length: " + str(len(data)).encode() + b"\r\n\r\n")
                    self.wfile.write(data)
                    self.wfile.write(b"\r\n")
            except (BrokenPipeError, ConnectionResetError):
                return

    srv = ThreadingHTTPServer((args.host, args.port), Handler)
    print(f"[upscale_proxy] serving {args.src} x{args.scale} on http://{args.host}:{args.port}/stream")
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        cap.release()


if __name__ == "__main__":
    main()

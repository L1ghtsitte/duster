import { useEffect, useRef, useState } from "react";
import { useI18n } from "../i18n";

export function StreamModal({
  computerId,
  name,
  onClose,
}: {
  computerId: string;
  name: string;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const imgRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [streaming, setStreaming] = useState(false);
  const [fullVideo, setFullVideo] = useState(false);
  const [hd, setHd] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("duster_token");
    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${proto}//${location.host}/ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "auth", token }));
      setTimeout(() => {
        if (fullVideo) {
          ws.send(
            JSON.stringify({
              type: "webrtc_watch",
              payload: { computerId, fps: 15 },
            })
          );
        } else {
          ws.send(
            JSON.stringify({
              type: "stream_watch",
              payload: { computerId, fps: hd ? 18 : 5 },
            })
          );
        }
        setStreaming(true);
      }, 200);
    };

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data as string) as {
        type?: string;
        computerId?: string;
        dataBase64?: string;
        payload?: { kind?: string; dataBase64?: string };
      };
      if (msg.computerId && msg.computerId !== computerId) return;

      if (msg.type === "stream_frame" && msg.dataBase64 && imgRef.current && !fullVideo) {
        imgRef.current.src = `data:image/jpeg;base64,${msg.dataBase64}`;
      }

      if (msg.type === "webrtc" && msg.payload?.kind === "frame" && msg.payload.dataBase64) {
        const b64 = msg.payload.dataBase64;
        const canvas = canvasRef.current;
        const video = videoRef.current;
        if (!canvas || !video) return;
        const img = new Image();
        img.onload = () => {
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext("2d");
          ctx?.drawImage(img, 0, 0);
          if (!video.srcObject) {
            video.srcObject = canvas.captureStream(15);
            video.style.display = "block";
          }
        };
        img.src = `data:image/jpeg;base64,${b64}`;
      }
    };

    return () => {
      ws.send(
        JSON.stringify({
          type: fullVideo ? "webrtc_stop" : "stream_stop",
          payload: { computerId },
        })
      );
      ws.close();
    };
  }, [computerId, fullVideo, hd]);

  return (
    <div className="card" style={{ position: "fixed", inset: "5%", zIndex: 200, overflow: "auto" }}>
      <h3>
        <img src="/models/webrtc.svg" alt="" width={24} style={{ verticalAlign: "middle" }} /> {name}
      </h3>
      <button type="button" onClick={onClose}>
        {t("common.cancel")}
      </button>
      <label style={{ marginLeft: 12 }}>
        <input type="checkbox" checked={hd} onChange={(e) => setHd(e.target.checked)} /> {t("stream.hd")}
      </label>
      <label style={{ marginLeft: 12 }}>
        <input type="checkbox" checked={fullVideo} onChange={(e) => setFullVideo(e.target.checked)} />{" "}
        {t("stream.fullVideo")}
      </label>
      {streaming && (
        <p style={{ color: "var(--muted)" }}>
          {fullVideo ? t("stream.fullVideoHint") : hd ? "HD ~18 FPS" : t("stream.preview")}
        </p>
      )}
      <canvas ref={canvasRef} style={{ display: "none" }} />
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{ display: "none", maxWidth: "100%", marginTop: 8, borderRadius: 8 }}
      />
      {!fullVideo && <img ref={imgRef} alt="stream" style={{ maxWidth: "100%", marginTop: 8, borderRadius: 8 }} />}
    </div>
  );
}

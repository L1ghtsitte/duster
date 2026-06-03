import { createRoot } from "react-dom/client";
import { PlayerApp } from "./PlayerApp";
import "./style.css";

createRoot(document.getElementById("root")!).render(<PlayerApp />);

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").catch(() => undefined);
}

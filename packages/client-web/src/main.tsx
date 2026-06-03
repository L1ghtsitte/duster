import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { StationApp } from "./StationApp";
import "./station.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <StationApp />
  </StrictMode>
);

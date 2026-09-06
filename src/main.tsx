import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.tsx";
import "./index.css";

// A stale deployment can leave the browser asking for asset files that no longer
// exist. Recover with a single cache-busting reload instead of a blank screen.
window.addEventListener("vite:preloadError", (event) => {
  event.preventDefault();
  const KEY = "chunk_reload_at";
  const last = Number(sessionStorage.getItem(KEY) || 0);
  if (Date.now() - last > 10000) {
    sessionStorage.setItem(KEY, String(Date.now()));
    const url = new URL(window.location.href);
    url.searchParams.set("v", Date.now().toString(36));
    window.location.replace(url.toString());
  }
});


createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);

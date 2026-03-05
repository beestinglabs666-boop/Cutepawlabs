// app/main.jsx
// Entry point. Initialises identity, pixels, and renders the app.
// The heavy CutePaw component is imported from app.jsx (the converted v3).

import { StrictMode, useEffect } from "react";
import { createRoot }            from "react-dom/client";
import { useIdentity }           from "./useIdentity.js";
import { setDeviceId }           from "./api.js";
import { pixels }                from "../lib/pixels.js";

// Root wrapper — handles identity + pixel init before rendering the app
function Root() {
  const { deviceId, credits, loading, refreshCredits } = useIdentity();

  // As soon as we have a device ID, register it with the API client
  useEffect(() => {
    if (deviceId) {
      setDeviceId(deviceId);
      pixels.init();
    }
  }, [deviceId]);

  if (loading) {
    return (
      <div style={{
        minHeight: "100vh",
        background: "linear-gradient(160deg,#0f0620 0%,#18103c 40%,#0b1e42 100%)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <div style={{
          width: 40, height: 40, borderRadius: "50%",
          border: "3px solid rgba(255,133,161,0.2)",
          borderTop: "3px solid #FF85A1",
          animation: "spin 1s linear infinite",
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // Dynamically import the main app to keep initial bundle small
  const App = require("./app.jsx").default;
  return <App deviceId={deviceId} serverCredits={credits} onCreditsChanged={refreshCredits} />;
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <Root />
  </StrictMode>
);

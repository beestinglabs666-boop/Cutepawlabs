// app/main.jsx
import { StrictMode, useEffect } from "react";
import { createRoot }            from "react-dom/client";
import { useIdentity }           from "./useIdentity.js";
import { setDeviceId }           from "./api.js";
import { pixels }                from "../lib/pixels.js";
import App                       from "./app.jsx";

function Root() {
  const { deviceId, credits, loading, refreshCredits } = useIdentity();

  useEffect(() => {
    if (deviceId) {
      setDeviceId(deviceId);
      pixels.init();
    }
  }, [deviceId]);

  if (loading) {
    return (
      <div style={{minHeight:"100vh", background:"linear-gradient(160deg,#0f0620 0%,#18103c 40%,#0b1e42 100%)",
        display:"flex", alignItems:"center", justifyContent:"center"}}>
        <div style={{width:40, height:40, borderRadius:"50%",
          border:"3px solid rgba(255,133,161,0.2)", borderTop:"3px solid #FF85A1",
          animation:"spin 1s linear infinite"}} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  return <App deviceId={deviceId} serverCredits={credits} onCreditsChanged={refreshCredits} />;
}

createRoot(document.getElementById("root")).render(
  <StrictMode><Root /></StrictMode>
);

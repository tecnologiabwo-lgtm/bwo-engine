import React from "react";
import { createRoot } from "react-dom/client";
import { MotionConfig } from "motion/react";
import "./index.css";
import App from "./app/App.jsx";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {/* reducedMotion="user": respeta la preferencia del sistema */}
    <MotionConfig reducedMotion="user">
      <App />
    </MotionConfig>
  </React.StrictMode>
);

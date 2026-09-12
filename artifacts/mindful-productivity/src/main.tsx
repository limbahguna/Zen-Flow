import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { initializeNativeRuntime } from "./lib/native";

console.info("[Mindful Space] build", { languageRuntime: "language-runtime-v2" });

void initializeNativeRuntime();
createRoot(document.getElementById("root")!).render(<App />);

import { createRoot } from "react-dom/client";
import { App } from "./App";
import { trackInputModality } from "./inputModality";
import "./tokens.css";

trackInputModality();

const root = document.getElementById("root");
if (root) createRoot(root).render(<App />);

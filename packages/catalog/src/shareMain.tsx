import { createRoot } from "react-dom/client";
import { trackInputModality } from "./inputModality";
import { ShareView } from "./ShareView";
import "./tokens.css";

trackInputModality();

const root = document.getElementById("root");
if (root) createRoot(root).render(<ShareView />);

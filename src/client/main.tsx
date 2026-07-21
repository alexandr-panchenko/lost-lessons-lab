import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App";
import "./styles.css";

const rootElement = document.querySelector<HTMLDivElement>("#root");

if (rootElement === null) {
  throw new Error("Missing application root");
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import App from "./App.tsx"
import { ImageProcessorProvider } from "./hooks/ImageProcessor.tsx"
import "./style.css"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ImageProcessorProvider>
      <App />
    </ImageProcessorProvider>
  </StrictMode>
)

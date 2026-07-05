import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter } from "react-router-dom"
import "./index.css"
import App from "./App"
import { initTheme } from "./lib/theme"
import { asset } from "./lib/asset"

initTheme()

// Favicons, base-aware (see index.html note).
function setIcon(rel: string, href: string, type?: string) {
  const link = document.createElement("link")
  link.rel = rel
  link.href = asset(href)
  if (type) link.type = type
  document.head.appendChild(link)
}
setIcon("icon", "kamra-mark.svg", "image/svg+xml")
setIcon("icon", "favicon-32.png", "image/png")
setIcon("apple-touch-icon", "apple-touch-180.png")

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter basename={import.meta.env.PROD ? "/kamra" : "/"}>
      <App />
    </BrowserRouter>
  </StrictMode>,
)

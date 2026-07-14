export default function manifest() {
  return {
    name: "Renovation Manager",
    short_name: "Renovation",
    description: "Track wages, attendance, materials & room budgets for your home renovation.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0f1720",
    theme_color: "#0f1720",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

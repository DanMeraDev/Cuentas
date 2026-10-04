import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Cuentas de la casa",
    short_name: "Cuentas",
    description: "Gastos, arriendo, bolsas y deudas de la casa.",
    start_url: "/",
    display: "standalone",
    background_color: "#eef0ec",
    theme_color: "#eef0ec",
    lang: "es",
    icons: [
      { src: "/pwa-icon/192", sizes: "192x192", type: "image/png" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png" },
      { src: "/pwa-icon/512m", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

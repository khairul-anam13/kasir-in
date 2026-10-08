import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Kasir-in", short_name: "Kasir-in", description: "Sistem kasir, stok, dan laporan",
    start_url: "/kasir", display: "standalone", orientation: "any", background_color: "#f5f6fa", theme_color: "#3b5bdb",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}

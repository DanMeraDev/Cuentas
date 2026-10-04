import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // permite abrir el servidor de desarrollo desde el iPhone en la misma red Wi-Fi
  allowedDevOrigins: ["192.168.*.*"],
};

export default nextConfig;

import { renderIcon } from "@/lib/icon";

export async function GET(_: Request, { params }: RouteContext<"/pwa-icon/[size]">) {
  const { size } = await params;
  const n = Number(size.replace(/\D/g, "")) || 512;
  return renderIcon(Math.min(1024, Math.max(48, n)), size.includes("m"));
}

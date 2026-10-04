import { requireContext } from "@/lib/auth";
import { TabBar } from "@/components/TabBar";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  await requireContext();
  return (
    <>
      <main className="min-h-dvh">{children}</main>
      <TabBar />
    </>
  );
}

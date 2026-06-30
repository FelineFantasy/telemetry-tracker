import { SettingsNav } from "@/app/components/dashboard/settings/SettingsNav";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[240px_1fr]">
      <SettingsNav />
      <section className="min-w-0">{children}</section>
    </div>
  );
}

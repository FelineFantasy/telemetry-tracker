import { Badge as ShadBadge } from "@/app/components/ui/shadcn/badge";

export function Badge({
  children,
  variant = "outline",
}: {
  children: string;
  variant?: "outline" | "secondary" | "brand" | "success" | "destructive";
}) {
  return (
    <ShadBadge variant={variant} className="font-mono text-[10px] font-normal uppercase tracking-wider">
      {children}
    </ShadBadge>
  );
}

export function ResolvedBadge() {
  return <ShadBadge variant="success">Resolved</ShadBadge>;
}

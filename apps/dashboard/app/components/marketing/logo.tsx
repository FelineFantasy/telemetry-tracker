import Image from "next/image";

export function Logo({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <span className={`inline-flex min-w-0 items-center gap-2.5 ${className ?? ""}`}>
      <Image
        src="/telemetry-logo.jpg"
        alt=""
        width={28}
        height={28}
        className="h-7 w-7 shrink-0 rounded-lg object-cover"
      />
      <span
        className={`truncate text-[15px] font-semibold tracking-tight ${compact ? "hidden min-[420px]:inline" : ""}`}
      >
        Telemetry<span className="text-muted-foreground"> / </span>Tracker
      </span>
    </span>
  );
}

import Image from "next/image";

/**
 * Official Telemetry Tracker mark.
 * Sizing is controlled via `size` and/or `className` + CSS.
 */
export function BrandLogo({
  className,
  size = 48,
  priority = false,
}: {
  className?: string;
  /** Layout box (square); rendered asset scales with `object-fit: contain`. */
  size?: number;
  priority?: boolean;
}) {
  return (
    <Image
      src="/telemetry-logo.jpg"
      alt=""
      width={size}
      height={size}
      className={`rounded-xl object-cover ${className ?? ""}`}
      priority={priority}
    />
  );
}

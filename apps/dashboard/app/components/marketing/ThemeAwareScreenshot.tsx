import Image from "next/image";

type ThemeAwareScreenshotProps = {
  lightSrc: string;
  darkSrc: string;
  alt: string;
  width?: number;
  height?: number;
  priority?: boolean;
  loading?: "lazy" | "eager";
};

/** Light/dark PNG pair toggled via `html.dark` from `next-themes` (system or appearance settings). */
export function ThemeAwareScreenshot({
  lightSrc,
  darkSrc,
  alt,
  width = 1024,
  height = 682,
  priority,
  loading,
}: ThemeAwareScreenshotProps) {
  return (
    <>
      <Image
        src={lightSrc}
        alt={alt}
        width={width}
        height={height}
        className="block h-auto w-full dark:hidden"
        priority={priority}
        loading={loading}
      />
      <Image
        src={darkSrc}
        alt={alt}
        width={width}
        height={height}
        className="hidden h-auto w-full dark:block"
        priority={priority}
        loading={loading}
      />
    </>
  );
}

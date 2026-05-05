"use client";

import { Toaster } from "sonner";

/** Global toast host — import `toast` from `sonner` in client components. */
export function ToasterProvider() {
  return (
    <Toaster
      position="top-center"
      richColors
      closeButton
      expand={false}
      gap={10}
      toastOptions={{
        duration: 6000,
        classNames: {
          toast: "font-sans",
        },
      }}
    />
  );
}

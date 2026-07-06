import { useEffect } from "react";

let lockCount = 0;
let savedOverflow = "";

export function acquireBodyScrollLock(): () => void {
  if (typeof document === "undefined") return () => {};
  if (lockCount === 0) {
    savedOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  lockCount += 1;
  let released = false;
  return () => {
    if (released || typeof document === "undefined") return;
    released = true;
    lockCount -= 1;
    if (lockCount === 0) {
      document.body.style.overflow = savedOverflow;
    }
  };
}

export function useBodyScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return;
    return acquireBodyScrollLock();
  }, [locked]);
}

/** @internal reset module state between tests */
export function resetBodyScrollLockForTests() {
  lockCount = 0;
  savedOverflow = "";
}

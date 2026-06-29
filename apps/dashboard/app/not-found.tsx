import type { Metadata } from "next";
import Link from "next/link";
import {
  ErrorArrowIcon,
  ErrorPageShell,
  errorPrimaryBtn,
  errorSecondaryBtn,
} from "@/app/components/error-pages/ErrorPageShell";

export const metadata: Metadata = {
  title: "Not found",
  description: "The page you requested could not be found.",
};

export default function NotFound() {
  return (
    <ErrorPageShell
      eyebrow="Not found"
      code="404"
      title="This route isn't being tracked."
      description="The page you're looking for doesn't exist, was moved, or never shipped. Check the URL or head back to a known surface."
      actions={
        <>
          <Link href="/" className={errorPrimaryBtn}>
            Back to home
            <ErrorArrowIcon />
          </Link>
          <Link href="/docs" className={errorSecondaryBtn}>
            Read the docs
          </Link>
          <Link href="/contact" className={errorSecondaryBtn}>
            Report broken link
          </Link>
        </>
      }
    />
  );
}

import { BrandLogo } from "@/app/components/BrandLogo";

export function LandingHeroBrand() {
  return (
    <div className="landing-hero__brand-mark" aria-hidden>
      <BrandLogo className="landing-hero__brand-icon" size={56} priority />
    </div>
  );
}

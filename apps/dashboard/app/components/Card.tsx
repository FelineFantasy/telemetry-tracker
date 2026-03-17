import { type ReactNode } from "react";

export function Card({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="card">
      <div className="card__label">{label}</div>
      <div className="card__value">{children}</div>
    </div>
  );
}

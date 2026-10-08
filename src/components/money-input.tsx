"use client";

/** Input rupiah terkontrol: tampil "1.250.000", nilai number. */
export function MoneyInput({ value, onChange, className = "input money", ...rest }: {
  value: number; onChange: (n: number) => void; className?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  return (
    <input
      {...rest} className={className} inputMode="numeric" autoComplete="off"
      value={value ? value.toLocaleString("id-ID") : ""}
      onChange={(e) => onChange(Number(e.target.value.replace(/\D/g, "").slice(0, 12)) || 0)}
      onFocus={(e) => e.target.select()}
    />
  );
}

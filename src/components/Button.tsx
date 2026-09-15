import type { ReactNode, ButtonHTMLAttributes } from "react";

type ButtonProps = {
  children: ReactNode;
  variant?: "primary" | "ghost";
} & ButtonHTMLAttributes<HTMLButtonElement>;

export default function Button({ children, variant = "primary", className, ...rest }: ButtonProps) {
  return (
    <button type="button" className={`btn btn--${variant}${className ? ` ${className}` : ""}`} {...rest}>
      {children}
    </button>
  );
}
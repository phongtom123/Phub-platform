import type { ButtonHTMLAttributes, ReactNode } from "react";
import styles from "./common.module.css";

type ButtonVariant = "primary" | "outline" | "text" | "outlinePrimary" | "dark";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	children: ReactNode;
	variant?: ButtonVariant;
	size?: "small" | "large";
}

export function Button({
	children,
	className,
	variant = "primary",
	size = "small",
	type = "button",
	...props
}: ButtonProps) {
	return (
		<button
			className={[styles.button, styles[variant], size === "large" && styles.buttonLarge, className].filter(Boolean).join(" ")}
			type={type}
			{...props}
		>
			{children}
		</button>
	);
}

export interface TextButtonProps
	extends ButtonHTMLAttributes<HTMLButtonElement> {
	children: ReactNode;
}

export function TextButton({ children, className, type = "button", ...props }: TextButtonProps) {
	return (
		<button
			className={[styles.textButton, className].filter(Boolean).join(" ")}
			type={type}
			{...props}
		>
			{children}
		</button>
	);
}

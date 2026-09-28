import type { ButtonHTMLAttributes, ReactNode } from "react";
import styles from "./common.module.css";

export interface IconButtonProps
	extends ButtonHTMLAttributes<HTMLButtonElement> {
	children: ReactNode;
	label: string;
}

export function IconButton({ children, className, label, type = "button", ...props }: IconButtonProps) {
	return (
		<button
			aria-label={label}
			className={[styles.iconButton, className].filter(Boolean).join(" ")}
			type={type}
			{...props}
		>
			{children}
		</button>
	);
}

export function Chevron({ direction = "right" }: { direction?: "left" | "right" }) {
	return <span aria-hidden="true">{direction === "left" ? "‹" : "›"}</span>;
}

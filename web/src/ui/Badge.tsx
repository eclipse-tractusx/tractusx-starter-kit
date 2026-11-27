import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";
import styles from "./Badge.module.css";

export type BadgeTone = "neutral" | "accent" | "success" | "info" | "warning";

export interface BadgeProps {
  tone?: BadgeTone;
  icon?: IconName;
  dot?: boolean;
  title?: string;
  children: ReactNode;
}

/** A short status or category label. */
export function Badge({ tone = "neutral", icon, dot, title, children }: BadgeProps) {
  const className = [styles.badge, tone !== "neutral" && styles[tone], dot && styles.dot].filter(Boolean).join(" ");
  return (
    <span className={className} title={title}>
      {icon && <Icon name={icon} size={12} />}
      {children}
    </span>
  );
}

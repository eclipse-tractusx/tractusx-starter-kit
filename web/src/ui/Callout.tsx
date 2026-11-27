import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";
import styles from "./Callout.module.css";

export interface CalloutProps {
  tone?: "info" | "warning" | "success";
  title?: ReactNode;
  children?: ReactNode;
}

const icons: Record<NonNullable<CalloutProps["tone"]>, IconName> = { info: "info", warning: "alert", success: "check" };

/** A tinted note with a coloured edge, like the documentation's admonitions. */
export function Callout({ tone = "info", title, children }: CalloutProps) {
  return (
    <aside className={[styles.callout, tone !== "info" && styles[tone]].filter(Boolean).join(" ")}>
      <Icon name={icons[tone]} size={18} className={styles.icon} />
      <div className={styles.body}>
        {title && <div className={styles.title}>{title}</div>}
        {children && <div>{children}</div>}
      </div>
    </aside>
  );
}

import type { HTMLAttributes, ReactNode } from "react";
import { Icon, type IconName } from "./Icon";
import styles from "./Card.module.css";

export interface CardProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  icon?: IconName;
  eyebrow?: ReactNode;
  title?: ReactNode;
  footer?: ReactNode;
  interactive?: boolean;
  compact?: boolean;
  muted?: boolean;
  as?: "article" | "section" | "div";
}

/** A surface with an optional icon, eyebrow, title and footer. */
export function Card({
  icon,
  eyebrow,
  title,
  footer,
  interactive,
  compact,
  muted,
  as: Tag = "article",
  className,
  children,
  ...rest
}: CardProps) {
  const classes = [styles.card, interactive && styles.interactive, compact && styles.compact, muted && styles.muted, className]
    .filter(Boolean)
    .join(" ");
  return (
    <Tag className={classes} {...rest}>
      {(icon || title || eyebrow) && (
        <header className={styles.header}>
          {icon && (
            <span className={styles.icon}>
              <Icon name={icon} size={20} />
            </span>
          )}
          <span className={styles.titles}>
            {eyebrow && <span className={styles.eyebrow}>{eyebrow}</span>}
            {title && <h3 className={styles.title}>{title}</h3>}
          </span>
        </header>
      )}
      {children && <div className={styles.body}>{children}</div>}
      {footer && <footer className={styles.footer}>{footer}</footer>}
    </Tag>
  );
}

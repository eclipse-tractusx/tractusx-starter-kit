import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";
import styles from "./OptionCard.module.css";

export interface OptionCardProps {
  title: ReactNode;
  description?: ReactNode;
  icon?: IconName;
  meta?: ReactNode;
  badge?: ReactNode;
  selected: boolean;
  /** "radio" for one of many, "checkbox" for any of many. */
  kind?: "radio" | "checkbox";
  disabled?: boolean;
  /** Selected and not changeable, e.g. required by another choice. */
  locked?: boolean;
  lockedReason?: string;
  onSelect: () => void;
}

/** A large, selectable tile: one option of a choice, with its own explanation. */
export function OptionCard({
  title,
  description,
  icon,
  meta,
  badge,
  selected,
  kind = "radio",
  disabled,
  locked,
  lockedReason,
  onSelect,
}: OptionCardProps) {
  const classes = [styles.option, styles[kind], selected && styles.selected, locked && styles.locked]
    .filter(Boolean)
    .join(" ");
  return (
    <button
      type="button"
      role={kind}
      aria-checked={selected}
      aria-disabled={locked || undefined}
      disabled={disabled}
      title={locked ? lockedReason : undefined}
      className={classes}
      onClick={locked ? undefined : onSelect}
    >
      {icon && (
        <span className={styles.icon}>
          <Icon name={icon} size={18} />
        </span>
      )}
      <span className={styles.text}>
        <span className={styles.titleRow}>
          <span className={styles.title}>{title}</span>
          {badge}
        </span>
        {description && <span className={styles.description}>{description}</span>}
        {meta && <span className={styles.meta}>{meta}</span>}
      </span>
      <span className={styles.mark} aria-hidden="true">
        {selected && <Icon name={locked ? "lock" : "check"} size={12} strokeWidth={3} />}
      </span>
    </button>
  );
}

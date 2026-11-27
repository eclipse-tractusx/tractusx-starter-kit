import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import { Icon, type IconName } from "./Icon";
import styles from "./Tabs.module.css";

export interface TabItem {
  id: string;
  label: ReactNode;
  icon?: IconName;
}

export interface TabsProps {
  items: TabItem[];
  value: string;
  onChange: (id: string) => void;
  label: string;
  children: ReactNode;
}

/** Accessible tabs: arrow keys move between them, the panel follows the selection. */
export function Tabs({ items, value, onChange, label, children }: TabsProps) {
  const base = useId();
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const index = items.findIndex((item) => item.id === value);
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = items[(index + step + items.length) % items.length];
    onChange(next.id);
    refs.current[next.id]?.focus();
  }

  return (
    <div>
      <div role="tablist" aria-label={label} className={styles.list} onKeyDown={onKeyDown}>
        {items.map((item) => {
          const selected = item.id === value;
          return (
            <button
              key={item.id}
              ref={(node) => {
                refs.current[item.id] = node;
              }}
              type="button"
              role="tab"
              id={`${base}-${item.id}`}
              aria-selected={selected}
              aria-controls={`${base}-panel`}
              tabIndex={selected ? 0 : -1}
              className={[styles.tab, selected && styles.active].filter(Boolean).join(" ")}
              onClick={() => onChange(item.id)}
            >
              {item.icon && <Icon name={item.icon} size={15} />}
              {item.label}
            </button>
          );
        })}
      </div>
      <div role="tabpanel" id={`${base}-panel`} aria-labelledby={`${base}-${value}`} className={styles.panel}>
        {children}
      </div>
    </div>
  );
}

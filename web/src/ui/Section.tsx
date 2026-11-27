import type { ReactNode } from "react";
import styles from "./Section.module.css";

export interface SectionProps {
  id?: string;
  eyebrow?: ReactNode;
  title?: ReactNode;
  lead?: ReactNode;
  alt?: boolean;
  tight?: boolean;
  children: ReactNode;
}

/** A page band with a centred, width-limited column and an optional heading. */
export function Section({ id, eyebrow, title, lead, alt, tight, children }: SectionProps) {
  return (
    <section id={id} className={[styles.section, alt && styles.alt, tight && styles.tight].filter(Boolean).join(" ")}>
      <div className={styles.inner}>
        {(eyebrow || title || lead) && (
          <header className={styles.heading}>
            {eyebrow && <span className={styles.eyebrow}>{eyebrow}</span>}
            {title && <h2 className={styles.title}>{title}</h2>}
            {lead && <p className={styles.lead}>{lead}</p>}
          </header>
        )}
        {children}
      </div>
    </section>
  );
}

export function Container({ children }: { children: ReactNode }) {
  return <div className={styles.inner}>{children}</div>;
}

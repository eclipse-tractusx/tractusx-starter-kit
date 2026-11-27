import { useId } from "react";
import styles from "./Segmented.module.css";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  title?: string;
}

interface SegmentedProps<T extends string> {
  label: string;
  value: T;
  options: SegmentedOption<T>[];
  onChange: (value: T) => void;
  hint?: string;
}

/** A choice between a few options shown side by side: a radio group that looks like one control. */
export function Segmented<T extends string>({ label, value, options, onChange, hint }: SegmentedProps<T>) {
  const name = useId();
  return (
    <fieldset className={styles.field}>
      <legend className={styles.legend}>{label}</legend>
      <div className={styles.track}>
        {options.map((option) => (
          <label key={option.value} className={styles.option} title={option.title}>
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={option.value === value}
              onChange={() => onChange(option.value)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
      {hint && <p className={styles.hint}>{hint}</p>}
    </fieldset>
  );
}

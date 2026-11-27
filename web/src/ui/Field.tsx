import { useId, type CSSProperties, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react";
import styles from "./Field.module.css";

interface FieldShellProps {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  id: string;
  children: ReactNode;
}

function FieldShell({ label, hint, error, id, children }: FieldShellProps) {
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>
      {children}
      {error ? (
        <span className={styles.error} id={`${id}-message`} role="alert">
          {error}
        </span>
      ) : (
        hint && (
          <span className={styles.hint} id={`${id}-message`}>
            {hint}
          </span>
        )
      )}
    </div>
  );
}

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  mono?: boolean;
  onChange: (value: string) => void;
}

export function TextField({ label, hint, error, mono, onChange, className, ...rest }: TextFieldProps) {
  const id = useId();
  return (
    <FieldShell label={label} hint={hint} error={error} id={id}>
      <input
        id={id}
        className={[styles.control, mono && styles.mono, error && styles.invalid, className].filter(Boolean).join(" ")}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? `${id}-message` : undefined}
        onChange={(event) => onChange(event.target.value)}
        spellCheck={false}
        {...rest}
      />
    </FieldShell>
  );
}

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectFieldProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "onChange"> {
  label: ReactNode;
  hint?: ReactNode;
  options: SelectOption[];
  onChange: (value: string) => void;
}

/** The one dropdown: a native select, styled like every other control. */
export function SelectField({ label, hint, options, onChange, className, ...rest }: SelectFieldProps) {
  const id = useId();
  return (
    <FieldShell label={label} hint={hint} id={id}>
      <select
        id={id}
        className={[styles.control, styles.select, className].filter(Boolean).join(" ")}
        onChange={(event) => onChange(event.target.value)}
        aria-describedby={hint ? `${id}-message` : undefined}
        {...rest}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  disabled?: boolean;
  title?: string;
}

export function Switch({ checked, onChange, label, disabled, title }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      title={title}
      className={[styles.switch, checked && styles.on].filter(Boolean).join(" ")}
      onClick={() => onChange(!checked)}
    >
      <span className={styles.track} aria-hidden="true">
        <span className={styles.thumb} />
      </span>
      {label}
    </button>
  );
}

export interface OptionGroupProps {
  legend: ReactNode;
  /** "radiogroup" for one of many (OptionCard kind="radio"), "group" otherwise. */
  role?: "radiogroup" | "group";
  minColumnWidth?: string;
  hideLegend?: boolean;
  children: ReactNode;
}

/** A labelled grid of OptionCards. */
export function OptionGroup({ legend, role = "radiogroup", minColumnWidth, hideLegend, children }: OptionGroupProps) {
  const id = useId();
  return (
    <div>
      <div id={id} className={hideLegend ? "visually-hidden" : styles.legend}>
        {legend}
      </div>
      <div
        role={role}
        aria-labelledby={id}
        className={styles.group}
        style={minColumnWidth ? ({ "--min": minColumnWidth } as CSSProperties) : undefined}
      >
        {children}
      </div>
    </div>
  );
}

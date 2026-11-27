import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import { Icon, type IconName } from "./Icon";
import styles from "./Button.module.css";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "onDark";
type Size = "sm" | "md" | "lg";

interface Common {
  variant?: Variant;
  size?: Size;
  icon?: IconName;
  iconAfter?: IconName;
  block?: boolean;
  children?: ReactNode;
}

function classes({ variant = "secondary", size = "md", block }: Common, iconOnly: boolean, extra?: string) {
  return [
    styles.button,
    styles[variant],
    size !== "md" && styles[size],
    iconOnly && styles.iconOnly,
    block && styles.block,
    extra,
  ]
    .filter(Boolean)
    .join(" ");
}

function content({ icon, iconAfter, children, size }: Common) {
  const px = size === "sm" ? 15 : 17;
  return (
    <>
      {icon && <Icon name={icon} size={px} />}
      {children}
      {iconAfter && <Icon name={iconAfter} size={px} />}
    </>
  );
}

export type ButtonProps = Common & ButtonHTMLAttributes<HTMLButtonElement>;

/** The one button. A label is required for icon-only buttons (aria-label). */
export function Button({ variant, size, icon, iconAfter, block, children, className, type, ...rest }: ButtonProps) {
  const common = { variant, size, icon, iconAfter, block, children };
  return (
    <button type={type ?? "button"} className={classes(common, !children, className)} {...rest}>
      {content(common)}
    </button>
  );
}

export type LinkButtonProps = Common & AnchorHTMLAttributes<HTMLAnchorElement>;

/** A link that looks like a button: navigation, downloads, external pages. */
export function LinkButton({ variant, size, icon, iconAfter, block, children, className, ...rest }: LinkButtonProps) {
  const common = { variant, size, icon, iconAfter, block, children };
  const external = rest.href?.startsWith("http");
  return (
    <a
      className={classes(common, !children, className)}
      {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
      {...rest}
    >
      {content(common)}
    </a>
  );
}

import styles from "./ThemedImage.module.css";

export interface ThemedSource {
  /** For light surfaces (dark ink). */
  light: string;
  /** For dark surfaces (light ink). */
  dark: string;
}

interface ThemedImageProps {
  src: ThemedSource;
  alt: string;
  className?: string;
  /** "theme" follows the site theme; "dark" always uses the version for dark surfaces. */
  surface?: "theme" | "dark";
}

/** A logo in the version that reads on the surface behind it. */
export function ThemedImage({ src, alt, className, surface = "theme" }: ThemedImageProps) {
  if (surface === "dark") return <img className={className} src={src.dark} alt={alt} />;
  return (
    <>
      <img className={[styles.forLight, className].filter(Boolean).join(" ")} src={src.light} alt={alt} />
      <img className={[styles.forDark, className].filter(Boolean).join(" ")} src={src.dark} alt="" aria-hidden="true" />
    </>
  );
}

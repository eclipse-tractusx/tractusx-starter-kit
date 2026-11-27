import styles from "./Footer.module.css";

const LINKS = [
  { label: "Source", href: "https://github.com/eclipse-tractusx/tractusx-starter-kit" },
  { label: "Eclipse Tractus-X", href: "https://eclipse-tractusx.github.io/" },
  { label: "Legal notice", href: "https://www.eclipse.org/legal/" },
  { label: "Privacy", href: "https://www.eclipse.org/legal/privacy/" },
  { label: "Terms of use", href: "https://www.eclipse.org/legal/terms-of-use/" },
];

export function Footer() {
  const sha = __SOURCE_SHA__;
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.brand}>
          <img src="./tractusx-starter-kit_icon-dark-rounded.svg" alt="" width={32} height={32} />
          <p>
            Eclipse Tractus-X Starter Kit. Copyright © 2026 Contributors to the Eclipse Foundation, under the Apache
            License 2.0 (code) and CC BY 4.0 (documentation).
          </p>
        </div>
        <nav aria-label="Footer">
          <ul className={styles.links}>
            {LINKS.map((link) => (
              <li key={link.label}>
                <a href={link.href} target="_blank" rel="noreferrer">
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        {sha && <p className={styles.build}>Built from {sha.slice(0, 7)}</p>}
      </div>
    </footer>
  );
}

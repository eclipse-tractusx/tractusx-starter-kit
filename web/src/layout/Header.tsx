import { href, type Route } from "../router";
import type { Theme } from "../theme";
import { Button, LinkButton } from "../ui";
import styles from "./Header.module.css";

const REPO = "https://github.com/eclipse-tractusx/tractusx-starter-kit";

const NAV = [
  { label: "Configure", path: "/configure", page: "configure" },
  { label: "Developer toolbox", path: "/configure?target=toolbox", page: "toolbox" },
] as const;

export interface HeaderProps {
  route: Route;
  theme: Theme;
  onToggleTheme: () => void;
}

/** Black, as on every Eclipse Tractus-X site, in both themes. */
export function Header({ route, theme, onToggleTheme }: HeaderProps) {
  const active = route.page === "configure" ? (route.target === "toolbox" ? "toolbox" : "configure") : null;
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <a className={styles.brand} href={href("/")} aria-label="Eclipse Tractus-X Starter Kit, home">
          <img src="./tractusx-starter-kit_horizontal-dark.svg" alt="" height={46} />
        </a>
        <nav className={styles.nav} aria-label="Main">
          {NAV.map((item) => (
            <a
              key={item.page}
              className={styles.link}
              href={href(item.path)}
              aria-current={active === item.page ? "page" : undefined}
            >
              {item.label}
            </a>
          ))}
          <a className={styles.link} href="https://eclipse-tractusx.github.io/" target="_blank" rel="noreferrer">
            Eclipse Tractus-X
          </a>
        </nav>
        <div className={styles.actions}>
          <Button
            variant="onDark"
            size="sm"
            icon={theme === "dark" ? "sun" : "moon"}
            aria-label={theme === "dark" ? "Use the light theme" : "Use the dark theme"}
            onClick={onToggleTheme}
          />
          <LinkButton variant="onDark" size="sm" icon="github" href={REPO} aria-label="The Starter Kit on GitHub" />
        </div>
      </div>
    </header>
  );
}

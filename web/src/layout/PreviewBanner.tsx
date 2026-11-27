import styles from "./PreviewBanner.module.css";

const PULLS = "https://github.com/eclipse-tractusx/tractusx-starter-kit/pull/";

/** Shown on pull request previews only (the build sets SITE_PREVIEW_PR). */
export function PreviewBanner() {
  const pr = __PREVIEW_PR__;
  if (!pr) return null;
  return (
    <div className={styles.banner} role="note">
      This is a preview of{" "}
      <a href={`${PULLS}${pr}`} target="_blank" rel="noreferrer">
        pull request #{pr}
      </a>
      . It goes away when the pull request is closed.
    </div>
  );
}

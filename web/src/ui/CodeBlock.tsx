import { useState, type CSSProperties, type ReactNode } from "react";
import { Button } from "./Button";
import styles from "./CodeBlock.module.css";

export interface CodeBlockProps {
  code: string;
  /** Shown in the bar above the code, e.g. a file name. Without it the copy button floats. */
  title?: ReactNode;
  language?: "yaml" | "shell" | "text" | "markdown";
  maxHeight?: string;
  actions?: ReactNode;
  /** Wrap long lines instead of scrolling sideways, for commands people copy. */
  wrap?: boolean;
}

/** Code with a copy button and light highlighting for YAML and shell. */
export function CodeBlock({ code, title, language = "text", maxHeight, actions, wrap }: CodeBlockProps) {
  const copy = <CopyButton text={code} />;
  return (
    <div className={styles.block}>
      {title && (
        <div className={styles.bar}>
          <span>{title}</span>
          <span>
            {actions}
            {copy}
          </span>
        </div>
      )}
      {!title && <span className={styles.floating}>{copy}</span>}
      <pre
        className={[styles.pre, maxHeight && styles.scroll, wrap && styles.wrap].filter(Boolean).join(" ")}
        style={maxHeight ? ({ "--max-height": maxHeight } as CSSProperties) : undefined}
        tabIndex={0}
      >
        <code>{highlight(code, language)}</code>
      </pre>
    </div>
  );
}

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      size="sm"
      variant="ghost"
      icon={copied ? "check" : "copy"}
      aria-label={copied ? "Copied" : label}
      title={copied ? "Copied" : label}
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1600);
      }}
    />
  );
}

function highlight(code: string, language: CodeBlockProps["language"]): ReactNode {
  if (language !== "yaml" && language !== "shell") return code;
  return code.split("\n").map((line, index) => (
    <span key={index}>
      {language === "yaml" ? yamlLine(line) : shellLine(line)}
      {"\n"}
    </span>
  ));
}

function yamlLine(line: string): ReactNode {
  const comment = line.match(/^(\s*)(#.*)$/);
  if (comment) {
    return (
      <>
        {comment[1]}
        <span className={styles.comment}>{comment[2]}</span>
      </>
    );
  }
  const pair = line.match(/^(\s*-?\s*)([\w.@/-]+)(:)(\s.*|)$/);
  if (pair) {
    const value = pair[4];
    const quoted = /^\s*["'].*["']\s*$/.test(value);
    return (
      <>
        {pair[1]}
        <span className={styles.key}>{pair[2]}</span>
        {pair[3]}
        {quoted ? <span className={styles.string}>{value}</span> : value}
      </>
    );
  }
  return line;
}

function shellLine(line: string): ReactNode {
  if (/^\s*#/.test(line)) return <span className={styles.comment}>{line}</span>;
  return line;
}

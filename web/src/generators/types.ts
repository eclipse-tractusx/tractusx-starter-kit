export type Language = "yaml" | "shell" | "markdown" | "text";

export interface GeneratedFile {
  /** Path inside the bundle, with "/" separators. */
  path: string;
  content: string;
  language: Language;
  /** One line shown next to the file in the review step. */
  summary: string;
  executable?: boolean;
}

export interface Bundle {
  /** The folder the ZIP unpacks to. */
  name: string;
  files: GeneratedFile[];
  /** The commands that start it, in order, shown in the review step. */
  run: string[];
}

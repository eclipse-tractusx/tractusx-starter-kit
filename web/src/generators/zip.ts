import { strToU8, zipSync, type Zippable } from "fflate";
import type { Bundle } from "./types";

const FILE = 0o100644;
const EXECUTABLE = 0o100755;

/** The bundle as a ZIP that unpacks to one folder, with the scripts executable. */
export function zipBundle(bundle: Bundle): Uint8Array {
  const entries: Zippable = {};
  for (const file of bundle.files) {
    // Unix external attributes: the mode in the high 16 bits, made by "Unix" (3).
    entries[`${bundle.name}/${file.path}`] = [
      strToU8(file.content),
      { os: 3, attrs: (file.executable ? EXECUTABLE : FILE) << 16 },
    ];
  }
  return zipSync(entries, { level: 6, mtime: new Date("2026-01-01T00:00:00Z") });
}

export function downloadBundle(bundle: Bundle): void {
  const bytes = zipBundle(bundle);
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/zip" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${bundle.name}.zip`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

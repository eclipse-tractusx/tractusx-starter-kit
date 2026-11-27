import type { Config } from "../model/dataspace";
import { composeBundle } from "./compose";
import { toolboxBundle } from "./toolbox";
import type { Bundle } from "./types";
import { umbrellaBundle } from "./umbrella";

export type { Bundle, GeneratedFile } from "./types";
export { downloadBundle, zipBundle } from "./zip";

export function bundleFor(config: Config): Bundle {
  switch (config.target) {
    case "compose":
      return composeBundle(config);
    case "toolbox":
      return toolboxBundle(config);
    case "umbrella":
      return umbrellaBundle(config);
  }
}

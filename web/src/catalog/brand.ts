import toolboxAppIconForDark from "../assets/toolbox/app-icon-for-dark.webp";
import toolboxAppIconForLight from "../assets/toolbox/app-icon-for-light.webp";
import toolboxLogoForDark from "../assets/toolbox/logo-for-dark.webp";
import toolboxLogoForLight from "../assets/toolbox/logo-for-light.webp";
import toolboxMarkForDark from "../assets/toolbox/mark-for-dark.webp";
import toolboxMarkForLight from "../assets/toolbox/mark-for-light.webp";
import type { ThemedSource } from "../ui";

/** The Eclipse Tractus-X Developer Toolbox logo kit (Community Days, 2026-11). */
export const toolboxMark: ThemedSource = { light: toolboxMarkForLight, dark: toolboxMarkForDark };
export const toolboxLogo: ThemedSource = { light: toolboxLogoForLight, dark: toolboxLogoForDark };
/** The app-style tile with the name inside: for phones and narrow columns. */
export const toolboxAppIcon: ThemedSource = { light: toolboxAppIconForLight, dark: toolboxAppIconForDark };

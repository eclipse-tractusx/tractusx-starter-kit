import type { IconName, ThemedSource } from "../ui";
import { toolboxMark } from "./brand";
import type { Target } from "../model/dataspace";

/** The three things the configurator produces, as the site presents them. */
export interface TargetInfo {
  id: Target;
  title: string;
  icon: IconName;
  /** A product mark shown in place of the icon. */
  mark?: ThemedSource;
  badge: string;
  tagline: string;
  runsOn: string;
  points: string[];
}

export const targets: TargetInfo[] = [
  {
    id: "compose",
    title: "Docker Compose",
    icon: "container",
    badge: "Fastest start",
    tagline: "A small dataspace as one compose file: connectors, wallets, issuer and BPN directory.",
    runsOn: "Docker",
    points: ["One command, credentials issued", "In-memory runtimes, from about 2 GB", "A first data exchange included"],
  },
  {
    id: "toolbox",
    title: "Developer toolbox",
    icon: "toolbox",
    mark: toolboxMark,
    badge: "For tests and CI",
    tagline: "The same small dataspace in kind with the Helm charts, on your machine or in a GitHub runner.",
    runsOn: "Docker + kind",
    points: ["Same config locally and in CI", "TestLab and test stand-ins", "A GitHub Action for your pull requests"],
  },
  {
    id: "umbrella",
    title: "Umbrella Helm",
    icon: "helm",
    badge: "Closest to production",
    tagline: "The Eclipse Tractus-X Umbrella chart with the components you choose, pulled and ready to install.",
    runsOn: "Kubernetes",
    points: ["Start from an Umbrella profile", "Add or remove any component", "Charts pulled for offline installs"],
  },
];

export function targetInfo(id: Target): TargetInfo {
  return targets.find((target) => target.id === id) ?? targets[0];
}

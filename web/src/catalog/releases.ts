/**
 * Eclipse Tractus-X releases the configurator offers. Each one pins the Umbrella chart the
 * Helm output installs and the Umbrella tag its value profiles are read from.
 *
 * Add a release by adding an entry: every generator reads these and nothing else.
 */
export interface Release {
  id: string;
  label: string;
  umbrellaChart: string;
  /** The tag of eclipse-tractusx/tractus-x-umbrella the profiles come from. */
  umbrellaRef: string;
  latest?: boolean;
  notes: string;
}

export const releases: Release[] = [
  {
    id: "26.06",
    label: "Eclipse Tractus-X 26.06",
    umbrellaChart: "26.06.01",
    umbrellaRef: "umbrella-26.06.01",
    latest: true,
    notes: "Umbrella 26.06.01, released 20 November 2026.",
  },
  {
    id: "26.03",
    label: "Eclipse Tractus-X 26.03",
    umbrellaChart: "26.03.06",
    umbrellaRef: "umbrella-26.03.06",
    notes: "Umbrella 26.03.06, the last patch of 26.03.",
  },
];

/**
 * The developer toolbox pins its own Umbrella chart: the one its rendering, its
 * credential issuance and its CI were tested with (developer-toolbox/toolbox.yaml).
 */
export const toolboxPin = {
  umbrellaChart: "26.03.00",
  umbrellaRef: "umbrella-26.03.00",
  identityhubChart: "v0.4.0",
  testlab: "1.0.0a24",
};

/** The installer of the tx-toolbox command: `curl -fsSL … | bash`. */
export const TOOLBOX_INSTALLER =
  "https://raw.githubusercontent.com/eclipse-tractusx/tractusx-starter-kit/main/developer-toolbox/install.sh";

export const defaultRelease = releases.find((release) => release.latest) ?? releases[0];

export function releaseById(id: string): Release {
  return releases.find((release) => release.id === id) ?? defaultRelease;
}

export const UMBRELLA_HELM_REPO = "https://eclipse-tractusx.github.io/charts/dev";
export const UMBRELLA_REPO = "https://github.com/eclipse-tractusx/tractus-x-umbrella";

export function profileUrl(release: Pick<Release, "umbrellaRef">, file: string): string {
  return `https://raw.githubusercontent.com/eclipse-tractusx/tractus-x-umbrella/${release.umbrellaRef}/charts/umbrella/${file}`;
}

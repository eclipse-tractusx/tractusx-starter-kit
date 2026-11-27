import type { IconName } from "../ui";

/**
 * The Umbrella chart's components, by the values key that switches each one on
 * (`<key>.enabled`), and its value profiles. Read from charts/umbrella/Chart.yaml
 * and values-*.yaml of Umbrella 26.03 and 26.06, which declare the same set.
 */

export type UmbrellaCategory = "dataspace" | "data" | "portal" | "discovery" | "observability" | "tools";

export const umbrellaCategories: Record<UmbrellaCategory, { label: string; icon: IconName }> = {
  dataspace: { label: "Dataspace core", icon: "network" },
  data: { label: "Data exchange", icon: "database" },
  portal: { label: "Portal and identity", icon: "users" },
  discovery: { label: "Discovery and semantics", icon: "search" },
  observability: { label: "Observability", icon: "chart" },
  tools: { label: "Tools", icon: "sliders" },
};

export interface UmbrellaComponent {
  key: string;
  name: string;
  category: UmbrellaCategory;
  description: string;
  /** Values keys this component needs; selecting it selects them. */
  requires?: string[];
  docs?: string;
}

export const umbrellaComponents: UmbrellaComponent[] = [
  {
    key: "edc-provider",
    name: "Provider connector",
    category: "dataspace",
    description: "Eclipse Tractus-X EDC with its own IdentityHub wallet (decentralized identity), offering data.",
    requires: ["tractusx-issuerservice", "bdrs-server-memory"],
    docs: "https://eclipse-tractusx.github.io/tractusx-edc/",
  },
  {
    key: "edc-consumer",
    name: "Consumer connector",
    category: "dataspace",
    description: "Eclipse Tractus-X EDC with its own IdentityHub wallet, negotiating for and pulling data.",
    requires: ["tractusx-issuerservice", "bdrs-server-memory"],
    docs: "https://eclipse-tractusx.github.io/tractusx-edc/",
  },
  {
    key: "tractusx-issuerservice",
    name: "IssuerService",
    category: "dataspace",
    description: "Issues the Catena-X verifiable credentials the connectors present.",
    docs: "https://github.com/eclipse-tractusx/tractusx-identityhub",
  },
  {
    key: "bdrs-server-memory",
    name: "BPN-DID Resolution Service",
    category: "dataspace",
    description: "Resolves a participant's BPN to its DID (BDRS), in memory.",
    docs: "https://github.com/eclipse-tractusx/bpn-did-resolution-service",
  },
  {
    key: "tx-data-provider",
    name: "Data provider bundle",
    category: "data",
    description: "A connector, a Digital Twin Registry and a data persistence layer, wired together.",
    requires: ["identity-and-trust-bundle"],
  },
  {
    key: "dataconsumerOne",
    name: "Data consumer one",
    category: "data",
    description: "A first consumer connector for the data provider bundle.",
    requires: ["identity-and-trust-bundle"],
  },
  {
    key: "dataconsumerTwo",
    name: "Data consumer two",
    category: "data",
    description: "A second consumer connector for the data provider bundle.",
    requires: ["identity-and-trust-bundle"],
  },
  {
    key: "identity-and-trust-bundle",
    name: "Identity and trust bundle",
    category: "data",
    description: "The SSI DIM wallet stub: identity and authentication for the data provider bundle and its consumers.",
  },
  {
    key: "portal",
    name: "Portal",
    category: "portal",
    description: "The Catena-X portal: onboarding, company and user management, the marketplace.",
    requires: ["centralidp", "sharedidp"],
    docs: "https://github.com/eclipse-tractusx/portal",
  },
  {
    key: "centralidp",
    name: "Central IdP",
    category: "portal",
    description: "Keycloak for the dataspace's central identity provider.",
  },
  {
    key: "sharedidp",
    name: "Shared IdP",
    category: "portal",
    description: "Keycloak for companies without an identity provider of their own.",
  },
  {
    key: "ssi-credential-issuer",
    name: "SSI credential issuer",
    category: "portal",
    description: "Issues credentials through the portal's onboarding flows.",
  },
  {
    key: "bpdm",
    name: "BPDM",
    category: "discovery",
    description: "Business Partner Data Management: the golden record of business partners.",
    docs: "https://github.com/eclipse-tractusx/bpdm",
  },
  {
    key: "discoveryfinder",
    name: "Discovery Finder",
    category: "discovery",
    description: "Finds the discovery service for a type of identifier.",
  },
  {
    key: "bpndiscovery",
    name: "BPN Discovery",
    category: "discovery",
    description: "Finds the BPN that owns an identifier, such as a part number.",
  },
  {
    key: "semantic-hub",
    name: "Semantic Hub",
    category: "discovery",
    description: "Stores and serves the Catena-X semantic models.",
  },
  {
    key: "selfdescription",
    name: "SD Factory",
    category: "discovery",
    description: "Creates Gaia-X self-descriptions.",
  },
  {
    key: "prometheus",
    name: "Prometheus",
    category: "observability",
    description: "Metrics.",
  },
  {
    key: "grafana",
    name: "Grafana",
    category: "observability",
    description: "Dashboards over the metrics and logs.",
  },
  {
    key: "loki",
    name: "Loki",
    category: "observability",
    description: "Logs.",
  },
  {
    key: "jaeger",
    name: "Jaeger",
    category: "observability",
    description: "Traces.",
  },
  {
    key: "opentelemetry-collector",
    name: "OpenTelemetry Collector",
    category: "observability",
    description: "Collects metrics, logs and traces and forwards them.",
  },
  {
    key: "pgadmin4",
    name: "pgAdmin",
    category: "tools",
    description: "A web UI for the PostgreSQL databases.",
  },
  {
    key: "cert-manager",
    name: "cert-manager",
    category: "tools",
    description: "TLS certificates for the ingresses.",
  },
];

export interface UmbrellaProfile {
  id: string;
  file: string;
  name: string;
  description: string;
  /** The values keys the profile switches on. */
  enables: string[];
  recommended?: boolean;
}

export const umbrellaProfiles: UmbrellaProfile[] = [
  {
    id: "decentralized-identityhub",
    file: "values-adopter-decentralized-identityhub.yaml",
    name: "Decentralized identity",
    description: "Two connectors with IdentityHub wallets, an IssuerService and a BDRS: the current Eclipse Tractus-X identity model.",
    enables: ["edc-provider", "edc-consumer", "tractusx-issuerservice", "bdrs-server-memory"],
    recommended: true,
  },
  {
    id: "data-exchange",
    file: "values-adopter-data-exchange.yaml",
    name: "Data exchange",
    description: "The data provider bundle and a consumer, with the identity and trust bundle and pgAdmin.",
    enables: ["dataconsumerOne", "tx-data-provider", "pgadmin4", "identity-and-trust-bundle"],
  },
  {
    id: "data-exchange-observability",
    file: "values-adopter-data-exchange-observability.yaml",
    name: "Data exchange with observability",
    description: "Data exchange, plus Prometheus, Grafana, Loki, Jaeger and the OpenTelemetry Collector.",
    enables: [
      "dataconsumerOne",
      "tx-data-provider",
      "pgadmin4",
      "identity-and-trust-bundle",
      "jaeger",
      "opentelemetry-collector",
      "prometheus",
      "loki",
      "grafana",
    ],
  },
  {
    id: "portal",
    file: "values-adopter-portal.yaml",
    name: "Portal",
    description: "The portal with its central and shared identity providers, and pgAdmin.",
    enables: ["portal", "centralidp", "sharedidp", "pgadmin4"],
  },
];

export function umbrellaComponent(key: string): UmbrellaComponent | undefined {
  return umbrellaComponents.find((component) => component.key === key);
}

export function profileById(id: string): UmbrellaProfile {
  return umbrellaProfiles.find((profile) => profile.id === id) ?? umbrellaProfiles[0];
}

/** The keys in `selected`, plus every key they need, transitively. */
export function withRequirements(selected: Iterable<string>): Set<string> {
  const result = new Set<string>();
  const visit = (key: string) => {
    if (result.has(key)) return;
    result.add(key);
    umbrellaComponent(key)?.requires?.forEach(visit);
  };
  for (const key of selected) visit(key);
  return result;
}

/** Keys that are on only because another selected key needs them, with who needs them. */
export function requiredBy(selected: Set<string>): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const key of selected) {
    for (const needed of umbrellaComponent(key)?.requires ?? []) {
      map.set(needed, [...(map.get(needed) ?? []), key]);
    }
  }
  return map;
}

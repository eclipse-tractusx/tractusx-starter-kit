/**
 * The Digital Twin Registry implementations a participant can run. Both answer the
 * same AAS Part 2 registry API under /api/v3 behind the gateway, so a consumer
 * finds twins the same way whichever one the provider runs.
 */
export type RegistryKind = "tractusx" | "basyx";

export interface RegistryOption {
  id: RegistryKind;
  name: string;
  short: string;
  description: string;
  project: string;
}

export const registries: RegistryOption[] = [
  {
    id: "tractusx",
    name: "Eclipse Tractus-X Digital Twin Registry",
    short: "Eclipse Tractus-X",
    description: "The reference registry (Java). Applies the Catena-X externalSubjectId (BPN) visibility.",
    project: "https://github.com/eclipse-tractusx/sldt-digital-twin-registry",
  },
  {
    id: "basyx",
    name: "Eclipse BaSyx Go Digital Twin Registry",
    short: "Eclipse BaSyx Go",
    description:
      "The Eclipse BaSyx registry (Go), light on memory. Runs without ABAC here: every caller that reaches it sees all specificAssetIds.",
    project: "https://github.com/eclipse-basyx/basyx-go-components",
  },
];

export function registryById(id: RegistryKind | undefined): RegistryOption {
  return registries.find((registry) => registry.id === id) ?? registries[0];
}

import { defaultRelease } from "../catalog/releases";
import type { RegistryKind } from "../catalog/registries";
import { profileById, withRequirements } from "../catalog/umbrella";

/**
 * The one model every output is generated from. The Docker Compose and developer
 * toolbox outputs read `participants`, `standIns` and `testlab` (the same keys as
 * developer-toolbox/toolbox.yaml); the Umbrella output reads `umbrella`.
 */

export type Target = "compose" | "toolbox" | "umbrella";

export interface Participant {
  /** A stable key for the UI; never written to a file. */
  uid: string;
  name: string;
  bpn: string;
  connector: boolean;
  dtr: boolean;
  /** Which Digital Twin Registry it runs, when `dtr` is on (Docker Compose only). */
  registry: RegistryKind;
}

export interface StandIns {
  echo: boolean;
  stubCaller: boolean;
  submodelServer: boolean;
}

export interface Config {
  target: Target;
  releaseId: string;
  participants: Participant[];
  standIns: StandIns;
  testlab: { version: string; sut: string; engine: string };
  umbrella: { profileId: string; components: string[]; namespace: string; registry: RegistryKind };
}

let counter = 0;
export function uid(): string {
  counter += 1;
  return `p${Date.now().toString(36)}${counter}`;
}

export function defaultParticipants(): Participant[] {
  return [
    { uid: uid(), name: "provider", bpn: "BPNL000000000001", connector: true, dtr: true, registry: "tractusx" },
    { uid: uid(), name: "consumer", bpn: "BPNL000000000002", connector: true, dtr: false, registry: "tractusx" },
  ];
}

export function defaultConfig(target: Target = "compose"): Config {
  const profile = profileById("decentralized-identityhub");
  return {
    target,
    releaseId: defaultRelease.id,
    participants: defaultParticipants(),
    standIns: { echo: true, stubCaller: target === "toolbox", submodelServer: target === "toolbox" },
    testlab: { version: target === "toolbox" ? "1.0.0a24" : "", sut: "", engine: "" },
    umbrella: { profileId: profile.id, components: [...profile.enables], namespace: "umbrella", registry: "tractusx" },
  };
}

export type Action =
  | { type: "target"; target: Target }
  | { type: "release"; releaseId: string }
  | { type: "participant"; uid: string; patch: Partial<Omit<Participant, "uid">> }
  | { type: "addParticipant" }
  | { type: "removeParticipant"; uid: string }
  | { type: "standIn"; key: keyof StandIns; value: boolean }
  | { type: "testlab"; patch: Partial<Config["testlab"]> }
  | { type: "profile"; profileId: string }
  | { type: "component"; key: string; on: boolean }
  | { type: "namespace"; namespace: string }
  | { type: "umbrellaRegistry"; registry: RegistryKind }
  | { type: "reset"; target: Target };

export function reduce(config: Config, action: Action): Config {
  switch (action.type) {
    case "target": {
      if (config.target === action.target) return config;
      // The toolbox is for tests: TestLab and the test stand-ins come with it.
      const toolbox = action.target === "toolbox";
      return {
        ...config,
        target: action.target,
        standIns: { ...config.standIns, stubCaller: toolbox, submodelServer: toolbox },
        testlab: { ...config.testlab, version: toolbox ? config.testlab.version || "1.0.0a24" : "" },
      };
    }
    case "release":
      return { ...config, releaseId: action.releaseId };
    case "participant":
      return {
        ...config,
        participants: config.participants.map((participant) => {
          if (participant.uid !== action.uid) return participant;
          const next = { ...participant, ...action.patch };
          // A registry is published through its participant's connector.
          if (!next.connector) next.dtr = false;
          return next;
        }),
      };
    case "addParticipant":
      return { ...config, participants: [...config.participants, nextParticipant(config.participants)] };
    case "removeParticipant":
      return { ...config, participants: config.participants.filter((participant) => participant.uid !== action.uid) };
    case "standIn":
      return { ...config, standIns: { ...config.standIns, [action.key]: action.value } };
    case "testlab":
      return { ...config, testlab: { ...config.testlab, ...action.patch } };
    case "profile": {
      const profile = profileById(action.profileId);
      return { ...config, umbrella: { ...config.umbrella, profileId: profile.id, components: [...profile.enables] } };
    }
    case "component": {
      const selected = new Set(config.umbrella.components);
      if (action.on) selected.add(action.key);
      else selected.delete(action.key);
      return { ...config, umbrella: { ...config.umbrella, components: [...withRequirements(selected)] } };
    }
    case "namespace":
      return { ...config, umbrella: { ...config.umbrella, namespace: action.namespace } };
    case "umbrellaRegistry":
      return { ...config, umbrella: { ...config.umbrella, registry: action.registry } };
    case "reset":
      return defaultConfig(action.target);
  }
}

const NAMES = ["supplier", "recycler", "oem", "logistics", "operator", "partner", "auditor", "tier1", "tier2"];

function nextParticipant(existing: Participant[]): Participant {
  const names = new Set(existing.map((participant) => participant.name));
  const bpns = new Set(existing.map((participant) => participant.bpn));
  const name = NAMES.find((candidate) => !names.has(candidate)) ?? `participant${existing.length + 1}`;
  let number = existing.length + 1;
  let bpn = "";
  do {
    bpn = `BPNL${String(number).padStart(12, "0")}`;
    number += 1;
  } while (bpns.has(bpn) || bpn === ISSUER_BPN);
  return { uid: uid(), name, bpn, connector: true, dtr: false, registry: "tractusx" };
}

// --- Validation: the rules of developer-toolbox/scripts/render_toolbox.py -------------

export const NAME_PATTERN = /^[a-z][a-z0-9-]{0,19}$/;
export const BPN_PATTERN = /^BPN[LSA][A-Z0-9]{12}$/;
export const NAMESPACE_PATTERN = /^[a-z0-9]([-a-z0-9]{0,61}[a-z0-9])?$/;
/** The issuer's BPN; a participant cannot have it. */
export const ISSUER_BPN = "BPNL000000000003";

export interface Problems {
  /** Per participant uid, per field. */
  participants: Record<string, Partial<Record<"name" | "bpn", string>>>;
  /** About the participants as a whole. */
  dataspace: string[];
  /** About TestLab and the stand-ins. */
  testing: string[];
  /** About the Umbrella selection. */
  umbrella: string[];
}

export function validate(config: Config): Problems {
  const problems: Problems = { participants: {}, dataspace: [], testing: [], umbrella: [] };
  const add = (uid: string, field: "name" | "bpn", message: string) => {
    problems.participants[uid] = { ...problems.participants[uid], [field]: message };
  };
  if (config.target === "umbrella") {
    if (!NAMESPACE_PATTERN.test(config.umbrella.namespace)) {
      problems.umbrella.push("The namespace must be a lower-case DNS label, such as umbrella.");
    }
    if (config.umbrella.components.length === 0) problems.umbrella.push("Select at least one component.");
    if (config.umbrella.registry === "basyx" && !umbrellaSelection(config).has("tx-data-provider")) {
      problems.umbrella.push("The Eclipse BaSyx Go registry replaces the data provider's registry: select the data provider (tx-data-provider).");
    }
    return problems;
  }

  const seenNames = new Map<string, string>();
  const seenBpns = new Map<string, string>();
  for (const participant of config.participants) {
    if (!NAME_PATTERN.test(participant.name)) {
      add(participant.uid, "name", "Lower case letters, digits and '-', starting with a letter, at most 20.");
    } else if (seenNames.has(participant.name)) {
      add(participant.uid, "name", "Another participant has this name.");
    }
    if (!BPN_PATTERN.test(participant.bpn)) {
      add(participant.uid, "bpn", "BPNL, BPNS or BPNA and 12 upper-case letters or digits.");
    } else if (participant.bpn === ISSUER_BPN) {
      add(participant.uid, "bpn", "This is the IssuerService's BPN.");
    } else if (seenBpns.has(participant.bpn)) {
      add(participant.uid, "bpn", "Another participant has this BPN.");
    }
    seenNames.set(participant.name, participant.uid);
    seenBpns.set(participant.bpn, participant.uid);
  }
  const connectors = config.participants.filter((participant) => participant.connector);
  if (config.participants.length === 0) problems.dataspace.push("Add at least one participant.");
  if (connectors.length < 2) {
    problems.dataspace.push("A data exchange needs two participants with a connector.");
  }
  if (config.target === "toolbox" && config.testlab.version) {
    const { sut, engine } = testlabRoles(config);
    if (!sut || !engine) problems.testing.push("TestLab needs two participants with a connector.");
    else if (sut === engine) problems.testing.push("TestLab's system under test and engine must differ.");
  }
  return problems;
}

export function hasProblems(problems: Problems): boolean {
  return (
    Object.keys(problems.participants).length > 0 ||
    problems.dataspace.length + problems.testing.length + problems.umbrella.length > 0
  );
}

/** The TestLab roles as the toolbox resolves them: the first two connectors by default. */
export function testlabRoles(config: Config): { sut: string; engine: string } {
  const connectors = config.participants.filter((participant) => participant.connector).map((p) => p.name);
  const sut = connectors.includes(config.testlab.sut) ? config.testlab.sut : connectors[0] ?? "";
  const engine = connectors.includes(config.testlab.engine) && config.testlab.engine !== sut
    ? config.testlab.engine
    : connectors.find((name) => name !== sut) ?? "";
  return { sut, engine };
}

/** About how many GB of memory the dataspace needs (developer-toolbox/scripts/local_toolbox.py). */
export function memoryEstimate(config: Config): number {
  const connectors = config.participants.filter((participant) => participant.connector).length;
  const withDtr = config.participants.filter((participant) => participant.dtr);
  const light = withDtr.filter((participant) => registryOf(config, participant) === "basyx").length;
  const registries = withDtr.length - light;
  const kubernetes = config.target === "toolbox" ? 1.5 : 0.5;
  return kubernetes + 1.25 * connectors + 1.5 * registries + 0.3 * light;
}

export function umbrellaSelection(config: Config): Set<string> {
  return withRequirements(config.umbrella.components);
}

/**
 * The registry a participant runs. Only the Docker Compose output offers the choice;
 * the developer toolbox deploys the Eclipse Tractus-X registry.
 */
export function registryOf(config: Pick<Config, "target">, participant: Participant): RegistryKind {
  return config.target === "compose" && participant.registry === "basyx" ? "basyx" : "tractusx";
}

import { parse } from "yaml";
import { unzipSync, strFromU8 } from "fflate";
import { describe, expect, it } from "vitest";
import { defaultConfig, reduce, registryOf, validate } from "../model/dataspace";
import { composeFile, gatewayRoutes, seedPlan } from "./compose";
import { bundleFor, zipBundle } from "./index";

describe("the Umbrella output", () => {
  it("writes only the difference to the profile", () => {
    const config = reduce(defaultConfig("umbrella"), { type: "component", key: "pgadmin4", on: true });
    const values = parse(bundleFor(config).files.find((file) => file.path === "values.yaml")!.content);
    expect(values).toEqual({ pgadmin4: { enabled: true } });
  });

  it("installs the release's chart with the profile from the release's tag", () => {
    const bundle = bundleFor(defaultConfig("umbrella"));
    const pull = bundle.files.find((file) => file.path === "pull-charts.sh")!.content;
    expect(pull).toContain("helm pull tractusx-dev/umbrella --version 26.06.01");
    expect(pull).toContain("tractus-x-umbrella/umbrella-26.06.01/charts/umbrella/values-adopter-decentralized-identityhub.yaml");
  });
});

describe("the developer toolbox output", () => {
  it("writes every key the toolbox would otherwise default", () => {
    const bundle = bundleFor(defaultConfig("toolbox"));
    const toolbox = parse(bundle.files.find((file) => file.path === "toolbox.yaml")!.content);
    expect(toolbox).toEqual({
      participants: [
        { name: "provider", bpn: "BPNL000000000001", connector: true, dtr: true },
        { name: "consumer", bpn: "BPNL000000000002", connector: true, dtr: false },
      ],
      "stand-ins": { echo: true, "stub-caller": true, "submodel-server": true },
      testlab: { version: "1.0.0a24", sut: "provider", engine: "consumer" },
    });
  });
});

describe("the Docker Compose output", () => {
  const config = defaultConfig("compose");

  it("runs a connector per participant and a registry where asked", () => {
    const services = Object.keys(composeFile(config).services as object);
    expect(services).toEqual(
      expect.arrayContaining([
        "gateway",
        "issuerservice",
        "bdrs",
        "provider-identityhub",
        "provider-controlplane",
        "provider-dataplane",
        "provider-dtr",
        "consumer-controlplane",
      ]),
    );
    expect(services).not.toContain("consumer-dtr");
  });

  it("makes every host a DID or callback names an alias of the gateway", () => {
    const compose = composeFile(config) as { services: Record<string, { networks: unknown; environment?: Record<string, string> }> };
    const aliases = (compose.services.gateway.networks as { dataspace: { aliases: string[] } }).dataspace.aliases;
    const env = compose.services["provider-controlplane"].environment!;
    for (const url of [env.EDC_DSP_CALLBACK_ADDRESS, env.EDC_IAM_STS_OAUTH_TOKEN_URL, env.TX_EDC_IAM_IATP_BDRS_SERVER_URL]) {
      expect(aliases).toContain(new URL(url).hostname);
    }
    expect([...gatewayRoutes(config).keys()].sort()).toEqual([...aliases].sort());
  });

  it("issues credentials to every participant", () => {
    const plan = seedPlan(config) as { participants: { did: string; credentials: string[] }[] };
    expect(plan.participants.map((participant) => participant.did)).toEqual([
      "did:web:provider.local:identityhub:BPNL000000000001",
      "did:web:consumer.local:identityhub:BPNL000000000002",
    ]);
    expect(plan.participants[0].credentials).toContain("MembershipCredential");
  });
});

describe("the ZIP", () => {
  it("unpacks to one folder with the scripts executable", () => {
    const bundle = bundleFor(defaultConfig("compose"));
    const entries = unzipSync(zipBundle(bundle));
    expect(Object.keys(entries).every((path) => path.startsWith(`${bundle.name}/`))).toBe(true);
    expect(strFromU8(entries[`${bundle.name}/README.md`])).toContain("Docker Compose");
  });
});

describe("the Eclipse BaSyx Go registry", () => {
  it("runs in Docker Compose behind the same /api/v3 path", () => {
    const base = defaultConfig("compose");
    const config = reduce(base, { type: "participant", uid: base.participants[0].uid, patch: { registry: "basyx" } });
    const files = Object.fromEntries(bundleFor(config).files.map((file) => [file.path, file.content]));
    const compose = parse(files["docker-compose.yaml"]);
    expect(compose.services["provider-dtr"].image).toMatch(/^eclipsebasyx\/digitaltwinregistry-go:/);
    expect(compose.services["provider-dtr"].environment.SERVER_CONTEXTPATH).toBe("/api/v3");
    expect(compose.services["provider-dtr-schema"].image).toMatch(/basyxconfigurationservice-go/);
    expect(files["gateway/nginx.conf"]).toContain("provider-dtr:5004");
    expect(files["gateway/nginx.conf"]).not.toContain("provider-dtr:4243");
  });

  it("is only offered by Docker Compose; the toolbox keeps the Eclipse Tractus-X registry", () => {
    const base = defaultConfig("toolbox");
    const config = reduce(base, { type: "participant", uid: base.participants[0].uid, patch: { registry: "basyx" } });
    expect(registryOf(config, config.participants[0])).toBe("tractusx");
  });

  it("adds the Umbrella overlay and a post-renderer for Helm 3 and 4", () => {
    const config = reduce(reduce(defaultConfig("umbrella"), { type: "profile", profileId: "data-exchange" }), {
      type: "umbrellaRegistry",
      registry: "basyx",
    });
    const files = Object.fromEntries(bundleFor(config).files.map((file) => [file.path, file.content]));
    expect(files["pull-charts.sh"]).toContain("values-adopter-data-exchange-basyx.yaml");
    expect(files["install.sh"]).toContain("-f basyx.yaml");
    expect(files["install.sh"]).toContain("HELM_PLUGINS");
    expect(files["helm-plugins/basyx-post-render/plugin.yaml"]).toContain("type: postrenderer/v1");
    expect(validate(config).umbrella).toEqual([]);
  });

  it("needs the data provider in the Umbrella", () => {
    const config = reduce(defaultConfig("umbrella"), { type: "umbrellaRegistry", registry: "basyx" });
    expect(validate(config).umbrella.join(" ")).toContain("tx-data-provider");
    expect(bundleFor(config).files.map((file) => file.path)).not.toContain("check-registry.sh");
  });
});


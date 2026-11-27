import { describe, expect, it } from "vitest";
import { defaultConfig, hasProblems, reduce, testlabRoles, validate } from "./dataspace";

describe("the dataspace model", () => {
  it("starts valid for every output", () => {
    for (const target of ["compose", "toolbox", "umbrella"] as const) {
      expect(hasProblems(validate(defaultConfig(target)))).toBe(false);
    }
  });

  it("checks names and BPNs as the toolbox does", () => {
    const config = defaultConfig("compose");
    const [first, second] = config.participants;
    const bad = reduce(reduce(config, { type: "participant", uid: first.uid, patch: { name: "1x" } }), {
      type: "participant",
      uid: second.uid,
      patch: { bpn: "BPNL0001" },
    });
    const problems = validate(bad);
    expect(problems.participants[first.uid]?.name).toBeTruthy();
    expect(problems.participants[second.uid]?.bpn).toBeTruthy();
  });

  it("rejects duplicate names, duplicate BPNs and the issuer's BPN", () => {
    const config = defaultConfig("compose");
    const [first, second] = config.participants;
    const same = reduce(config, { type: "participant", uid: second.uid, patch: { name: first.name, bpn: first.bpn } });
    expect(validate(same).participants[second.uid]).toEqual({
      name: expect.any(String),
      bpn: expect.any(String),
    });
    const issuer = reduce(config, { type: "participant", uid: second.uid, patch: { bpn: "BPNL000000000003" } });
    expect(validate(issuer).participants[second.uid]?.bpn).toMatch(/IssuerService/);
  });

  it("drops a registry with its connector", () => {
    const config = defaultConfig("compose");
    const provider = config.participants[0];
    const next = reduce(config, { type: "participant", uid: provider.uid, patch: { connector: false } });
    expect(next.participants[0].dtr).toBe(false);
    expect(validate(next).dataspace).toHaveLength(1);
  });

  it("adds participants with unused names and BPNs", () => {
    let config = defaultConfig("compose");
    config = reduce(reduce(config, { type: "addParticipant" }), { type: "addParticipant" });
    const names = config.participants.map((participant) => participant.name);
    const bpns = config.participants.map((participant) => participant.bpn);
    expect(new Set(names).size).toBe(4);
    expect(new Set(bpns).size).toBe(4);
    expect(hasProblems(validate(config))).toBe(false);
  });

  it("resolves TestLab's roles like the toolbox: the first two connectors", () => {
    const config = defaultConfig("toolbox");
    expect(testlabRoles(config)).toEqual({ sut: "provider", engine: "consumer" });
    const swapped = reduce(config, { type: "testlab", patch: { sut: "consumer" } });
    expect(testlabRoles(swapped)).toEqual({ sut: "consumer", engine: "provider" });
  });

  it("selects what an Umbrella component needs", () => {
    const config = reduce(defaultConfig("umbrella"), { type: "profile", profileId: "portal" });
    const next = reduce(config, { type: "component", key: "edc-provider", on: true });
    expect(next.umbrella.components).toEqual(
      expect.arrayContaining(["edc-provider", "tractusx-issuerservice", "bdrs-server-memory"]),
    );
  });

  it("brings TestLab and the test stand-ins with the toolbox", () => {
    const next = reduce(defaultConfig("compose"), { type: "target", target: "toolbox" });
    expect(next.testlab.version).toBe("1.0.0a24");
    expect(next.standIns.stubCaller).toBe(true);
    expect(reduce(next, { type: "target", target: "compose" }).testlab.version).toBe("");
  });
});

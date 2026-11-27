import { mkdirSync, writeFileSync, chmodSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "vitest";
import { defaultConfig, reduce, type Config } from "../model/dataspace";
import { bundleFor } from "./index";

/**
 * Writes the bundles of a few configurations to $SAMPLES_DIR, so that CI can
 * check them with the real tools (helm template, render_toolbox.py,
 * docker compose config). Without SAMPLES_DIR it does nothing.
 */
const out = process.env.SAMPLES_DIR;

function samples(): Record<string, Config> {
  const compose = defaultConfig("compose");
  const bigger = reduce(compose, { type: "addParticipant" });
  const minimal = reduce(reduce(compose, { type: "standIn", key: "echo", value: false }), {
    type: "participant",
    uid: compose.participants[0].uid,
    patch: { dtr: false },
  });
  return {
    "compose-minimal": minimal,
    "compose-default": compose,
    "compose-three": bigger,
    "compose-basyx": reduce(compose, { type: "participant", uid: compose.participants[0].uid, patch: { registry: "basyx" } }),
    "toolbox-default": defaultConfig("toolbox"),
    "toolbox-three": reduce(defaultConfig("toolbox"), { type: "addParticipant" }),
    "umbrella-default": defaultConfig("umbrella"),
    "umbrella-basyx": reduce(reduce(defaultConfig("umbrella"), { type: "profile", profileId: "data-exchange" }), {
      type: "umbrellaRegistry",
      registry: "basyx",
    }),
    "umbrella-portal-plus": reduce(reduce(defaultConfig("umbrella"), { type: "profile", profileId: "portal" }), {
      type: "component",
      key: "edc-provider",
      on: true,
    }),
  };
}

describe.runIf(Boolean(out))("samples", () => {
  it("writes them", () => {
    for (const [name, config] of Object.entries(samples())) {
      const bundle = bundleFor(config);
      for (const file of bundle.files) {
        const path = join(out!, name, file.path);
        mkdirSync(dirname(path), { recursive: true });
        writeFileSync(path, file.content);
        if (file.executable) chmodSync(path, 0o755);
      }
    }
  });
});

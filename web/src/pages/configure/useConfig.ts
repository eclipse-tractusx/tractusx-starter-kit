import { useEffect, useReducer } from "react";
import { defaultConfig, reduce, type Config, type Target } from "../../model/dataspace";

const KEY = "tx-configurator";
const TARGETS: Target[] = ["compose", "toolbox", "umbrella"];

function isTarget(value: unknown): value is Target {
  return TARGETS.includes(value as Target);
}

/** A configuration saved by an earlier version of the site, with the fields it lacks. */
function withDefaults(saved: Config): Config {
  return {
    ...saved,
    participants: saved.participants.map((participant) => ({ ...participant, registry: participant.registry ?? "tractusx" })),
    umbrella: { ...saved.umbrella, registry: saved.umbrella.registry ?? "tractusx" },
  };
}

/** The configuration, kept across reloads in this browser only. */
function load(target?: string): Config {
  let saved: Config | null = null;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) saved = JSON.parse(raw) as Config;
  } catch {
    saved = null;
  }
  const valid = saved && isTarget(saved.target) && Array.isArray(saved.participants) && saved.umbrella && saved.testlab;
  const base = valid ? withDefaults(saved as Config) : defaultConfig(isTarget(target) ? target : "compose");
  return isTarget(target) ? reduce(base, { type: "target", target }) : base;
}

export function useConfig(target?: string) {
  const [config, dispatch] = useReducer(reduce, target, load);
  useEffect(() => {
    if (isTarget(target)) dispatch({ type: "target", target });
  }, [target]);
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(config));
    } catch {
      // Without storage the configuration lasts for the visit.
    }
  }, [config]);
  return [config, dispatch] as const;
}

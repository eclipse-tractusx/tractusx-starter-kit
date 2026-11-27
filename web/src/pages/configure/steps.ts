import type { Config, Problems } from "../../model/dataspace";

export type StepId = "target" | "release" | "components" | "participants" | "testing" | "review";

export interface StepDef {
  id: StepId;
  label: string;
}

export function stepsFor(config: Config): StepDef[] {
  switch (config.target) {
    case "umbrella":
      return [
        { id: "target", label: "Output" },
        { id: "release", label: "Release" },
        { id: "components", label: "Components" },
        { id: "review", label: "Download" },
      ];
    case "toolbox":
      return [
        { id: "target", label: "Output" },
        { id: "participants", label: "Participants" },
        { id: "testing", label: "Testing" },
        { id: "review", label: "Download" },
      ];
    case "compose":
      return [
        { id: "target", label: "Output" },
        { id: "participants", label: "Participants" },
        { id: "review", label: "Download" },
      ];
  }
}

/** Whether a step's own choices are valid, so that the next one can be opened. */
export function stepIsValid(step: StepId, problems: Problems): boolean {
  switch (step) {
    case "participants":
      return Object.keys(problems.participants).length === 0 && problems.dataspace.length === 0;
    case "testing":
      return problems.testing.length === 0;
    case "components":
      return problems.umbrella.length === 0;
    default:
      return true;
  }
}

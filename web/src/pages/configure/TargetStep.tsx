import { targets } from "../../catalog/targets";
import type { Action, Config } from "../../model/dataspace";
import { Badge, OptionCard, OptionGroup, ThemedImage } from "../../ui";

export function TargetStep({ config, dispatch }: { config: Config; dispatch: (action: Action) => void }) {
  return (
    <OptionGroup legend="How do you want to run your dataspace?" minColumnWidth="15rem">
      {targets.map((target) => (
        <OptionCard
          key={target.id}
          icon={target.icon}
          media={target.mark && <ThemedImage src={target.mark} alt="" />}
          title={target.title}
          badge={<Badge tone="accent">{target.badge}</Badge>}
          description={target.tagline}
          meta={`Runs on ${target.runsOn}`}
          selected={config.target === target.id}
          onSelect={() => dispatch({ type: "target", target: target.id })}
        />
      ))}
    </OptionGroup>
  );
}

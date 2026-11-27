import { releases } from "../../catalog/releases";
import type { Action, Config } from "../../model/dataspace";
import { Badge, OptionCard, OptionGroup } from "../../ui";

export function ReleaseStep({ config, dispatch }: { config: Config; dispatch: (action: Action) => void }) {
  return (
    <OptionGroup legend="Which Eclipse Tractus-X release?" minColumnWidth="16rem">
      {releases.map((release) => (
        <OptionCard
          key={release.id}
          icon="tag"
          title={release.label}
          badge={release.latest ? <Badge tone="success">Latest</Badge> : undefined}
          description={release.notes}
          meta={`umbrella ${release.umbrellaChart}`}
          selected={config.releaseId === release.id}
          onSelect={() => dispatch({ type: "release", releaseId: release.id })}
        />
      ))}
    </OptionGroup>
  );
}

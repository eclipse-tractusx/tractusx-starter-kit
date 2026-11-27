import {
  requiredBy,
  umbrellaCategories,
  umbrellaComponent,
  umbrellaComponents,
  umbrellaProfiles,
  type UmbrellaCategory,
} from "../../catalog/umbrella";
import { registries } from "../../catalog/registries";
import { umbrellaSelection, type Action, type Config, type Problems } from "../../model/dataspace";
import { Badge, Callout, OptionCard, OptionGroup, TextField } from "../../ui";
import styles from "./Configure.module.css";

interface Props {
  config: Config;
  problems: Problems;
  dispatch: (action: Action) => void;
}

export function ComponentsStep({ config, problems, dispatch }: Props) {
  const selected = umbrellaSelection(config);
  const needs = requiredBy(selected);
  const profile = umbrellaProfiles.find((p) => p.id === config.umbrella.profileId);
  const changed =
    profile &&
    (profile.enables.length !== selected.size || profile.enables.some((key) => !selected.has(key)));
  const categories = Object.keys(umbrellaCategories) as UmbrellaCategory[];
  return (
    <div className={styles.stack}>
      <OptionGroup legend="Start from an Umbrella profile" minColumnWidth="15rem">
        {umbrellaProfiles.map((item) => (
          <OptionCard
            key={item.id}
            icon="layers"
            title={item.name}
            badge={item.recommended ? <Badge tone="accent">Recommended</Badge> : undefined}
            description={item.description}
            meta={item.file}
            selected={config.umbrella.profileId === item.id}
            onSelect={() => dispatch({ type: "profile", profileId: item.id })}
          />
        ))}
      </OptionGroup>
      {changed && (
        <Callout title="Changed from the profile">
          values.yaml switches the difference on and off; the profile is installed as it is.
        </Callout>
      )}
      {categories.map((category) => {
        const items = umbrellaComponents.filter((component) => component.category === category);
        return (
          <OptionGroup key={category} role="group" legend={umbrellaCategories[category].label} minColumnWidth="16rem">
            {items.map((component) => {
              const neededBy = (needs.get(component.key) ?? []).filter((key) => selected.has(key));
              const locked = selected.has(component.key) && neededBy.length > 0;
              return (
                <OptionCard
                  key={component.key}
                  kind="checkbox"
                  title={component.name}
                  description={component.description}
                  meta={component.key}
                  selected={selected.has(component.key)}
                  locked={locked}
                  lockedReason={
                    locked
                      ? `Needed by ${neededBy.map((key) => umbrellaComponent(key)?.name ?? key).join(", ")}`
                      : undefined
                  }
                  onSelect={() => dispatch({ type: "component", key: component.key, on: !selected.has(component.key) })}
                />
              );
            })}
          </OptionGroup>
        );
      })}
      {(selected.has("tx-data-provider") || config.umbrella.registry === "basyx") && (
        <OptionGroup legend="The data provider's Digital Twin Registry" minColumnWidth="16rem">
          {registries.map((registry) => (
            <OptionCard
              key={registry.id}
              kind="radio"
              title={registry.name}
              description={
                registry.id === "basyx"
                  ? "The Umbrella's digital-twin-basyx-bundle, with its own PostgreSQL 16. The generated scripts add the overlay and its post-renderer for you."
                  : "The Umbrella's digital-twin-bundle, as the profile installs it."
              }
              meta={registry.id === "basyx" ? "digital-twin-basyx-bundle" : "digital-twin-bundle"}
              selected={config.umbrella.registry === registry.id}
              onSelect={() => dispatch({ type: "umbrellaRegistry", registry: registry.id })}
            />
          ))}
        </OptionGroup>
      )}
      {problems.umbrella
        .filter((problem) => problem.includes("BaSyx"))
        .map((problem) => (
          <Callout key={problem} tone="warning" title="The registry needs the data provider">
            {problem}
          </Callout>
        ))}
      <div className={styles.narrow}>
        <TextField
          label="Kubernetes namespace"
          value={config.umbrella.namespace}
          mono
          error={problems.umbrella.find((p) => p.includes("namespace"))}
          onChange={(namespace) => dispatch({ type: "namespace", namespace })}
        />
      </div>
    </div>
  );
}

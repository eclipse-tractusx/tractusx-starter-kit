import { releaseById, toolboxPin } from "../../catalog/releases";
import { targetInfo } from "../../catalog/targets";
import { profileById } from "../../catalog/umbrella";
import { estimateMemory } from "../../generators/compose";
import { memoryEstimate, testlabRoles, umbrellaSelection, type Config } from "../../model/dataspace";
import { Badge, Icon } from "../../ui";
import styles from "./Configure.module.css";

/** What the configuration amounts to, beside every step. */
export function Summary({ config, valid }: { config: Config; valid: boolean }) {
  const target = targetInfo(config.target);
  const rows: [string, string][] = [];
  if (config.target === "umbrella") {
    const release = releaseById(config.releaseId);
    rows.push(["Release", `${release.label} (umbrella ${release.umbrellaChart})`]);
    rows.push(["Profile", profileById(config.umbrella.profileId).name]);
    rows.push(["Components", String(umbrellaSelection(config).size)]);
    rows.push(["Namespace", config.umbrella.namespace]);
  } else {
    const connectors = config.participants.filter((p) => p.connector).length;
    const registries = config.participants.filter((p) => p.connector && p.dtr).length;
    rows.push(["Umbrella", `${toolboxPin.umbrellaChart}, pinned by the toolbox`]);
    rows.push(["Participants", String(config.participants.length)]);
    rows.push(["Connectors", String(connectors)]);
    rows.push(["Twin registries", String(registries)]);
    if (config.target === "toolbox") {
      const roles = testlabRoles(config);
      rows.push(["TestLab", config.testlab.version ? `${config.testlab.version}: ${roles.sut} ← ${roles.engine}` : "not installed"]);
    }
    const memory = config.target === "compose" ? estimateMemory(config) : memoryEstimate(config);
    rows.push(["Memory", `about ${memory.toFixed(1).replace(/\.0$/, "")} GB`]);
  }
  return (
    <aside className={styles.summary} aria-label="Summary">
      <div className={styles.summaryHead}>
        <Icon name={target.icon} size={20} />
        <div>
          <span className={styles.summaryEyebrow}>Your dataspace</span>
          <strong>{target.title}</strong>
        </div>
      </div>
      <dl className={styles.facts}>
        {rows.map(([term, value]) => (
          <div key={term}>
            <dt>{term}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      {valid ? (
        <Badge tone="success" icon="check">
          Ready to download
        </Badge>
      ) : (
        <Badge tone="warning" icon="alert">
          Needs a change
        </Badge>
      )}
    </aside>
  );
}

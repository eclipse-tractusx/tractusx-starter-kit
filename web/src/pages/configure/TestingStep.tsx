import { testlabRoles, type Action, type Config, type Problems } from "../../model/dataspace";
import { Callout, Icon, SelectField, Switch, TextField } from "../../ui";
import styles from "./Configure.module.css";

interface Props {
  config: Config;
  problems: Problems;
  dispatch: (action: Action) => void;
}

const STAND_INS = [
  { key: "echo", label: "Echo backend", text: "A data address behind the provider's connector." },
  { key: "stubCaller", label: "Stub caller", text: "A system under test that calls back when told to." },
  { key: "submodelServer", label: "Submodel server", text: "A payload store for the registry's submodels." },
] as const;

export function TestingStep({ config, problems, dispatch }: Props) {
  const roles = testlabRoles(config);
  const connectors = config.participants.filter((participant) => participant.connector);
  const options = connectors.map((participant) => ({ value: participant.name, label: participant.name }));
  const enabled = Boolean(config.testlab.version);
  return (
    <div className={styles.stack}>
      <div className={styles.panel}>
        <h3>
          <Icon name="sparkles" size={18} /> Stand-ins
        </h3>
        <p className={styles.intro}>Small services that stand in for your product while you test.</p>
        <div className={styles.standIns}>
          {STAND_INS.map((standIn) => (
            <div key={standIn.key}>
              <Switch
                label={standIn.label}
                checked={config.standIns[standIn.key]}
                onChange={(value) => dispatch({ type: "standIn", key: standIn.key, value })}
              />
              <p className={styles.switchHint}>{standIn.text}</p>
            </div>
          ))}
        </div>
      </div>
      <div className={styles.panel}>
        <h3>
          <Icon name="shield" size={18} /> TestLab
        </h3>
        <p className={styles.intro}>
          The Eclipse Tractus-X test engine. It runs conformance test kits (TCKs) against one participant and drives another.
        </p>
        <Switch
          label="Install TestLab"
          checked={enabled}
          onChange={(on) => dispatch({ type: "testlab", patch: { version: on ? "1.0.0a24" : "" } })}
        />
        {enabled && (
          <div className={styles.participantFields}>
            <TextField
              label="Version"
              value={config.testlab.version}
              mono
              hint="tractusx-testlab on PyPI."
              onChange={(version) => dispatch({ type: "testlab", patch: { version: version.trim() || "1.0.0a24" } })}
            />
            <span />
            <SelectField
              label="System under test"
              value={roles.sut}
              options={options}
              onChange={(sut) => dispatch({ type: "testlab", patch: { sut } })}
            />
            <SelectField
              label="Driven by TestLab"
              value={roles.engine}
              options={options.filter((option) => option.value !== roles.sut)}
              onChange={(engine) => dispatch({ type: "testlab", patch: { engine } })}
            />
          </div>
        )}
      </div>
      {problems.testing.map((problem) => (
        <Callout key={problem} tone="warning">
          {problem}
        </Callout>
      ))}
    </div>
  );
}

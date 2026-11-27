import type { Action, Config, Participant, Problems } from "../../model/dataspace";
import { registries, registryById, type RegistryKind } from "../../catalog/registries";
import { Button, Callout, Icon, Segmented, Switch, TextField } from "../../ui";
import styles from "./Configure.module.css";

interface Props {
  config: Config;
  problems: Problems;
  dispatch: (action: Action) => void;
}

const MAX_PARTICIPANTS = 6;

export function ParticipantsStep({ config, problems, dispatch }: Props) {
  const canRemove = config.participants.length > 1;
  return (
    <div className={styles.stack}>
      <p className={styles.intro}>
        Every participant gets an IdentityHub wallet, its credentials from the IssuerService and an entry in the BPN
        directory. A connector lets it exchange data; a Digital Twin Registry publishes its digital twins through that
        connector.
      </p>
      <ul className={styles.participants}>
        {config.participants.map((participant, index) => (
          <ParticipantRow
            key={participant.uid}
            participant={participant}
            index={index}
            errors={problems.participants[participant.uid] ?? {}}
            canRemove={canRemove}
            chooseRegistry={config.target === "compose"}
            dispatch={dispatch}
          />
        ))}
      </ul>
      <div>
        <Button
          icon="plus"
          onClick={() => dispatch({ type: "addParticipant" })}
          disabled={config.participants.length >= MAX_PARTICIPANTS}
        >
          Add a participant
        </Button>
        {config.participants.length >= MAX_PARTICIPANTS && (
          <span className={styles.inlineHint}>Six participants is about what a laptop holds.</span>
        )}
      </div>
      {problems.dataspace.map((problem) => (
        <Callout key={problem} tone="warning">
          {problem}
        </Callout>
      ))}
      <StandIns config={config} dispatch={dispatch} />
    </div>
  );
}

interface RowProps {
  participant: Participant;
  index: number;
  errors: Partial<Record<"name" | "bpn", string>>;
  canRemove: boolean;
  dispatch: (action: Action) => void;
  chooseRegistry: boolean;
}

function ParticipantRow({ participant, index, errors, canRemove, chooseRegistry, dispatch }: RowProps) {
  const patch = (value: Partial<Omit<Participant, "uid">>) =>
    dispatch({ type: "participant", uid: participant.uid, patch: value });
  return (
    <li className={styles.participant}>
      <div className={styles.participantHead}>
        <span className={styles.avatar} aria-hidden="true">
          {participant.name.slice(0, 1).toUpperCase() || index + 1}
        </span>
        <h3>{participant.name || `Participant ${index + 1}`}</h3>
        <Button
          variant="ghost"
          size="sm"
          icon="trash"
          aria-label={`Remove ${participant.name || `participant ${index + 1}`}`}
          disabled={!canRemove}
          onClick={() => dispatch({ type: "removeParticipant", uid: participant.uid })}
        />
      </div>
      <div className={styles.participantFields}>
        <TextField
          label="Name"
          value={participant.name}
          mono
          error={errors.name}
          hint="Used in hostnames and service names."
          onChange={(name) => patch({ name: name.toLowerCase() })}
        />
        <TextField
          label="BPN"
          value={participant.bpn}
          mono
          error={errors.bpn}
          hint="Its Business Partner Number."
          onChange={(bpn) => patch({ bpn: bpn.toUpperCase() })}
        />
      </div>
      <div className={styles.switches}>
        <Switch label="Connector" checked={participant.connector} onChange={(connector) => patch({ connector })} />
        <Switch
          label="Digital Twin Registry"
          checked={participant.dtr}
          disabled={!participant.connector}
          title={participant.connector ? undefined : "A registry is published through a connector."}
          onChange={(dtr) => patch({ dtr })}
        />
      </div>
      {chooseRegistry && participant.connector && participant.dtr && (
        <Segmented<RegistryKind>
          label="Registry"
          value={participant.registry}
          options={registries.map((registry) => ({ value: registry.id, label: registry.short, title: registry.name }))}
          hint={registryById(participant.registry).description}
          onChange={(registry) => patch({ registry })}
        />
      )}
    </li>
  );
}

function StandIns({ config, dispatch }: { config: Config; dispatch: (action: Action) => void }) {
  if (config.target === "toolbox") return null;
  return (
    <div className={styles.panel}>
      <h3>
        <Icon name="database" size={18} /> Sample backend
      </h3>
      <Switch
        label="An echo backend behind the first connector, to offer as a data address"
        checked={config.standIns.echo}
        onChange={(value) => dispatch({ type: "standIn", key: "echo", value })}
      />
    </div>
  );
}

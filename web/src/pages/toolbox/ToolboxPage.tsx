import { useState } from "react";
import { toolboxAppIcon, toolboxLogo } from "../../catalog/brand";
import { TOOLBOX_INSTALLER, toolboxPin } from "../../catalog/releases";
import { href } from "../../router";
import { Callout, Card, CodeBlock, Icon, LinkButton, Section, Tabs, ThemedImage, type IconName } from "../../ui";
import styles from "./ToolboxPage.module.css";

const INSTALLER_SOURCE =
  "https://github.com/eclipse-tractusx/tractusx-starter-kit/blob/main/developer-toolbox/install.sh";
const KIT_ZIP = "https://github.com/eclipse-tractusx/tractusx-starter-kit/archive/refs/heads/main.zip";
const SOURCE = "https://github.com/eclipse-tractusx/tractusx-starter-kit/tree/main/developer-toolbox";
const REFERENCE = `${SOURCE}#configure-it`;
const E2E_TUTORIAL = "https://eclipse-tractusx.github.io/tutorial-resources/e2e-testing/";

const CONTENTS: { icon: IconName; title: string; text: string }[] = [
  {
    icon: "users",
    title: "Participants",
    text: "As many as you need, each with its own BPN, DID and IdentityHub wallet, and, as you choose, a connector and a Digital Twin Registry.",
  },
  {
    icon: "shield",
    title: "Trust services",
    text: "An IssuerService and a BPN directory (BDRS). Every participant's credentials are issued before your tests start.",
  },
  {
    icon: "database",
    title: "Stand-ins for your product",
    text: "An echo backend, a stub caller and a submodel server, so a test has something to exchange from the first run.",
  },
  {
    icon: "helm",
    title: "Your own charts",
    text: "The chart your pull request builds, deployed into the same cluster with the images built in the job.",
  },
  {
    icon: "check",
    title: "TestLab",
    text: "The Eclipse Tractus-X test engine, in the version you pin, with a variables file that names every participant's URLs.",
  },
];

const ACTION = `jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: eclipse-tractusx/tractusx-starter-kit/developer-toolbox@main
        id: toolbox
        with:
          config: ci/toolbox.yaml   # optional: without it you get the default
      - run: testlab run my.tck --config "\${{ steps.toolbox.outputs.variables-file }}"
      - if: failure() || cancelled()
        uses: eclipse-tractusx/tractusx-starter-kit/developer-toolbox/diagnostics@main
      - if: always()
        run: kind delete cluster --name "\${{ steps.toolbox.outputs.cluster-name }}" || true`;

const INSTALL = `curl -fsSL ${TOOLBOX_INSTALLER} | bash`;

const START = "tx-toolbox up --config minimal";

const LOCAL = `tx-toolbox up --config minimal   # or your own toolbox.yaml
tx-toolbox info                  # participants, URLs and API keys
tx-toolbox down                  # removes everything again`;

const CLONE = `git clone https://github.com/eclipse-tractusx/tractusx-starter-kit
cd tractusx-starter-kit
./developer-toolbox/install.sh   # tx-toolbox now runs this clone
tx-toolbox up --config minimal`;

const CONFIG = `# ci/toolbox.yaml: merged over the default, so it only holds what you change.
participants:
  - name: provider
    bpn: BPNL000000000001
    dtr: true                   # a Digital Twin Registry behind its connector
  - name: consumer
    bpn: BPNL000000000002
  - name: auditor
    bpn: BPNL0000000000CC
    connector: false            # a wallet and credentials, nothing that negotiates

applications:
  - name: my-product
    chart: ./charts/my-product  # the chart in this pull request
    images: [my-product:ci]

testlab:
  version: "${toolboxPin.testlab}"`;

const COMMANDS: [string, string][] = [
  ["tx-toolbox up [--config FILE]", "Start the dataspace. --memory 6g caps what the cluster may use."],
  ["tx-toolbox examples", "List the example configurations --config takes by name, such as minimal."],
  ["tx-toolbox info", "Show the participants, their URLs and API keys, and the variables file."],
  ["tx-toolbox status", "Show the dataspace's pods."],
  ["tx-toolbox testlab run my.tck", "Run TestLab, in the pinned version, with the variables file."],
  ["tx-toolbox kubectl …, tx-toolbox helm …", "Run kubectl or Helm against the dataspace, never your own context."],
  ["tx-toolbox hosts", "Add the dataspace hostnames to /etc/hosts; --print only prints them."],
  ["tx-toolbox render", "Only read the configuration and render the release: no cluster."],
  ["tx-toolbox down", "Delete the cluster, the /etc/hosts lines and everything the toolbox stored."],
  ["tx-toolbox update, tx-toolbox uninstall", "Install the newest toolbox, or remove the command again."],
];

const STEPS = [
  { title: "Read this guide", text: "What the toolbox starts, and where it runs." },
  { title: "Configure it", text: "Participants, registries, stand-ins and TestLab, checked as you choose." },
  { title: "Download and run", text: "A toolbox.yaml, a GitHub workflow and a script for your machine." },
];

/** Sets the flags and paths in a command's description as code. */
function withCode(text: string) {
  return text.split(/(--[a-z]+(?: 6g)?|\/etc\/hosts)/).map((part, index) => (index % 2 ? <code key={part}>{part}</code> : part));
}

/** The guide to the Eclipse Tractus-X Developer Toolbox, before its configurator. */
export function ToolboxPage() {
  const [where, setWhere] = useState("local");
  return (
    <>
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <div className={styles.heroText}>
            <span className={styles.eyebrow}>Guide</span>
            <ThemedImage
              className={styles.heroLogo}
              src={toolboxLogo}
              surface="dark"
              alt="Eclipse Tractus-X Developer Toolbox"
            />
            <ThemedImage
              className={styles.heroApp}
              src={toolboxAppIcon}
              surface="dark"
              alt="Eclipse Tractus-X Developer Toolbox"
            />
            <h1 className={styles.title}>
              A small <span className={styles.nowrap}>Eclipse Tractus-X</span> dataspace for your tests
            </h1>
            <p className={styles.lead}>
              The Developer Toolbox starts a complete dataspace in a kind cluster, from the Umbrella Helm charts: in a
              GitHub runner for every pull request, or on your machine while you develop. One YAML file decides what is
              in it.
            </p>
            <div className={styles.ctas}>
              <LinkButton variant="primary" size="lg" iconAfter="arrowRight" href={href("/configure?target=toolbox")}>
                Configure your toolbox
              </LinkButton>
              <LinkButton variant="onDark" size="lg" icon="github" href={SOURCE}>
                Source and reference
              </LinkButton>
            </div>
          </div>
        </div>
      </section>

      <Section
        eyebrow="Install"
        title="One command, from any folder"
        lead="Install tx-toolbox once. It goes into ~/.local/bin, and tx-toolbox update keeps it current."
      >
        <div className={styles.installSteps}>
          <div className={styles.installStep}>
            <span className={styles.installNumber}>1</span>
            <div className={styles.installBody}>
              <h3>Install the command</h3>
              <CodeBlock title="Terminal" language="shell" code={INSTALL} wrap />
              <div className={styles.downloads}>
                <span className={styles.downloadsLabel}>Or download it:</span>
                <LinkButton variant="secondary" icon="download" href="./install.sh" download="install.sh">
                  install.sh
                </LinkButton>
                <LinkButton variant="secondary" icon="download" href={KIT_ZIP}>
                  Starter Kit (.zip)
                </LinkButton>
                <a className={styles.textLink} href={INSTALLER_SOURCE} target="_blank" rel="noreferrer">
                  Read install.sh <Icon name="external" size={14} />
                </a>
              </div>
              <p className={styles.requirements}>
                Needs Docker and Python 3.10 or later, on macOS or Linux; on Windows, in WSL 2. Run a downloaded installer
                with <code>bash install.sh</code>.
              </p>
            </div>
          </div>
          <div className={styles.installStep}>
            <span className={styles.installNumber}>2</span>
            <div className={styles.installBody}>
              <h3>Start a dataspace</h3>
              <CodeBlock title="Terminal" language="shell" code={START} wrap />
            </div>
          </div>
        </div>
      </Section>

      <Section
        alt
        eyebrow="What you get"
        title="Everything a data exchange needs, already wired"
        lead={`Built from the Umbrella chart ${toolboxPin.umbrellaChart}, with every version pinned. The cluster lives as long as the job, or until you run tx-toolbox down.`}
      >
        <div className={styles.contents}>
          {CONTENTS.map((item) => (
            <Card key={item.title} icon={item.icon} title={item.title} compact>
              <p>{item.text}</p>
            </Card>
          ))}
        </div>
      </Section>

      <Section eyebrow="Where it runs" title="The same dataspace in CI and on your machine">
        <Tabs
          label="Where the toolbox runs"
          value={where}
          onChange={setWhere}
          items={[
            { id: "local", label: "On your machine", icon: "terminal" },
            { id: "ci", label: "In GitHub Actions", icon: "github" },
            { id: "clone", label: "From a clone", icon: "folder" },
          ]}
        >
          {where === "ci" ? (
            <div className={styles.split}>
              <div className={styles.prose}>
                <p>
                  Add the action to a job. It brings the dataspace up, installs TestLab and writes a variables file your
                  tests read. When a run fails, the diagnostics action collects the logs of every pod.
                </p>
                <p>
                  Most product teams do not call it themselves: the reusable E2E workflow in tutorial-resources calls it
                  for them.
                </p>
                <a className={styles.textLink} href={E2E_TUTORIAL} target="_blank" rel="noreferrer">
                  The E2E testing tutorial <Icon name="external" size={14} />
                </a>
              </div>
              <CodeBlock title=".github/workflows/e2e.yaml" language="yaml" code={ACTION} />
            </div>
          ) : where === "clone" ? (
            <div className={styles.split}>
              <div className={styles.prose}>
                <p>
                  To change the toolbox itself, install the command from a clone of the Starter Kit: <code>tx-toolbox</code>{" "}
                  then runs that clone, so your changes take effect at once.
                </p>
                <p>
                  Without installing anything, <code>./developer-toolbox/toolbox</code> in the clone takes the same commands.
                </p>
              </div>
              <CodeBlock title="Terminal" language="shell" code={CLONE} />
            </div>
          ) : (
            <div className={styles.split}>
              <div className={styles.prose}>
                <p>
                  With <code>tx-toolbox</code> installed (above), the dataspace is one command away, from any folder.{" "}
                  <code>--config</code> takes your own <code>toolbox.yaml</code> or the name of an
                  example. <code>tx-toolbox update</code> fetches the newest version.
                </p>
                <p>
                  You need Docker (Docker Desktop, Rancher Desktop, Colima or Docker Engine) and Python 3.10 or later, on
                  macOS or Linux; on Windows, WSL 2. kind, kubectl and Helm are downloaded once if they are missing, in the
                  pinned versions, and checked against their checksums.
                </p>
                <p>
                  <code>tx-toolbox up</code> prints every participant at the end: its DID, BPN, management API and key, DSP address and
                  registry.
                </p>
              </div>
              <CodeBlock title="Terminal" language="shell" code={LOCAL} />
            </div>
          )}
        </Tabs>
      </Section>

      <Section alt eyebrow="On your machine" title="Commands and what they change">
        <div className={styles.split}>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Command</th>
                  <th scope="col">What it does</th>
                </tr>
              </thead>
              <tbody>
                {COMMANDS.map(([command, text]) => (
                  <tr key={command}>
                    <td>
                      <code>{command}</code>
                    </td>
                    <td>{withCode(text)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className={styles.prose}>
            <h3>What it touches</h3>
            <ul className={styles.list}>
              <li>
                <strong>A kind cluster</strong> whose ingress listens on 127.0.0.1, ports 80 and 443. It is not reachable
                from your network.
              </li>
              <li>
                <strong>Its own kubeconfig</strong> in <code>~/.tractusx-developer-toolbox</code>. Your kubectl context is
                never used or changed.
              </li>
              <li>
                <strong>The dataspace hostnames</strong>, such as <code>provider.local</code>, in <code>/etc/hosts</code>,
                between two marker lines. Adding them asks for your password; <code>--no-hosts</code> skips it.
              </li>
            </ul>
            <Callout title="Keep it small">
              Two connectors without a registry run in about 2.6 GB. The default, with a registry and the stand-ins, needs
              6 GB. Count about 1.25 GB for every further connector and 1.5 GB for every further registry.
            </Callout>
          </div>
        </div>
      </Section>

      <Section
        eyebrow="Configure it"
        title="One toolbox.yaml, merged over the default"
        lead="Your file only holds the keys you change: mappings merge, lists such as participants replace the default. The configurator writes this file for you."
      >
        <div className={styles.split}>
          <CodeBlock title="ci/toolbox.yaml" language="yaml" code={CONFIG} />
          <div className={styles.prose}>
            <h3>What you can set</h3>
            <ul className={styles.list}>
              <li>
                <strong>Participants</strong>: name, BPN, DID, a connector or a wallet only, a Digital Twin Registry, extra
                claims, or an external participant that runs elsewhere.
              </li>
              <li>
                <strong>Credentials</strong>: the Catena-X types, and types of your own with their claim mappings.
              </li>
              <li>
                <strong>Applications</strong>: your Helm charts, values, images and hostnames.
              </li>
              <li>
                <strong>Versions</strong>: the Umbrella chart, the IdentityHub chart and images, the connector, TestLab.
              </li>
            </ul>
            <a className={styles.textLink} href={REFERENCE} target="_blank" rel="noreferrer">
              Every key in the reference <Icon name="external" size={14} />
            </a>
          </div>
        </div>
      </Section>

      <section className={styles.next}>
        <div className={styles.nextInner}>
          <h2>Ready? Build your toolbox.yaml</h2>
          <ol className={styles.steps}>
            {STEPS.map((step, index) => (
              <li key={step.title} aria-current={index === 1 ? "step" : undefined}>
                <span className={styles.stepNumber}>{index + 1}</span>
                <span>
                  <strong>{step.title}</strong>
                  <span className={styles.stepText}>{step.text}</span>
                </span>
              </li>
            ))}
          </ol>
          <LinkButton variant="primary" size="lg" iconAfter="arrowRight" href={href("/configure?target=toolbox")}>
            Configure your toolbox
          </LinkButton>
        </div>
      </section>
    </>
  );
}

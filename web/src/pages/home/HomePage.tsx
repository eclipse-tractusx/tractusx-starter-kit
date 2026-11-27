import { targets } from "../../catalog/targets";
import { umbrellaCategories, umbrellaComponents, type UmbrellaCategory } from "../../catalog/umbrella";
import { href } from "../../router";
import { Badge, Card, Icon, LinkButton, Section } from "../../ui";
import styles from "./HomePage.module.css";

const STEPS = [
  { icon: "sliders", title: "Choose", text: "How you want to run it: Docker Compose, the developer toolbox or the Umbrella Helm chart." },
  { icon: "users", title: "Configure", text: "Participants, connectors, registries and components. Every choice is checked as you make it." },
  { icon: "download", title: "Download and run", text: "A ZIP with the files and a README. One command starts it on your machine." },
] as const;

export function HomePage() {
  const categories = Object.entries(umbrellaCategories) as [UmbrellaCategory, (typeof umbrellaCategories)[UmbrellaCategory]][];
  return (
    <>
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <div className={styles.heroText}>
            <img
              className={styles.heroLogo}
              src="./tractusx-starter-kit_horizontal-dark.svg"
              alt="Eclipse Tractus-X Starter Kit"
            />
            <h1 className={styles.title}>
              Your own Eclipse Tractus-X dataspace, <span>ready to run</span>
            </h1>
            <p className={styles.lead}>
              Choose the Eclipse Tractus-X components you need and download a dataspace you can start on your machine: a Docker
              Compose file, the developer toolbox for your tests, or the Umbrella Helm charts as in production.
            </p>
            <div className={styles.ctas}>
              <LinkButton variant="primary" size="lg" iconAfter="arrowRight" href={href("/configure")}>
                Configure a dataspace
              </LinkButton>
              <LinkButton variant="onDark" size="lg" icon="toolbox" href={href("/configure?target=toolbox")}>
                Developer toolbox
              </LinkButton>
            </div>
          </div>
          <div className={styles.terminal} aria-hidden="true">
            <div className={styles.terminalBar}>
              <span />
              <span />
              <span />
              <em>tractusx-dataspace</em>
            </div>
            <pre>
              <span className={styles.prompt}>$</span> unzip tractusx-dataspace.zip && cd tractusx-dataspace{"\n"}
              <span className={styles.prompt}>$</span> ./up.sh{"\n"}
              <span className={styles.ok}>✔</span> issuerservice <span className={styles.dim}>Healthy</span>{"\n"}
              <span className={styles.ok}>✔</span> provider-controlplane <span className={styles.dim}>Healthy</span>{"\n"}
              <span className={styles.ok}>✔</span> consumer-controlplane <span className={styles.dim}>Healthy</span>{"\n"}
              <span className={styles.dim}>Every participant holds the credentials it asked for.</span>{"\n"}
              <span className={styles.prompt}>$</span> python3 exchange.py{"\n"}
              <span className={styles.dim}>consumer: negotiation</span> FINALIZED{"\n"}
              <span className={styles.dim}>consumer: transfer</span> STARTED{"\n"}
              <span className={styles.dim}>consumer: pulled through http://provider.local/api/public</span>
            </pre>
          </div>
        </div>
      </section>

      <Section
        eyebrow="Three ways to run it"
        title="From a first try to a production-like cluster"
        lead="All three are configured the same way, from the same Eclipse Tractus-X releases."
      >
        <div className={styles.targets}>
          {targets.map((target) => (
            <div key={target.id} className={styles.targetLink}>
              <Card
                icon={target.icon}
                eyebrow={<Badge tone="accent">{target.badge}</Badge>}
                title={target.title}
                footer={
                  <LinkButton
                    variant="primary"
                    size="lg"
                    block
                    iconAfter="arrowRight"
                    href={href(`/configure?target=${target.id}`)}
                  >
                    Configure {target.title}
                  </LinkButton>
                }
              >
                <p>{target.tagline}</p>
                <ul className={styles.points}>
                  {target.points.map((point) => (
                    <li key={point}>
                      <Icon name="check" size={16} />
                      {point}
                    </li>
                  ))}
                </ul>
                <p className={styles.runsOn}>
                  Runs on <strong>{target.runsOn}</strong>
                </p>
              </Card>
            </div>
          ))}
        </div>
      </Section>

      <Section alt eyebrow="How it works" title="Three steps, no account">
        <ol className={styles.steps}>
          {STEPS.map((step, index) => (
            <li key={step.title}>
              <span className={styles.stepNumber}>{index + 1}</span>
              <Icon name={step.icon} size={22} />
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </li>
          ))}
        </ol>
        <p className={styles.privacy}>
          <Icon name="lock" size={16} />
          Everything is generated in your browser. Nothing you enter leaves it.
        </p>
      </Section>

      <Section
        eyebrow="What you can include"
        title="The Eclipse Tractus-X components of the Umbrella chart"
        lead="Pick any of them for a Helm deployment. The Docker Compose and developer toolbox dataspaces bring the core: connectors with wallets, the IssuerService, the BPN directory and Digital Twin Registries."
      >
        <div className={styles.catalog}>
          {categories.map(([id, category]) => (
            <div key={id} className={styles.category}>
              <h3>
                <Icon name={category.icon} size={18} />
                {category.label}
              </h3>
              <ul>
                {umbrellaComponents
                  .filter((component) => component.category === id)
                  .map((component) => (
                    <li key={component.key} title={component.description}>
                      {component.name}
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      <section className={styles.closing}>
        <div className={styles.closingInner}>
          <img
            className={styles.closingLogo}
            src="./tractusx-starter-kit_horizontal-dark.svg"
            alt="Eclipse Tractus-X Starter Kit"
          />
          <h2>Start your Eclipse Tractus-X dataspace</h2>
          <p>Two participants, a data exchange and your first contract, on your machine in a few minutes.</p>
          <LinkButton variant="primary" size="lg" iconAfter="arrowRight" href={href("/configure")}>
            Configure a dataspace
          </LinkButton>
        </div>
      </section>
    </>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import { targetInfo } from "../../catalog/targets";
import { bundleFor } from "../../generators";
import { hasProblems, validate } from "../../model/dataspace";
import { toolboxAppIcon, toolboxLogo } from "../../catalog/brand";
import { href } from "../../router";
import { Button, Icon, Stepper, ThemedImage } from "../../ui";
import { ComponentsStep } from "./ComponentsStep";
import styles from "./Configure.module.css";
import { ParticipantsStep } from "./ParticipantsStep";
import { ReleaseStep } from "./ReleaseStep";
import { ReviewStep } from "./ReviewStep";
import { stepIsValid, stepsFor, type StepId } from "./steps";
import { Summary } from "./Summary";
import { TargetStep } from "./TargetStep";
import { TestingStep } from "./TestingStep";
import { useConfig } from "./useConfig";

const TITLES: Record<StepId, { title: string; lead: string }> = {
  target: { title: "Choose an output", lead: "All three start from the same Eclipse Tractus-X components. Pick how you want to run them." },
  release: { title: "Choose a release", lead: "The Umbrella chart version and the profile files come from this release." },
  components: { title: "Choose the components", lead: "Start from a profile, then switch components on or off. What a component needs comes with it." },
  participants: { title: "Set up the participants", lead: "The companies in your dataspace. Two participants with a connector can exchange data." },
  testing: { title: "Set up testing", lead: "What the toolbox deploys next to the dataspace for your tests." },
  review: { title: "Download and run", lead: "Check the files, then download them as a ZIP." },
};

export function ConfigurePage({ target }: { target?: string }) {
  const [config, dispatch] = useConfig(target);
  const steps = stepsFor(config);
  const [current, setCurrent] = useState<StepId>(target ? (steps[1]?.id ?? "target") : "target");
  const heading = useRef<HTMLHeadingElement>(null);
  const problems = useMemo(() => validate(config), [config]);
  const bundle = useMemo(() => bundleFor(config), [config]);
  const valid = !hasProblems(problems);

  const index = Math.max(0, steps.findIndex((step) => step.id === current));
  const step = steps[index];
  // A step can be opened when every step before it is valid.
  const firstInvalid = steps.findIndex((item) => !stepIsValid(item.id, problems));

  useEffect(() => {
    if (!steps.some((item) => item.id === current)) setCurrent(steps[Math.min(index, steps.length - 1)].id);
  }, [steps, current, index]);

  const go = (id: StepId) => {
    setCurrent(id);
    requestAnimationFrame(() => heading.current?.focus({ preventScroll: true }));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const next = steps[index + 1];
  const previous = steps[index - 1];
  const canContinue = stepIsValid(step.id, problems);

  return (
    <div className={styles.page}>
      <div className={styles.banner}>
        <div className={styles.bannerRow}>
          <div className={styles.bannerInner}>
            <span>Eclipse Tractus-X Starter Kit</span>
            <p>Configure your dataspace</p>
            {config.target === "toolbox" && (
              <a className={styles.bannerGuide} href={href("/toolbox")}>
                <Icon name="arrowLeft" size={14} /> Developer Toolbox guide
              </a>
            )}
          </div>
          {config.target === "toolbox" && (
            <ThemedImage
              className={styles.bannerLogo}
              src={toolboxLogo}
              surface="dark"
              alt="Eclipse Tractus-X Developer Toolbox"
            />
          )}
          {config.target === "toolbox" && (
            <ThemedImage
              className={styles.bannerApp}
              src={toolboxAppIcon}
              surface="dark"
              alt="Eclipse Tractus-X Developer Toolbox"
            />
          )}
        </div>
      </div>
      <div className={styles.layout}>
        <div className={styles.rail}>
          <Stepper
            label="Configuration steps"
            current={step.id}
            onSelect={(id) => go(id as StepId)}
            steps={steps.map((item, position) => ({
              id: item.id,
              label: item.label,
              summary: item.id === "target" ? targetInfo(config.target).title : undefined,
              disabled: firstInvalid >= 0 && position > firstInvalid,
            }))}
          />
        </div>
        <main className={styles.main} id="main">
          <header className={styles.stepHeader}>
            <span className={styles.stepCount}>
              Step {index + 1} of {steps.length}
            </span>
            <h1 ref={heading} tabIndex={-1}>
              {TITLES[step.id].title}
            </h1>
            <p>{TITLES[step.id].lead}</p>
          </header>
          {step.id === "target" && <TargetStep config={config} dispatch={dispatch} />}
          {step.id === "release" && <ReleaseStep config={config} dispatch={dispatch} />}
          {step.id === "components" && <ComponentsStep config={config} problems={problems} dispatch={dispatch} />}
          {step.id === "participants" && <ParticipantsStep config={config} problems={problems} dispatch={dispatch} />}
          {step.id === "testing" && <TestingStep config={config} problems={problems} dispatch={dispatch} />}
          {step.id === "review" && <ReviewStep bundle={bundle} disabled={!valid} />}
          <footer className={styles.stepNav}>
            {previous ? (
              <Button variant="ghost" icon="arrowLeft" onClick={() => go(previous.id)}>
                {previous.label}
              </Button>
            ) : (
              <span />
            )}
            {next && (
              <Button variant="primary" iconAfter="arrowRight" disabled={!canContinue} onClick={() => go(next.id)}>
                {next.label}
              </Button>
            )}
            {!next && (
              <Button variant="ghost" icon="sliders" onClick={() => { dispatch({ type: "reset", target: config.target }); go("target"); }}>
                Start over
              </Button>
            )}
          </footer>
        </main>
        <div className={styles.side}>
          <Summary config={config} valid={valid} />
        </div>
      </div>
    </div>
  );
}

import { href } from "../../router";
import { LinkButton, Section } from "../../ui";

export function NotFoundPage({ path }: { path: string }) {
  return (
    <Section eyebrow="404" title="There is no page here" lead={`Nothing is at ${path}. It may have moved.`}>
      <LinkButton variant="primary" icon="arrowLeft" href={href("/")}>
        Back to the start page
      </LinkButton>
    </Section>
  );
}

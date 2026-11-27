import { useMemo, useState } from "react";
import { downloadBundle, type Bundle } from "../../generators";
import { Button, CodeBlock, Tabs } from "../../ui";
import styles from "./Configure.module.css";

export function ReviewStep({ bundle, disabled }: { bundle: Bundle; disabled: boolean }) {
  const [current, setCurrent] = useState(bundle.files[0]?.path ?? "");
  const file = bundle.files.find((item) => item.path === current) ?? bundle.files[0];
  const tabs = useMemo(
    () => bundle.files.map((item) => ({ id: item.path, label: item.path, icon: "file" as const })),
    [bundle.files],
  );
  const run = [`unzip ${bundle.name}.zip && cd ${bundle.name}`, ...bundle.run].join("\n");
  return (
    <div className={styles.stack}>
      <div className={styles.downloadBar}>
        <div>
          <h3>{bundle.name}.zip</h3>
          <p>
            {bundle.files.length} files, generated in your browser.
          </p>
        </div>
        <Button variant="primary" size="lg" icon="download" disabled={disabled} onClick={() => downloadBundle(bundle)}>
          Download ZIP
        </Button>
      </div>
      <div>
        <h3 className={styles.subhead}>Run it</h3>
        <CodeBlock code={run} language="shell" />
      </div>
      <div>
        <h3 className={styles.subhead}>Files</h3>
        <Tabs items={tabs} value={file.path} onChange={setCurrent} label="Generated files">
          <p className={styles.fileSummary}>{file.summary}</p>
          <CodeBlock code={file.content} title={file.path} language={file.language} maxHeight="32rem" />
        </Tabs>
      </div>
    </div>
  );
}

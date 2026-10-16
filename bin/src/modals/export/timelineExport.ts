//src/modals/export/timelineExport.ts
// What the Export panel runs: always the export of the timeline as it is right now

type TimelineExporter = () => Promise<void>;

let current: TimelineExporter | null = null;

/** Makes `exporter` what Export runs, until the returned function is called */
export function provideTimelineExport(exporter: TimelineExporter): () => void {
  current = exporter;
  return () => {
    if (current === exporter) current = null;
  };
}

/** Exports the current timeline; does nothing while no timeline is mounted */
export function exportTimeline(): Promise<void> {
  return current ? current() : Promise.resolve();
}

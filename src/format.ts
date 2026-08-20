export type Frame = {
  name: string;
  file: string | null;
  line: number | null;
  column: number | null;
  /** Metro marks frames it wants collapsed in stack traces. */
  collapse?: boolean;
};

// Frames from React's own machinery and the RN runtime are never what you want
// to hand an agent. Other node_modules are kept: knowing the tap landed inside
// react-native-paper is useful information.
const NOISE =
  /(^|\/)node_modules\/(react|react-dom|react-native|react-test-renderer|scheduler|@react-native)\//;

export function isAppFrame(frame: Frame): boolean {
  return (
    frame.collapse !== true &&
    frame.file != null &&
    frame.file !== '' &&
    !frame.file.startsWith('[') &&
    !frame.file.includes('native code') &&
    !NOISE.test(frame.file)
  );
}

/**
 * Symbolicated component stack minus React/RN internals, leaf first.
 * Falls back to the unfiltered stack rather than returning nothing.
 */
export function appFrames(frames: Frame[]): Frame[] {
  const kept = frames.filter(isAppFrame);
  return kept.length > 0 ? kept : frames;
}

/** Drop the `http://host:8081/` prefix and `?platform=ios` tail Metro adds. */
export function shortPath(file: string): string {
  return file.replace(/^[a-z]+:\/\/[^/]+\//i, '').replace(/\?.*$/, '');
}

/** `MyButton  src/Button.tsx:23` — the line you paste into an agent prompt. */
export function formatFrame(frame: Frame): string {
  if (frame.file == null) return frame.name;
  const line = frame.line == null ? '' : `:${frame.line}`;
  return `${frame.name}  ${shortPath(frame.file)}${line}`;
}

export type Annotation = {
  hierarchy: string[];
  /** Where the element sat when annotated, for the on-screen pin. */
  frame?: {left: number; top: number; width: number; height: number};
  props: Record<string, unknown>;
  stack: Frame[];
  comment: string;
};

// Props that carry the visible text of a host view, most specific first.
const TEXT_PROPS = ['children', 'title', 'label', 'text', 'placeholder', 'accessibilityLabel'];
const PREVIEW_MAX = 40;

/** The bit of an element a human recognises it by: its text, else its image URI. */
export function previewText(props: Record<string, unknown>): string | null {
  for (const key of TEXT_PROPS) {
    const value = props[key];
    const text = typeof value === 'string'
      ? value
      : Array.isArray(value)
        ? value.filter(v => typeof v === 'string').join('')
        : null;
    if (text != null && text.trim() !== '') {
      const trimmed = text.trim();
      return trimmed.length > PREVIEW_MAX ? `${trimmed.slice(0, PREVIEW_MAX)}...` : trimmed;
    }
  }
  const uri = (props.source as {uri?: unknown} | undefined)?.uri;
  return typeof uri === 'string' ? uri : null;
}

/** Markdown the agent reads: what was tapped, where it lives, what to change. */
export function formatFeedback(
  annotations: Annotation[],
  viewport: {width: number; height: number},
): string {
  const lines = [
    '## Screen Feedback',
    `**Viewport:** ${Math.round(viewport.width)}×${Math.round(viewport.height)}`,
  ];

  annotations.forEach((annotation, i) => {
    const {hierarchy, props, stack, comment} = annotation;
    const kind = hierarchy[hierarchy.length - 1] ?? 'element';
    const preview = previewText(props);
    // The frame that declares the selected component, else the leaf's.
    const frames = appFrames(stack);
    const source = frames.find(f => f.name === kind) ?? frames[0];

    lines.push('', `### ${i + 1}. ${kind}${preview == null ? '' : `: ${JSON.stringify(preview)}`}`);
    lines.push(`**Location:** ${hierarchy.join(' › ')}`);
    if (source?.file != null) {
      lines.push(`**Source:** ${shortPath(source.file)}${source.line == null ? '' : `:${source.line}`}`);
    }
    lines.push(`**Feedback:** ${comment}`);
  });

  return lines.join('\n');
}

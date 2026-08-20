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

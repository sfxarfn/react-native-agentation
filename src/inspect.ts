import {findNodeHandle} from 'react-native';
import parseErrorStack from 'react-native/Libraries/Core/Devtools/parseErrorStack';
import symbolicateStackTrace from 'react-native/Libraries/Core/Devtools/symbolicateStackTrace';

import type {Frame} from './format';

/** One rung of the renderer's hierarchy, root first. Can re-measure itself. */
type HierarchyItem = {
  name?: string | null;
  getInspectorData: (find: typeof findNodeHandle) => {
    measure: (
      callback: (
        x: number,
        y: number,
        width: number,
        height: number,
        left: number,
        top: number,
      ) => void,
    ) => void;
    props: Record<string, unknown>;
  };
};

export type Inspection = {
  /** Screen-space box of the touched host view. */
  frame: {left: number; top: number; width: number; height: number};
  /** Props of the touched host view (View/Text/Image/...). */
  props: Record<string, unknown>;
  /** Component names, root first. */
  hierarchy: string[];
  /** Index into `hierarchy` React considers the meaningful owner. */
  selectedIndex: number | null;
  /** Symbolicated owner stack, leaf first. Empty outside Metro. */
  stack: Frame[];
  /** Backing hierarchy, so `selectAncestor` can re-measure a parent. */
  items: HierarchyItem[];
};

type Renderer = {
  rendererConfig?: {
    getInspectorDataForViewAtPoint?: (
      inspectedView: unknown,
      locationX: number,
      locationY: number,
      callback: (viewData: any) => boolean | void,
    ) => void;
  };
};

// Same entry point React Native's own dev-menu inspector uses, reached through
// the DevTools hook so we don't deep-import react-native/src/private/*, which
// is not in RN's exports map and moves between releases.
function renderers(): Renderer[] {
  const hook = (globalThis as any).__REACT_DEVTOOLS_GLOBAL_HOOK__;
  return hook?.renderers ? Array.from(hook.renderers.values()) : [];
}

export function isAvailable(): boolean {
  return renderers().some(r => r?.rendererConfig?.getInspectorDataForViewAtPoint);
}

// ponytail: fixed deadline instead of tracking every renderer's callback.
// The Paper path answers over the bridge, so this cannot be synchronous.
const HIT_TEST_TIMEOUT_MS = 500;

function hitTest(root: unknown, x: number, y: number): Promise<any | null> {
  return new Promise(resolve => {
    let settled = false;
    const done = (value: any | null) => {
      if (settled) return true;
      settled = true;
      resolve(value);
      return true;
    };

    for (const renderer of renderers()) {
      const get = renderer?.rendererConfig?.getInspectorDataForViewAtPoint;
      if (!get) continue;
      // Only one renderer owns the view, so the first non-empty answer wins.
      get(root, x, y, viewData =>
        viewData?.hierarchy?.length > 0 ? done(viewData) : settled,
      );
    }

    setTimeout(() => done(null), HIT_TEST_TIMEOUT_MS);
  });
}

async function symbolicate(componentStack: string): Promise<Frame[]> {
  const raw = parseErrorStack(componentStack);
  if (raw.length === 0) return [];

  let frames = raw;
  try {
    frames = (await symbolicateStackTrace(raw)).stack ?? raw;
  } catch {
    // No Metro (release build, or bundle loaded from disk). Bundle offsets are
    // still better than nothing.
  }

  return frames.map(frame => ({
    name: frame.methodName,
    file: frame.file,
    line: frame.lineNumber,
    column: frame.column,
    collapse: frame.collapse,
  }));
}

/**
 * Identify whatever is drawn at (x, y) inside `root`.
 *
 * @param root  Host instance of a view enclosing the point — the ref of the
 *              view wrapping your app. Coordinates are relative to it.
 */
export async function inspectAtPoint(
  root: unknown,
  x: number,
  y: number,
): Promise<Inspection | null> {
  const data = await hitTest(root, x, y);
  if (!data) return null;

  return {
    frame: data.frame ?? {left: 0, top: 0, width: 0, height: 0},
    props: data.props ?? {},
    hierarchy: (data.hierarchy ?? []).map((item: any) => item?.name ?? '?'),
    items: data.hierarchy ?? [],
    selectedIndex: data.selectedIndex ?? null,
    stack: await symbolicate(data.componentStack ?? ''),
  };
}

/**
 * Same tap, one level up: re-measure the selected element's parent.
 * Returns the inspection unchanged once there is nothing left to climb.
 */
export function selectAncestor(inspection: Inspection): Promise<Inspection> {
  const index = (inspection.selectedIndex ?? inspection.hierarchy.length - 1) - 1;
  const item = inspection.items[index];
  if (!item) return Promise.resolve(inspection);

  const {measure, props} = item.getInspectorData(findNodeHandle);
  return new Promise(resolve => {
    let settled = false;
    const done = (value: Inspection) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    measure((x, y, width, height, left, top) =>
      done({...inspection, selectedIndex: index, props, frame: {left, top, width, height}}),
    );
    // measure never calls back for a view that has since unmounted.
    setTimeout(() => done(inspection), HIT_TEST_TIMEOUT_MS);
  });
}

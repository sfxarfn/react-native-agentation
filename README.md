# react-native-agentation

Tap anything in your running app, get the component name and the **source file and line** that rendered it. Paste that into your AI coding agent instead of describing the UI.

Port of [agentation](https://github.com/benjitaylor/agentation) to React Native. The web version hands agents CSS selectors; React Native has no DOM, so this hands them `file:line` — which is what an agent actually wants anyway.

Inspector + annotations + markdown export. No MCP server.

## Install

```sh
npm install react-native-agentation -D
```

## Use

Wrap your app — unlike the web version this needs to enclose the tree, so it can hit-test it.

```tsx
import {Agentation} from 'react-native-agentation';

export default function App() {
  return (
    <Agentation>
      <YourApp />
    </Agentation>
  );
}
```

Tap `◎` bottom-right to arm it, then tap any element. Tap elsewhere to select something else; tap the selection again to climb to its parent. Type what should change, **Add** — a numbered pin drops on the element. Tap a pin to edit or delete that note. The button expands into a toolbar: **⧉** copies the markdown below to the clipboard, ready to paste into an agent (long-press to clear), **✕** disarms. Outside `__DEV__` the component renders its children and nothing else.

## What you get

Tapping an element highlights it and floats a comment box beside it — below, or above when the element sits near the bottom. Copying:

```md
## Screen Feedback
**Viewport:** 393×852

### 1. Text: "Ask me any property questions"
**Location:** App › HomeLanding › Pressable › Text
**Source:** src/screens/Home.tsx:60
**Feedback:** this one needs to be centered
```

Programmatically:

```tsx
<Agentation onInspect={i => console.log(i.stack, i.frame, i.props)}>
```

## API

| Export | |
|---|---|
| `<Agentation onInspect?>` | Overlay, comment box, toolbar. Wrap your app. |
| `inspectAtPoint(root, x, y)` | `Promise<Inspection \| null>`. `root` is a host instance enclosing the point; coordinates are relative to it. |
| `isAvailable()` | Whether a renderer exposing inspector data is attached. |
| `selectAncestor(inspection)` | `Promise<Inspection>` re-measured one level up the hierarchy. |
| `formatFeedback(annotations, viewport)` | The markdown above, if you want to build your own UI. |
| `appFrames`, `formatFrame`, `shortPath`, `previewText` | Stack filtering/formatting helpers. |

## How it works

React's renderer already computes this for the dev-menu element inspector. We call it through `__REACT_DEVTOOLS_GLOBAL_HOOK__` rather than deep-importing `react-native/src/private/*`, which isn't in RN's exports map and moves between releases.

The renderer returns a `componentStack` pointing at bundle offsets. Those go to Metro's `/symbolicate` endpoint, which maps them back to real source files and lines.

So: dev builds with Metro attached. Without Metro you still get component names and bundle offsets.

Requires React Native 0.72+.

## Test

```sh
npm test
```

# react-native-agentation

Tap anything in your running app, get the component name and the **source file and line** that rendered it. Paste that into your AI coding agent instead of describing the UI.

Port of [agentation](https://github.com/benjitaylor/agentation) to React Native. The web version hands agents CSS selectors; React Native has no DOM, so this hands them `file:line` — which is what an agent actually wants anyway.

Currently just the inspector. No annotations, no markdown export, no MCP server.

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

Tap `◎` bottom-right to arm it, then tap any element. Outside `__DEV__` the component renders its children and nothing else.

## What you get

```
LoginScreen › View › Card › Pressable › Text
Text        src/components/Card.tsx:41
Card        src/screens/Login.tsx:88
LoginScreen src/screens/Login.tsx:12
```

Programmatically:

```tsx
<Agentation onInspect={i => console.log(i.stack, i.frame, i.props)}>
```

## API

| Export | |
|---|---|
| `<Agentation onInspect?>` | Overlay + toggle. Wrap your app. |
| `inspectAtPoint(root, x, y)` | `Promise<Inspection \| null>`. `root` is a host instance enclosing the point; coordinates are relative to it. |
| `isAvailable()` | Whether a renderer exposing inspector data is attached. |
| `appFrames`, `formatFrame`, `shortPath` | Stack filtering/formatting helpers. |

## How it works

React's renderer already computes this for the dev-menu element inspector. We call it through `__REACT_DEVTOOLS_GLOBAL_HOOK__` rather than deep-importing `react-native/src/private/*`, which isn't in RN's exports map and moves between releases.

The renderer returns a `componentStack` pointing at bundle offsets. Those go to Metro's `/symbolicate` endpoint, which maps them back to real source files and lines.

So: dev builds with Metro attached. Without Metro you still get component names and bundle offsets.

Requires React Native 0.72+.

## Test

```sh
npm test
```

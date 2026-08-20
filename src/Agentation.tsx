import * as React from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';

import {appFrames, formatFrame} from './format';
import {inspectAtPoint, type Inspection} from './inspect';

export type AgentationProps = {
  children?: React.ReactNode;
  /** Called on every successful tap, for wiring up your own output. */
  onInspect?: (inspection: Inspection) => void;
};

function AgentationDev({children, onInspect}: AgentationProps): React.ReactElement {
  const rootRef = React.useRef<View | null>(null);
  const [active, setActive] = React.useState(false);
  const [hit, setHit] = React.useState<Inspection | null>(null);

  const onTap = (x: number, y: number) => {
    inspectAtPoint(rootRef.current, x, y).then(inspection => {
      if (!inspection) return;
      setHit(inspection);
      onInspect?.(inspection);
    });
  };

  const frames = hit ? appFrames(hit.stack) : [];

  return (
    <View style={styles.root}>
      {/* collapsable={false} keeps this view in the native tree so it can be hit-tested. */}
      <View ref={rootRef} style={styles.root} collapsable={false}>
        {children}
      </View>

      {active && (
        <View
          style={StyleSheet.absoluteFill}
          onStartShouldSetResponder={() => true}
          onResponderRelease={event => {
            const {locationX, locationY} = event.nativeEvent;
            onTap(locationX, locationY);
          }}
        />
      )}

      {active && hit && hit.frame.width > 0 && (
        <View
          pointerEvents="none"
          style={[
            styles.highlight,
            {
              left: hit.frame.left,
              top: hit.frame.top,
              width: hit.frame.width,
              height: hit.frame.height,
            },
          ]}
        />
      )}

      {active && hit && (
        <View style={styles.panel}>
          <Text style={styles.breadcrumb} numberOfLines={2}>
            {hit.hierarchy.join(' › ')}
          </Text>
          <ScrollView style={styles.frames}>
            {frames.length === 0 ? (
              <Text style={styles.dim}>
                No source frames. Run a dev build with Metro attached.
              </Text>
            ) : (
              frames.map((frame, i) => (
                <Text key={i} style={i === 0 ? styles.frameTop : styles.frame}>
                  {formatFrame(frame)}
                </Text>
              ))
            )}
          </ScrollView>
        </View>
      )}

      <Pressable
        style={[styles.toggle, active && styles.toggleActive]}
        onPress={() => {
          setActive(!active);
          setHit(null);
        }}>
        <Text style={styles.toggleText}>{active ? '✕' : '◎'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1},
  highlight: {
    position: 'absolute',
    backgroundColor: 'rgba(100, 160, 255, 0.25)',
    borderWidth: 1,
    borderColor: 'rgb(100, 160, 255)',
  },
  panel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: 220,
    padding: 12,
    paddingBottom: 32,
    backgroundColor: 'rgba(17, 17, 17, 0.95)',
  },
  breadcrumb: {color: '#888', fontSize: 11, marginBottom: 6},
  frames: {flexGrow: 0},
  frame: {color: '#bbb', fontSize: 12, fontFamily: 'Menlo', marginBottom: 2},
  frameTop: {color: '#fff', fontSize: 12, fontFamily: 'Menlo', marginBottom: 2},
  dim: {color: '#888', fontSize: 12},
  toggle: {
    position: 'absolute',
    right: 16,
    bottom: 48,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(17, 17, 17, 0.9)',
  },
  toggleActive: {backgroundColor: 'rgb(100, 160, 255)'},
  toggleText: {color: '#fff', fontSize: 18},
});

function PassThrough({children}: AgentationProps): React.ReactElement {
  return <>{children}</>;
}

/** Wrap your app. Renders children untouched outside `__DEV__`. */
export const Agentation: React.ComponentType<AgentationProps> = __DEV__
  ? AgentationDev
  : PassThrough;

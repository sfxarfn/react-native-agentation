import * as React from 'react';
import {
  Animated,
  Image,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type ViewStyle,
} from 'react-native';
// Deep import: `react-native`'s barrel logs a deprecation warning for Clipboard,
// and the community module is not worth a dependency for one setString call.
import Clipboard from 'react-native/Libraries/Components/Clipboard/Clipboard';

import {formatFeedback, previewText, type Annotation} from './format';
import {inspectAtPoint, selectAncestor, type Inspection} from './inspect';

export type AgentationProps = {
  children?: React.ReactNode;
  /** Called on every successful tap, for wiring up your own output. */
  onInspect?: (inspection: Inspection) => void;
};

function AgentationDev({children, onInspect}: AgentationProps): React.ReactElement {
  const rootRef = React.useRef<React.ComponentRef<typeof View> | null>(null);
  const [active, setActive] = React.useState(false);
  const [hit, setHit] = React.useState<Inspection | null>(null);
  const [comment, setComment] = React.useState('');
  const [annotations, setAnnotations] = React.useState<Annotation[]>([]);
  const [copied, setCopied] = React.useState(false);
  const [keyboard, setKeyboard] = React.useState(0);
  const [expanded, setExpanded] = React.useState(false);
  const [editing, setEditing] = React.useState<number | null>(null);
  const grow = React.useRef(new Animated.Value(0)).current;
  const [height, setHeight] = React.useState(BUBBLE_HEIGHT);
  const window = useWindowDimensions();

  React.useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', e => setKeyboard(e.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboard(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  // Tapping the selection again climbs to its parent; tapping anywhere else
  // picks that element instead. The comment survives a climb — same intent,
  // bigger target — but not a jump to an unrelated element.
  React.useEffect(() => {
    Animated.timing(grow, {
      toValue: annotations.length > 0 ? 1 : 0,
      duration: 180,
      // Width is not a native-driver prop.
      useNativeDriver: false,
    }).start();
  }, [annotations.length, grow]);

  const onTap = (x: number, y: number) => {
    if (hit && inside(hit.frame, x, y)) {
      selectAncestor(hit).then(setHit);
      return;
    }
    inspectAtPoint(rootRef.current, x, y).then(inspection => {
      if (!inspection) return;
      setHit(inspection);
      setEditing(null);
      setComment('');
      onInspect?.(inspection);
    });
  };

  // Reopen a saved annotation: its own frame, props and stack stand in for a
  // fresh hit, so the bubble needs no second code path. `items` is empty, so
  // climbing to a parent is off until it is re-tapped on screen.
  const edit = (index: number) => {
    const annotation = annotations[index];
    if (!annotation?.frame) return;
    setEditing(index);
    setComment(annotation.comment);
    setHit({
      frame: annotation.frame,
      props: annotation.props,
      hierarchy: annotation.hierarchy,
      selectedIndex: annotation.hierarchy.length - 1,
      stack: annotation.stack,
      items: [],
    });
  };

  const close = () => {
    setHit(null);
    setEditing(null);
    setComment('');
  };

  const remove = () => {
    if (editing == null) return;
    setAnnotations(annotations.filter((_, i) => i !== editing));
    setCopied(false);
    close();
  };

  const save = () => {
    if (!hit || comment.trim() === '') return;
    const annotation = {
      hierarchy: hit.hierarchy.slice(0, (hit.selectedIndex ?? hit.hierarchy.length - 1) + 1),
      frame: hit.frame,
      props: hit.props,
      stack: hit.stack,
      comment: comment.trim(),
    };
    setAnnotations(
      editing == null
        ? [...annotations, annotation]
        : annotations.map((existing, i) => (i === editing ? annotation : existing)),
    );
    setCopied(false);
    close();
  };

  const copy = () => {
    if (annotations.length === 0) return;
    Clipboard.setString(formatFeedback(annotations, window));
    setCopied(true);
  };

  // Sit under the element, or over it when the element is too close to the
  // bottom — the keyboard, once up, is part of "the bottom".
  const bubble = hit && {
    top:
      hit.frame.top + hit.frame.height + GAP + height <= window.height - keyboard - GAP
        ? hit.frame.top + hit.frame.height + GAP
        : Math.max(GAP, hit.frame.top - GAP - height),
    left: Math.min(
      Math.max(GAP, hit.frame.left),
      Math.max(GAP, window.width - GAP - Math.min(BUBBLE_WIDTH, window.width - GAP * 2)),
    ),
    width: Math.min(BUBBLE_WIDTH, window.width - GAP * 2),
  };

  const label = hit
    ? `${hit.hierarchy[hit.selectedIndex ?? hit.hierarchy.length - 1] ?? 'element'}${
        previewText(hit.props) == null ? '' : `: ${JSON.stringify(previewText(hit.props))}`
      }`
    : '';
  const style = Object.entries(StyleSheet.flatten(hit?.props.style as ViewStyle) ?? {});

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

      {active &&
        annotations.map(
          (annotation, i) =>
            annotation.frame && (
              <Pressable
                key={i}
                onPress={() => edit(i)}
                style={[
                  styles.pin,
                  {
                    left: annotation.frame.left + annotation.frame.width / 2 - PIN / 2,
                    top: annotation.frame.top + annotation.frame.height / 2 - PIN / 2,
                  },
                ]}>
                <Text style={styles.pinText}>{i + 1}</Text>
              </Pressable>
            ),
        )}

      {active && hit && bubble && (
        <View
          style={[styles.bubble, bubble]}
          onLayout={event => setHeight(event.nativeEvent.layout.height)}>
          <Pressable style={styles.header} onPress={() => setExpanded(!expanded)}>
            <Text style={styles.chevron}>{expanded ? '⌄' : '›'}</Text>
            <Text style={styles.headerText} numberOfLines={1}>
              {label}
            </Text>
          </Pressable>

          {expanded && (
            <ScrollView style={styles.code} contentContainerStyle={styles.codeInner}>
              {style.length === 0 ? (
                <Text style={styles.dim}>No style props.</Text>
              ) : (
                style.map(([key, value]) => (
                  <Text key={key} style={styles.codeLine}>
                    <Text style={styles.codeKey}>{key}</Text>
                    {`: ${String(value)};`}
                  </Text>
                ))
              )}
            </ScrollView>
          )}

          <TextInput
            style={styles.input}
            value={comment}
            onChangeText={setComment}
            placeholder="What should change?"
            placeholderTextColor="#777"
            autoFocus
            multiline
            onSubmitEditing={save}
          />
          <View style={styles.buttons}>
            {editing != null && (
              <Pressable style={styles.delete} onPress={remove}>
                <Image source={require('./icons/trash.png')} style={styles.icon} />
              </Pressable>
            )}
            <Pressable style={styles.cancel} onPress={close}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.save} onPress={save}>
              <Text style={styles.saveText}>{editing == null ? 'Add' : 'Save'}</Text>
            </Pressable>
          </View>
        </View>
      )}

      {active ? (
        <View style={styles.bar}>
          {/* Copy only exists once there is feedback to copy; the bar widens
              into it. Room here for the rest of the toolbar later. */}
          <Animated.View
            style={[
              styles.grow,
              {opacity: grow, width: grow.interpolate({inputRange: [0, 1], outputRange: [0, COPY_WIDTH]})},
            ]}>
            <Pressable
              style={styles.tool}
              onPress={copy}
              onLongPress={() => {
                setAnnotations([]);
                setCopied(false);
              }}>
              {copied ? (
                <Text style={styles.toolText}>✓</Text>
              ) : (
                <Image source={require('./icons/copy.png')} style={styles.icon} />
              )}
              <Text style={styles.count}>{annotations.length}</Text>
            </Pressable>
            <View style={styles.divider} />
          </Animated.View>
          <Pressable
            style={styles.tool}
            onPress={() => {
              setActive(false);
              close();
            }}>
            <Text style={styles.toolText}>✕</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable style={styles.toggle} onPress={() => setActive(true)}>
          <Image source={require('./icons/logo.png')} style={styles.icon} />
        </Pressable>
      )}
    </View>
  );
}

function inside(
  frame: {left: number; top: number; width: number; height: number},
  x: number,
  y: number,
): boolean {
  return (
    x >= frame.left &&
    x <= frame.left + frame.width &&
    y >= frame.top &&
    y <= frame.top + frame.height
  );
}

const PIN = 28;
const COPY_WIDTH = 53; // 44pt button + 1pt divider + its 8pt of margin
const GAP = 8;
const BUBBLE_WIDTH = 340;
const BUBBLE_HEIGHT = 132;

const styles = StyleSheet.create({
  root: {flex: 1},
  highlight: {
    position: 'absolute',
    backgroundColor: 'rgba(100, 160, 255, 0.25)',
    borderWidth: 1,
    borderColor: 'rgb(100, 160, 255)',
  },
  bubble: {
    position: 'absolute',
    padding: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(28, 28, 30, 0.98)',
  },
  header: {flexDirection: 'row', alignItems: 'center', marginBottom: 10},
  chevron: {color: '#8e8e93', fontSize: 15, width: 18},
  headerText: {flex: 1, color: '#d1d1d6', fontSize: 14},
  code: {maxHeight: 180, borderRadius: 10, backgroundColor: '#2c2c2e'},
  codeInner: {padding: 12},
  codeLine: {color: '#e5e5ea', fontSize: 12, fontFamily: 'Menlo', lineHeight: 18},
  codeKey: {color: '#c586c0'},
  dim: {color: '#8e8e93', fontSize: 12},
  buttons: {flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginTop: 12},
  delete: {marginRight: 'auto', width: 40, height: 40, alignItems: 'center', justifyContent: 'center'},
  input: {
    minHeight: 60,
    maxHeight: 120,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#3a3a3c',
    color: '#fff',
    fontSize: 14,
  },
  save: {
    marginLeft: 8,
    paddingHorizontal: 22,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgb(37, 99, 235)',
  },
  saveText: {color: '#fff', fontSize: 15, fontWeight: '600'},
  cancel: {paddingHorizontal: 14, height: 40, alignItems: 'center', justifyContent: 'center'},
  cancelText: {color: '#d1d1d6', fontSize: 15},
  pin: {
    position: 'absolute',
    width: PIN,
    height: PIN,
    borderRadius: PIN / 2,
    borderBottomLeftRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgb(20, 120, 255)',
  },
  pinText: {color: '#fff', fontSize: 13, fontWeight: '700'},
  bar: {
    position: 'absolute',
    right: 16,
    bottom: 48,
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    paddingHorizontal: 6,
    borderRadius: 28,
    backgroundColor: 'rgba(24, 24, 24, 0.98)',
  },
  grow: {flexDirection: 'row', alignItems: 'center', overflow: 'hidden'},
  tool: {alignItems: 'center', justifyContent: 'center', width: 44, height: 44},
  toolText: {color: '#e5e5ea', fontSize: 18},
  icon: {width: 22, height: 22},
  count: {position: 'absolute', top: 6, right: 4, color: '#8e8e93', fontSize: 11},
  divider: {width: 1, height: 20, marginHorizontal: 4, backgroundColor: '#3a3a3c'},
  // Same height as the expanded bar, so arming it does not shift the row.
  toggle: {
    position: 'absolute',
    right: 16,
    bottom: 48,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(24, 24, 24, 0.98)',
  },
});

function PassThrough({children}: AgentationProps): React.ReactElement {
  return <>{children}</>;
}

/** Wrap your app. Renders children untouched outside `__DEV__`. */
export const Agentation: React.ComponentType<AgentationProps> = __DEV__
  ? AgentationDev
  : PassThrough;

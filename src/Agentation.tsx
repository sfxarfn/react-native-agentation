import * as React from 'react';
import {
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
// Deep import: `react-native`'s barrel logs a deprecation warning for Clipboard,
// and the community module is not worth a dependency for one setString call.
import Clipboard from 'react-native/Libraries/Components/Clipboard/Clipboard';

import {formatFeedback, type Annotation} from './format';
import {inspectAtPoint, type Inspection} from './inspect';

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
  const window = useWindowDimensions();

  React.useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', e => setKeyboard(e.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboard(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const onTap = (x: number, y: number) => {
    inspectAtPoint(rootRef.current, x, y).then(inspection => {
      if (!inspection) return;
      setHit(inspection);
      setComment('');
      onInspect?.(inspection);
    });
  };

  const save = () => {
    if (!hit || comment.trim() === '') return;
    setAnnotations([
      ...annotations,
      {hierarchy: hit.hierarchy, props: hit.props, stack: hit.stack, comment: comment.trim()},
    ]);
    setHit(null);
    setComment('');
    setCopied(false);
  };

  const copy = () => {
    Clipboard.setString(formatFeedback(annotations, window));
    setCopied(true);
  };

  // Sit under the element, or over it when the element is too close to the
  // bottom — the keyboard, once up, is part of "the bottom".
  const bubble = hit && {
    top:
      hit.frame.top + hit.frame.height + GAP + BUBBLE_HEIGHT <= window.height - keyboard - GAP
        ? hit.frame.top + hit.frame.height + GAP
        : Math.max(GAP, hit.frame.top - GAP - BUBBLE_HEIGHT),
    left: Math.min(
      Math.max(GAP, hit.frame.left),
      Math.max(GAP, window.width - GAP - Math.min(BUBBLE_WIDTH, window.width - GAP * 2)),
    ),
    width: Math.min(BUBBLE_WIDTH, window.width - GAP * 2),
  };

  return (
    <View style={styles.root}>
      {/* collapsable={false} keeps this view in the native tree so it can be hit-tested. */}
      <View ref={rootRef} style={styles.root} collapsable={false}>
        {children}
      </View>

      {active && !hit && (
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

      {active && hit && bubble && (
        <View style={[styles.bubble, bubble]}>
          <TextInput
            style={styles.input}
            value={comment}
            onChangeText={setComment}
            placeholder="What should change here?"
            placeholderTextColor="#777"
            autoFocus
            multiline
            onSubmitEditing={save}
          />
          <Pressable style={styles.save} onPress={save}>
            <Text style={styles.saveText}>Save</Text>
          </Pressable>
          <Pressable style={styles.cancel} onPress={() => setHit(null)}>
            <Text style={styles.dim}>✕</Text>
          </Pressable>
        </View>
      )}

      <View style={styles.fabs}>
        {active && annotations.length > 0 && (
          <>
            <Pressable style={styles.action} onPress={copy}>
              <Text style={styles.actionText}>
                {copied ? '✓ Copied' : `⧉ Copy feedback (${annotations.length})`}
              </Text>
            </Pressable>
            <Pressable
              style={styles.action}
              onPress={() => {
                setAnnotations([]);
                setCopied(false);
              }}>
              <Text style={styles.actionText}>Clear</Text>
            </Pressable>
          </>
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
    </View>
  );
}

const GAP = 8;
const BUBBLE_WIDTH = 340;
const BUBBLE_HEIGHT = 54;

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
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(17, 17, 17, 0.95)',
  },
  dim: {color: '#888', fontSize: 12},
  input: {
    flex: 1,
    minHeight: 38,
    maxHeight: 90,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    color: '#fff',
    fontSize: 13,
    backgroundColor: '#222',
  },
  save: {
    marginLeft: 8,
    paddingHorizontal: 14,
    height: 38,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgb(100, 160, 255)',
  },
  saveText: {color: '#000', fontSize: 13, fontWeight: '600'},
  cancel: {marginLeft: 4, width: 30, height: 38, alignItems: 'center', justifyContent: 'center'},
  fabs: {position: 'absolute', right: 16, bottom: 48, alignItems: 'flex-end'},
  action: {
    marginBottom: 8,
    paddingHorizontal: 12,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    backgroundColor: 'rgba(17, 17, 17, 0.9)',
  },
  actionText: {color: '#fff', fontSize: 13},
  toggle: {
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

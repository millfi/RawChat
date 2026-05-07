/**
 * Hover tooltip for Windows.
 *
 * Wraps a child element. After `delay` ms of continuous hover, shows a
 * small floating label anchored above (or below) the child. Hides
 * immediately on hover-out or press.
 *
 * `delay` defaults to 700 ms — the WCAG 2.1 / Microsoft Fluent guidance
 * sits in the 500–1000 ms range for non-essential hover hints; 700 ms
 * is a balance between responsiveness and not flashing tooltips when
 * the cursor is just passing through.
 */

import React, {ReactNode, useCallback, useEffect, useRef, useState} from 'react';
import {LayoutChangeEvent, StyleSheet, Text, View} from 'react-native';
import {useColors} from '../hooks/useColors';

interface Props {
  text: string;
  /** ms before the tooltip appears (default 700). */
  delay?: number;
  /** "top" | "bottom" — where the tooltip is anchored relative to the child. */
  position?: 'top' | 'bottom';
  children: ReactNode;
}

export function Tooltip({text, delay = 700, position = 'top', children}: Props) {
  const C = useColors();
  const [visible, setVisible] = useState(false);
  const [size, setSize] = useState({w: 0, h: 0});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  };

  useEffect(() => () => clearTimer(), []);

  const handleHoverIn = useCallback(() => {
    clearTimer();
    timer.current = setTimeout(() => setVisible(true), delay);
  }, [delay]);

  const handleHoverOut = useCallback(() => {
    clearTimer();
    setVisible(false);
  }, []);

  const onLayout = (e: LayoutChangeEvent) => {
    const {width, height} = e.nativeEvent.layout;
    if (width !== size.w || height !== size.h) {
      setSize({w: width, h: height});
    }
  };

  // Delegate hover events to the child via cloning.
  const child = React.Children.only(children) as React.ReactElement<any>;
  const enhanced = React.cloneElement(child, {
    onHoverIn: (e: any) => {
      handleHoverIn();
      child.props.onHoverIn?.(e);
    },
    onHoverOut: (e: any) => {
      handleHoverOut();
      child.props.onHoverOut?.(e);
    },
    onPressIn: (e: any) => {
      handleHoverOut();
      child.props.onPressIn?.(e);
    },
  });

  return (
    <View style={styles.wrapper} onLayout={onLayout}>
      {enhanced}
      {visible && size.w > 0 && (
        <View
          pointerEvents="none"
          style={[
            styles.tooltip,
            position === 'top' ? styles.tooltipTop : styles.tooltipBottom,
            {
              backgroundColor: C.tooltipBg,
              borderColor: C.divider,
            },
          ]}>
          <Text style={[styles.tooltipText, {color: C.tooltipText}]}>
            {text}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
  },
  tooltip: {
    position: 'absolute',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    maxWidth: 240,
    // Drop shadow for separation from the chat surface.
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 6,
    shadowOffset: {width: 0, height: 2},
    elevation: 4,
  },
  tooltipTop: {
    bottom: '100%',
    right: 0,
    marginBottom: 6,
  },
  tooltipBottom: {
    top: '100%',
    right: 0,
    marginTop: 6,
  },
  tooltipText: {
    fontSize: 12,
    lineHeight: 16,
  },
});

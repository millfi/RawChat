/**
 * Lightweight model dropdown for the chat header.
 *
 * Tapping the chip toggles a small pop-over list anchored beneath it.
 * Selecting a model fires `onChange` and closes the menu. We avoid the
 * platform's native Picker because it doesn't blend with the acrylic
 * header on Windows.
 */

import React, {useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {ModelId, MODELS} from '../api/deepseek';
import {useColors} from '../hooks/useColors';

interface Props {
  value: ModelId;
  onChange: (id: ModelId) => void;
  disabled?: boolean;
}

export function ModelPicker({value, onChange, disabled}: Props) {
  const C = useColors();
  const [open, setOpen] = useState(false);

  const current = MODELS.find(m => m.id === value) ?? MODELS[0];

  return (
    <View style={styles.wrapper}>
      <Pressable
        style={({pressed, hovered}: any) => [
          styles.chip,
          {
            backgroundColor: pressed
              ? C.accentPressed
              : hovered
                ? C.cardBg
                : 'transparent',
            borderColor: C.divider,
            opacity: disabled ? 0.5 : 1,
          },
        ]}
        onPress={() => !disabled && setOpen(o => !o)}
        disabled={disabled}>
        <Text style={[styles.chipText, {color: C.textPrimary}]}>
          {current.label}
        </Text>
        <Text style={[styles.caret, {color: C.textSecondary}]}>
          {open ? '▲' : '▼'}
        </Text>
      </Pressable>

      {open && (
        <>
          {/* Backdrop closes the menu when clicking elsewhere. */}
          <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
          <View
            style={[
              styles.menu,
              {backgroundColor: C.cardBg, borderColor: C.divider},
            ]}>
            {MODELS.map(m => {
              const selected = m.id === value;
              return (
                <Pressable
                  key={m.id}
                  style={({hovered}: any) => [
                    styles.menuItem,
                    {
                      backgroundColor: selected
                        ? C.accent
                        : hovered
                          ? C.assistantBubbleBg
                          : 'transparent',
                    },
                  ]}
                  onPress={() => {
                    onChange(m.id);
                    setOpen(false);
                  }}>
                  <Text
                    style={[
                      styles.menuLabel,
                      {color: selected ? '#FFFFFF' : C.textPrimary},
                    ]}>
                    {m.label}
                  </Text>
                  <Text
                    style={[
                      styles.menuDesc,
                      {
                        color: selected
                          ? 'rgba(255,255,255,0.85)'
                          : C.textSecondary,
                      },
                    ]}>
                    {m.description}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
    zIndex: 10,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  caret: {
    fontSize: 9,
  },
  backdrop: {
    position: 'absolute',
    top: -10000,
    left: -10000,
    right: -10000,
    bottom: -10000,
    zIndex: 5,
  },
  menu: {
    position: 'absolute',
    top: '100%',
    left: 0,
    marginTop: 6,
    minWidth: 180,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    padding: 4,
    gap: 2,
    zIndex: 20,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: {width: 0, height: 4},
    elevation: 6,
  },
  menuItem: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 4,
  },
  menuLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  menuDesc: {
    fontSize: 11,
    marginTop: 2,
  },
});

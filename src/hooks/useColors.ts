/**
 * Central color hook for RawChat.
 *
 * PlatformColor resolves Windows system brushes for ACRYLIC effects only.
 * All semantic colors (text, borders, cards) use explicit values so they
 * stay readable regardless of how WinUI 3 resolves theme resources.
 */

import {Platform, PlatformColor, useColorScheme} from 'react-native';

export interface AppColors {
  // Text
  textPrimary: string;
  textSecondary: string;
  textOnAccent: string;

  // Structural backgrounds (acrylic on Windows)
  rootBg: any;
  headerBg: any;
  inputBarBg: any;

  // Semantic surfaces
  cardBg: string;
  inputBg: string;
  inputBorder: string;
  divider: string;

  // Accent / interactive
  accent: string;
  accentPressed: string;
  success: string;

  // Chat bubbles
  userBubbleBg: string;
  userBubbleText: string;
  assistantBubbleBg: string;
  assistantBubbleText: string;
  avatarBg: string;

  // Status
  errorBg: string;
  errorText: string;
  warningBg: string;
  warningText: string;

  // Tooltip / popover
  tooltipBg: string;
  tooltipText: string;
}

export function useColors(): AppColors {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';

  // Acrylic backgrounds — keep PlatformColor only here
  const rootBg =
    Platform.OS === 'windows'
      ? (PlatformColor('SystemControlAcrylicWindowBrush') as any)
      : isDark
        ? '#1A1A1A'
        : '#F2F2F2';

  const headerBg =
    Platform.OS === 'windows'
      ? (PlatformColor('SystemControlChromeMediumAcrylicWindowBrush') as any)
      : isDark
        ? '#2A2A2A'
        : '#E5E5E5';

  const inputBarBg = headerBg;

  return {
    // Text — explicit values, never PlatformColor
    textPrimary: isDark ? '#FFFFFF' : '#000000',
    textSecondary: isDark ? '#AAAAAA' : '#555555',
    textOnAccent: '#FFFFFF',

    // Backgrounds
    rootBg,
    headerBg,
    inputBarBg,

    // Surfaces
    cardBg: isDark ? '#2C2C2C' : '#F5F5F5',
    inputBg: isDark ? '#1A1A1A' : '#FFFFFF',
    inputBorder: isDark ? '#555555' : '#CCCCCC',
    divider: isDark ? '#3A3A3A' : '#DDDDDD',

    // Accent (Windows blue)
    accent: '#0078D4',
    accentPressed: '#106EBE',
    success: '#107C10',

    // Bubbles
    userBubbleBg: '#0078D4',
    userBubbleText: '#FFFFFF',
    assistantBubbleBg: isDark ? '#3A3A3A' : '#E8E8E8',
    assistantBubbleText: isDark ? '#FFFFFF' : '#1A1A1A',
    avatarBg: isDark ? '#4A4A4A' : '#CCCCCC',

    // Status
    errorBg: isDark ? '#5C1010' : '#FFF0F0',
    errorText: isDark ? '#FFAAAA' : '#CC0000',
    warningBg: '#7A4500',
    warningText: '#FFD080',

    // Tooltip
    tooltipBg: isDark ? '#2C2C2C' : '#1F1F1F',
    tooltipText: '#FFFFFF',
  };
}

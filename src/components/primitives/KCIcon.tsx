import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import Svg, { Path, Circle, Line, Rect } from 'react-native-svg';
import { useTheme } from '@theme/index';

export const ICON_NAMES = [
  'dashboard', 'agenda', 'patients', 'consult', 'tele', 'rx', 'luna',
  'settings', 'search', 'bell', 'plus', 'more', 'arrowR', 'chevR',
  'check', 'alert', 'edit', 'download', 'print', 'paw', 'mic', 'cam',
  'hangup', 'share', 'filter', 'back', 'close',
] as const;

export type KCIconName = typeof ICON_NAMES[number];

export interface KCIconProps {
  name: KCIconName;
  size?: number;
  strokeWidth?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
}

type IconRenderer = (color: string, strokeWidth: number) => React.ReactNode;

const ICON_PATHS: Record<KCIconName, IconRenderer> = {
  dashboard: (c, sw) => (
    <Path d="M3 3h7v7H3zm11 0h7v7h-7zM3 14h7v7H3zm11 0h7v7h-7z" stroke={c} strokeWidth={sw} />
  ),
  agenda: (c, sw) => (
    <Path
      d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"
      stroke={c}
      strokeWidth={sw}
    />
  ),
  patients: (c, sw) => (
    <>
      <Path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke={c} strokeWidth={sw} />
      <Circle cx={9} cy={7} r={4} stroke={c} strokeWidth={sw} />
    </>
  ),
  consult: (c, sw) => (
    <>
      <Circle cx={12} cy={18} r={4} stroke={c} strokeWidth={sw} />
      <Path d="M12 14v-4M8 10V4M16 10V4M8 4h8" stroke={c} strokeWidth={sw} />
    </>
  ),
  tele: (c, sw) => (
    <>
      <Path
        d="M15 10l4.55-2.07A1 1 0 0 1 21 8.9v6.2a1 1 0 0 1-1.45.89L15 14v-4z"
        stroke={c}
        strokeWidth={sw}
      />
      <Rect x={2} y={8} width={13} height={8} rx={2} stroke={c} strokeWidth={sw} />
    </>
  ),
  rx: (c, sw) => (
    <Path
      d="M6 3h6a3 3 0 0 1 0 6H6V3M9 9l4.5 8M15 15l4 5M19 15l-4 5"
      stroke={c}
      strokeWidth={sw}
    />
  ),
  luna: (c, sw) => (
    <>
      <Path
        d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
        stroke={c}
        strokeWidth={sw}
      />
      <Path
        d="M20 3l.5 1.5 1.5.5-1.5.5L20 7l-.5-1.5L18 5l1.5-.5z"
        stroke={c}
        strokeWidth={sw}
      />
    </>
  ),
  settings: (c, sw) => (
    <>
      <Circle cx={12} cy={12} r={3} stroke={c} strokeWidth={sw} />
      <Path
        d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"
        stroke={c}
        strokeWidth={sw}
      />
    </>
  ),
  search: (c, sw) => (
    <>
      <Circle cx={11} cy={11} r={8} stroke={c} strokeWidth={sw} />
      <Line x1={21} y1={21} x2={16.65} y2={16.65} stroke={c} strokeWidth={sw} />
    </>
  ),
  bell: (c, sw) => (
    <Path
      d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0"
      stroke={c}
      strokeWidth={sw}
    />
  ),
  plus: (c, sw) => (
    <Path d="M12 5v14M5 12h14" stroke={c} strokeWidth={sw} />
  ),
  more: (c, sw) => (
    <>
      <Circle cx={12} cy={12} r={1} stroke={c} strokeWidth={sw} />
      <Circle cx={6} cy={12} r={1} stroke={c} strokeWidth={sw} />
      <Circle cx={18} cy={12} r={1} stroke={c} strokeWidth={sw} />
    </>
  ),
  arrowR: (c, sw) => (
    <Path d="M5 12h14M12 5l7 7-7 7" stroke={c} strokeWidth={sw} />
  ),
  chevR: (c, sw) => (
    <Path d="M9 18l6-6-6-6" stroke={c} strokeWidth={sw} />
  ),
  check: (c, sw) => (
    <Path d="M20 6L9 17l-5-5" stroke={c} strokeWidth={sw} />
  ),
  alert: (c, sw) => (
    <>
      <Path
        d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
        stroke={c}
        strokeWidth={sw}
      />
      <Line x1={12} y1={9} x2={12} y2={13} stroke={c} strokeWidth={sw} />
      <Line x1={12} y1={17} x2={12.01} y2={17} stroke={c} strokeWidth={sw} />
    </>
  ),
  edit: (c, sw) => (
    <Path
      d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"
      stroke={c}
      strokeWidth={sw}
    />
  ),
  download: (c, sw) => (
    <Path
      d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"
      stroke={c}
      strokeWidth={sw}
    />
  ),
  print: (c, sw) => (
    <Path
      d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z"
      stroke={c}
      strokeWidth={sw}
    />
  ),
  paw: (c, sw) => (
    <>
      <Circle cx={7} cy={7} r={1.5} stroke={c} strokeWidth={sw} />
      <Circle cx={17} cy={7} r={1.5} stroke={c} strokeWidth={sw} />
      <Circle cx={5} cy={12} r={1.5} stroke={c} strokeWidth={sw} />
      <Circle cx={19} cy={12} r={1.5} stroke={c} strokeWidth={sw} />
      <Path
        d="M12 11c-2.2 0-4 1.8-4 4v1c0 2.2 1.8 4 4 4s4-1.8 4-4v-1c0-2.2-1.8-4-4-4z"
        stroke={c}
        strokeWidth={sw}
      />
    </>
  ),
  mic: (c, sw) => (
    <Path
      d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3zM19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8"
      stroke={c}
      strokeWidth={sw}
    />
  ),
  cam: (c, sw) => (
    <>
      <Path
        d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"
        stroke={c}
        strokeWidth={sw}
      />
      <Circle cx={12} cy={13} r={4} stroke={c} strokeWidth={sw} />
    </>
  ),
  hangup: (c, sw) => (
    <Path
      d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"
      stroke={c}
      strokeWidth={sw}
    />
  ),
  share: (c, sw) => (
    <Path
      d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13"
      stroke={c}
      strokeWidth={sw}
    />
  ),
  filter: (c, sw) => (
    <Path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" stroke={c} strokeWidth={sw} />
  ),
  back: (c, sw) => (
    <Path d="M19 12H5M12 19l-7-7 7-7" stroke={c} strokeWidth={sw} />
  ),
  close: (c, sw) => (
    <Path d="M18 6L6 18M6 6l12 12" stroke={c} strokeWidth={sw} />
  ),
};

export function KCIcon({ name, size = 18, strokeWidth = 1.7, color, style }: KCIconProps) {
  const { colors } = useTheme();
  const iconColor = color ?? colors.text;
  const renderer = ICON_PATHS[name];

  if (!renderer) {
    if (__DEV__) console.warn(`KCIcon: unknown icon name "${name}"`);
    return null;
  }

  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
    >
      {renderer(iconColor, strokeWidth)}
    </Svg>
  );
}

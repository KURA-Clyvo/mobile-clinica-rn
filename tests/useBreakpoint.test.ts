import { renderHook } from '@testing-library/react-native';
import { breakpoints } from '../src/theme/tokens';
import { useBreakpoint } from '../src/hooks/useBreakpoint';

// Mesma técnica do ScreenContainer.test.tsx: mockar o módulo interno que
// useWindowDimensions() usa de verdade, não 'react-native' inteiro (que
// tem getters lazy que quebram ao serem todos avaliados de uma vez — ver
// comentário em tests/ScreenContainer.test.tsx).
const mockUseWindowDimensions = jest.fn(() => ({ width: 400, height: 800, scale: 1, fontScale: 1 }));
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => mockUseWindowDimensions(),
}));

function setViewport(width: number, height: number) {
  mockUseWindowDimensions.mockReturnValue({ width, height, scale: 1, fontScale: 1 });
}

describe('useBreakpoint', () => {
  const CASES: {
    label: string;
    width: number;
    height: number;
    expectedBreakpoint: 'sm' | 'md' | 'lg' | 'xl';
    atLeast: ('sm' | 'md' | 'lg' | 'xl')[];
    below: ('sm' | 'md' | 'lg' | 'xl')[];
  }[] = [
    {
      label: '360×640 (mobile)',
      width: 360,
      height: 640,
      expectedBreakpoint: 'sm',
      atLeast: ['sm'],
      below: ['md', 'lg', 'xl'],
    },
    {
      label: '768×1024 (tablet)',
      width: 768,
      height: 1024,
      expectedBreakpoint: 'md',
      atLeast: ['sm', 'md'],
      below: ['lg', 'xl'],
    },
    {
      label: '1440×900 (desktop)',
      width: 1440,
      height: 900,
      expectedBreakpoint: 'xl',
      atLeast: ['sm', 'md', 'lg', 'xl'],
      below: [],
    },
  ];

  it.each(CASES)(
    'resolves breakpoint=$expectedBreakpoint at $label',
    ({ width, height, expectedBreakpoint, atLeast, below }) => {
      setViewport(width, height);
      const { result } = renderHook(() => useBreakpoint());

      expect(result.current.width).toBe(width);
      expect(result.current.height).toBe(height);
      expect(result.current.breakpoint).toBe(expectedBreakpoint);

      for (const key of atLeast) {
        expect(result.current.isAtLeast(key)).toBe(true);
      }
      for (const key of below) {
        expect(result.current.isAtLeast(key)).toBe(false);
      }
    },
  );

  it('resolves the boundary exactly at the breakpoint width (md=768 is md, not sm)', () => {
    setViewport(breakpoints.md, 1024);
    const { result } = renderHook(() => useBreakpoint());
    expect(result.current.breakpoint).toBe('md');
    expect(result.current.isAtLeast('md')).toBe(true);

    setViewport(breakpoints.md - 1, 1024);
    const { result: below } = renderHook(() => useBreakpoint());
    expect(below.current.breakpoint).toBe('sm');
    expect(below.current.isAtLeast('md')).toBe(false);
  });
});

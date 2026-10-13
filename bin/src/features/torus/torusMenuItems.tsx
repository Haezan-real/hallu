//src/features/torus/torusMenuItems.tsx
import type { ReactNode } from 'react';
import { Scissors, ChevronLeft, ChevronRight, Move } from 'lucide-react';

export interface MenuItem {
  label: string;
  icon: ReactNode;
  action: () => void;
  color?: string;
}

export interface TorusEditActions {
  onSplit: () => void;
  onTrimLatter: (ripple: boolean) => void;
  onTrimFormer: (ripple: boolean) => void;
  onStep: (dir: number, ripple: boolean) => void;
  onRoll: () => void;
}

export function insideItems(a: TorusEditActions): MenuItem[] {
  return [
    { label: 'Split', icon: <Scissors size={14} />, action: a.onSplit, color: '#60a5fa' },
    { label: 'Trim', icon: <ChevronRight size={14} />, action: () => a.onTrimLatter(false), color: '#34d399' },
    { label: 'Trim', icon: <ChevronLeft size={14} />, action: () => a.onTrimFormer(false), color: '#34d399' },
    { label: 'Ripple', icon: <ChevronRight size={14} />, action: () => a.onTrimLatter(true), color: '#fbbf24' },
    { label: 'Ripple', icon: <ChevronLeft size={14} />, action: () => a.onTrimFormer(true), color: '#fbbf24' },
    { label: 'Roll', icon: <Move size={14} />, action: a.onRoll, color: '#f472b6' },
  ];
}

export function edgeItems(a: TorusEditActions): MenuItem[] {
  return [
    { label: '+1f', icon: <ChevronRight size={14} />, action: () => a.onStep(1, false), color: '#60a5fa' },
    { label: '-1f', icon: <ChevronLeft size={14} />, action: () => a.onStep(-1, false), color: '#60a5fa' },
    { label: 'Ripple +1f', icon: <ChevronRight size={14} />, action: () => a.onStep(1, true), color: '#fbbf24' },
    { label: 'Ripple -1f', icon: <ChevronLeft size={14} />, action: () => a.onStep(-1, true), color: '#fbbf24' },
  ];
}

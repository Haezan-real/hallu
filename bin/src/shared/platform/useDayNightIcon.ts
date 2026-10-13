import { useEffect, useState } from 'react';
import dayIcon from '@assets/icons/app/hallu_day.png';
import nightIcon from '@assets/icons/app/hallu_night.png';
import { renderRoundedIcon } from './appIcon';

const DAY_START_HOUR = 7;
const NIGHT_START_HOUR = 19;
const CHECK_INTERVAL_MS = 60 * 1000;
const FAVICON_SIZE_PX = 64;

export function isNightTime(date: Date = new Date()): boolean {
  const hour = date.getHours();
  return hour >= NIGHT_START_HOUR || hour < DAY_START_HOUR;
}

// Returns the header icon for the current time of day and keeps the page
// favicon in sync. Re-checks every minute so it flips at 7am/7pm.
export function useDayNightIcon(): string {
  const [night, setNight] = useState(() => isNightTime());

  useEffect(() => {
    const id = window.setInterval(() => setNight(isNightTime()), CHECK_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!link) return;
    let cancelled = false;
    renderRoundedIcon(night ? nightIcon : dayIcon, FAVICON_SIZE_PX)
      .then(url => {
        if (cancelled) return;
        link.type = 'image/png';
        link.href = url;
      })
      .catch(error => console.warn('Could not update favicon:', error));
    return () => { cancelled = true; };
  }, [night]);

  return night ? nightIcon : dayIcon;
}

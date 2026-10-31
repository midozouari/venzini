// View state (SDD 5.2.3): the delivery day chosen in the top bar.
import { create } from 'zustand';
import { addDays, tomorrow } from '@/lib/format';

const initialDay = import.meta.env.VITE_DEFAULT_DELIVERY_DAY || tomorrow();

interface DayState {
  day: string;
  setDay: (day: string) => void;
  shift: (days: number) => void;
}

export const useDayStore = create<DayState>((set) => ({
  day: initialDay,
  setDay: (day) => set({ day }),
  shift: (days) => set((s) => ({ day: addDays(s.day, days) })),
}));

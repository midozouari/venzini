// View state of the hidden developer toolbar (MVP builds only, SDD 7.1): whether it is open, and
// a short note shown in the top bar while a scenario or a forced error is active.
import { create } from 'zustand';

interface DevState {
  open: boolean;
  note: string | null;
  setOpen: (open: boolean) => void;
  setNote: (note: string | null) => void;
}

export const useDevStore = create<DevState>((set) => ({
  open: false,
  note: null,
  setOpen: (open) => set({ open }),
  setNote: (note) => set({ note }),
}));

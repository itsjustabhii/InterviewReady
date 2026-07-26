import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export interface BookingState {
  selectedInterviewerId: string | null;
  selectedDate: string | null;
  selectedSlot: string | null;
  selectedPlan: string | null;
}

const bookingSlice = createSlice({
  name: 'booking',
  initialState: {
    selectedInterviewerId: null,
    selectedDate: null,
    selectedSlot: null,
    selectedPlan: null,
  } as BookingState,
  reducers: {
    selectInterviewer(state, action: PayloadAction<string>) {
      state.selectedInterviewerId = action.payload;
    },
    selectDate(state, action: PayloadAction<string>) {
      state.selectedDate = action.payload;
      state.selectedSlot = null;
    },
    selectSlot(state, action: PayloadAction<string>) {
      state.selectedSlot = action.payload;
    },
    selectPlan(state, action: PayloadAction<string>) {
      state.selectedPlan = action.payload;
    },
    clearBooking(state) {
      state.selectedInterviewerId = null;
      state.selectedDate = null;
      state.selectedSlot = null;
      state.selectedPlan = null;
    },
  },
});

export const { selectInterviewer, selectDate, selectSlot, selectPlan, clearBooking } =
  bookingSlice.actions;
export default bookingSlice.reducer;

import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

/**
 * Auth slice.
 *
 * Persists { user, token, refreshToken, isAuthenticated } to localStorage
 * under the key 'auth'.  The access token is short-lived (15 min); the
 * refresh token is rotated on every refresh call.
 *
 * NOTE: The User shape here matches AuthUser from types/index.ts, which
 * mirrors the backend response.  Legacy consumers that read `user.name`
 * should use `user.fullName` instead.
 */
export interface User {
  id: string;        // mapped from _id
  _id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  name: string;      // alias: `${firstName} ${lastName}` — kept for legacy UI
  email: string;
  avatar?: string | null;
  role: 'user' | 'interviewer' | 'admin';
  plan?: 'free' | 'pro' | 'enterprise';
}

interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
}

function loadFromStorage(): AuthState {
  try {
    const saved = localStorage.getItem('auth');
    if (saved) {
      const parsed = JSON.parse(saved) as AuthState;
      // Guard against stale storage missing new fields
      if (parsed.token && parsed.user) return parsed;
    }
  } catch {
    // ignore malformed storage
  }
  return { user: null, token: null, refreshToken: null, isAuthenticated: false };
}

function persist(state: AuthState) {
  localStorage.setItem('auth', JSON.stringify(state));
}

const authSlice = createSlice({
  name: 'auth',
  initialState: loadFromStorage(),
  reducers: {
    setCredentials(
      state,
      action: PayloadAction<{ user: User; token: string; refreshToken?: string }>,
    ) {
      state.user = action.payload.user;
      state.token = action.payload.token;
      state.refreshToken = action.payload.refreshToken ?? state.refreshToken;
      state.isAuthenticated = true;
      persist(state);
    },

    logout(state) {
      state.user = null;
      state.token = null;
      state.refreshToken = null;
      state.isAuthenticated = false;
      localStorage.removeItem('auth');
    },

    updateUser(state, action: PayloadAction<Partial<User>>) {
      if (state.user) {
        state.user = { ...state.user, ...action.payload };
        // keep name alias in sync
        if (action.payload.firstName || action.payload.lastName) {
          state.user.name = `${state.user.firstName} ${state.user.lastName}`;
        }
        persist(state);
      }
    },
  },
});

export const { setCredentials, logout, updateUser } = authSlice.actions;
export default authSlice.reducer;

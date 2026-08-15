import axios from 'axios';
import { store } from '../store';
import { logout, setCredentials } from '../store/slices/authSlice';

/**
 * Axios instance.
 *
 * baseURL: '/api' — works with the Vite dev proxy (→ http://localhost:5000/api)
 * and in production when the frontend is served from the same origin as the API.
 *
 * Token storage: the Redux auth slice persists { user, token, refreshToken, isAuthenticated }
 * to localStorage under the key 'auth'.
 */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// ── Request interceptor — attach access token ──────────────────────────────
api.interceptors.request.use((config) => {
  const state = store.getState().auth;
  if (state.token) {
    config.headers.Authorization = `Bearer ${state.token}`;
  }
  return config;
});

// ── Response interceptor — handle 401 with token refresh ──────────────────
let isRefreshing = false;
let pendingQueue: Array<{ resolve: (token: string) => void; reject: (err: unknown) => void }> = [];

function processQueue(error: unknown, token: string | null) {
  pendingQueue.forEach((p) => {
    if (error) p.reject(error);
    else p.resolve(token!);
  });
  pendingQueue = [];
}

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const originalRequest = err.config;

    if (err.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // Queue this request until the refresh completes
        return new Promise((resolve, reject) => {
          pendingQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const saved = localStorage.getItem('auth');
      const refreshToken = saved ? JSON.parse(saved).refreshToken : null;

      if (refreshToken) {
        try {
          const { data } = await axios.post(
            `${api.defaults.baseURL}/v1/auth/refresh-token`,
            { refreshToken },
          );
          const newAccessToken: string = data.data.tokens.accessToken;
          const newRefreshToken: string = data.data.tokens.refreshToken;

          // Update Redux + localStorage
          const currentAuth = store.getState().auth;
          store.dispatch(
            setCredentials({
              user: currentAuth.user!,
              token: newAccessToken,
              refreshToken: newRefreshToken,
            }),
          );

          processQueue(null, newAccessToken);
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          return api(originalRequest);
        } catch (refreshErr) {
          processQueue(refreshErr, null);
          store.dispatch(logout());
          window.location.href = '/login';
          return Promise.reject(refreshErr);
        } finally {
          isRefreshing = false;
        }
      } else {
        store.dispatch(logout());
        window.location.href = '/login';
      }
    }

    return Promise.reject(err);
  },
);

export default api;

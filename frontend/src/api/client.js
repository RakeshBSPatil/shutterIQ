import axios from 'axios';

const API_BASE_URL =
  import.meta.env.VITE_API_URL?.replace(/\/+$/, '') || 'http://localhost:4000/api';

const TOKEN_STORAGE_KEY = 'shuttleiq_token';

let unauthorizedHandler = null;

export function setUnauthorizedHandler(fn) {
  unauthorizedHandler = fn;
}

export function getStoredToken() {
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setStoredToken(token) {
  if (token) {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  }
}

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20000,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  const token = getStoredToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const reqUrl = error?.config?.url || '';
    const isAuthAttempt =
      reqUrl.includes('/auth/login') || reqUrl.includes('/auth/register');

    if (status === 401 && !isAuthAttempt) {
      setStoredToken(null);
      if (typeof unauthorizedHandler === 'function') {
        unauthorizedHandler();
      }
    }
    return Promise.reject(error);
  }
);

export function extractErrorMessage(err, fallback = 'Something went wrong') {
  const data = err?.response?.data;
  if (data?.details?.length) {
    return `${data.error}: ${data.details.map((d) => d.message).join(', ')}`;
  }
  return data?.error || err?.message || fallback;
}

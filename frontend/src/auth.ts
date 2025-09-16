import { api } from './api';

export function getToken() {
  return localStorage.getItem('token') || '';
}

export function setToken(token: string) {
  localStorage.setItem('token', token);
}

export function clearAuth() {
  localStorage.removeItem('token');
}

export async function ensureAuth(email: string, password: string) {
  try {
    const { token } = await api.login(email, password);
    setToken(token);
    return token;
  } catch (e: any) {
    const { token } = await api.signup(email, password);
    setToken(token);
    return token;
  }
}


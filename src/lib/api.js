import axios from 'axios';

const baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export const api = axios.create({ baseURL });

export function authHeaders(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

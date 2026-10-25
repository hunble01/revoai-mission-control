export const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
export const API_TOKEN = process.env.NEXT_PUBLIC_ADMIN_TOKEN || 'change-me';

export const apiHeaders: Record<string, string> = {
  'Content-Type': 'application/json',
  'x-actor-role': 'admin',
  'x-admin-token': API_TOKEN,
};

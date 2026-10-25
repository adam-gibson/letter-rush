// Chooses the data store: localStorage when signed out, Supabase when signed in.
import { LocalStore } from './local-store.js';
import { getSupabase } from '../auth.js';

export { LocalStore };

export async function createStore(user) {
  if (!user) return new LocalStore();
  const { SupabaseStore } = await import('./supabase-store.js');
  return new SupabaseStore(await getSupabase(), user);
}

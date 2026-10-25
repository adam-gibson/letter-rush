// Authentication wrapper. Everything is a no-op until js/config.js is filled in,
// and the Supabase library is only downloaded when it is actually needed.
import { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_JS_URL } from './config.js';

export const enabled = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

let clientPromise = null;

export function getSupabase() {
  if (!enabled) return Promise.resolve(null);
  clientPromise ??= import(SUPABASE_JS_URL).then(({ createClient }) =>
    createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, detectSessionInUrl: true },
    }));
  return clientPromise;
}

/** Send a magic sign-in link. The user returns to this page signed in. */
export async function signInWithEmail(email) {
  const sb = await getSupabase();
  const { error } = await sb.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: location.origin + location.pathname },
  });
  if (error) throw error;
}

export async function signOut() {
  const sb = await getSupabase();
  await sb?.auth.signOut();
}

/** Calls back with the user (or null) now and whenever sign-in state changes. */
export async function onAuthChange(callback) {
  const sb = await getSupabase();
  if (!sb) {
    callback(null);
    return () => {};
  }
  const { data } = sb.auth.onAuthStateChange((_event, session) => {
    // Defer so the callback may safely make further Supabase calls.
    setTimeout(() => callback(session?.user ?? null), 0);
  });
  return () => data.subscription.unsubscribe();
}

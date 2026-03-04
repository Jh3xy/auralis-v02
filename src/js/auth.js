// auth.js — Supabase Auth Module
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error(
    '[auth] Missing Supabase env vars. ' +
    'Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your frontend .env file.'
  );
}

// Initialize Supabase client for frontend use (only if env vars are present) - prevents hard app crash
export const supabase = SUPABASE_URL && SUPABASE_ANON_KEY
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;


/**
 * Sign up a new user.
 * @param {string} email
 * @param {string} password
 * @param {string} displayName  Stored in user_metadata.display_name
 * @returns {{ data, error }}
 */
export async function signUp(email, password, displayName) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: window.location.origin,
      data: { display_name: displayName }
    }
  });
  return { data, error };
}

/**
 * Sign in an existing user.
 * @param {string} email
 * @param {string} password
 * @returns {{ data, error }}
 */
export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });
  return { data, error };
}

/**
 * Sign out the current user.
 */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  return { error };
}

/**
 * Sign in as an anonymous (guest) user.
 * Returns a real Supabase session with no email or password.
 * @returns {{ data, error }}
 */
export async function signInAnonymously() {
  const { data, error } = await supabase.auth.signInAnonymously();
  return { data, error };
}

/**
 * Get the current active session (includes JWT access_token).
 * @returns {Promise<Session|null>}
 */
export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data?.session ?? null;
}

/**
 * Get the current authenticated user.
 * @returns {Promise<User|null>}
 */
export async function getUser() {
  const { data } = await supabase.auth.getUser();
  return data?.user ?? null;
}

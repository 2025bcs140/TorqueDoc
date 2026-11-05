import AsyncStorage from '@react-native-async-storage/async-storage';

const SESSION_KEY = 'torquedoc.session.v1';

/**
 * AsyncStorage uses localStorage on web and the native store on Android/iOS.
 * Only the opaque session token is stored; the password is never persisted.
 */
export async function loadStoredSession(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

export async function saveStoredSession(token: string): Promise<void> {
  try {
    await AsyncStorage.setItem(SESSION_KEY, token);
  } catch {
    // A storage failure should not prevent a valid in-memory session.
  }
}

export async function clearStoredSession(): Promise<void> {
  try {
    await AsyncStorage.removeItem(SESSION_KEY);
  } catch {
    // Nothing else to clear.
  }
}

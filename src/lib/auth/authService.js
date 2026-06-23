import * as SecureStore from 'expo-secure-store';

const AUTH_URL = process.env.EXPO_PUBLIC_AUTH_URL ?? 'http://localhost:5001';
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:5167';
const CLIENT_ID = 'qabr-mobile';
const SCOPES = 'openid email profile qabr-api offline_access';

function toForm(params) {
  return Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
}

async function postToken(params) {
  const res = await fetch(`${AUTH_URL}/connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: toForm({ ...params, client_id: CLIENT_ID }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error_description ?? err.error ?? "Erreur d'authentification.");
  }
  return res.json();
}

function parseJwtPayload(token) {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return {};
    let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    b64 += '='.repeat((4 - b64.length % 4) % 4);
    const binary = atob(b64);
    const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return {};
  }
}

function buildUser(claims) {
  const roleRaw = claims.role;
  const role = Array.isArray(roleRaw)
    ? roleRaw[0] ?? null
    : roleRaw ?? null;
  return {
    id: claims.sub,
    email: claims.email,
    name: claims.name ?? claims.email ?? '',
    prenom: claims.prenom ?? '',
    nom: claims.nom ?? '',
    role,
  };
}

async function saveTokens(data) {
  await SecureStore.setItemAsync('access_token', data.access_token);
  if (data.refresh_token) {
    await SecureStore.setItemAsync('refresh_token', data.refresh_token);
  }
}

async function saveUserData(user, apiUser) {
  try {
    await SecureStore.setItemAsync('user_data', JSON.stringify(user));
    if (apiUser) await SecureStore.setItemAsync('api_user_data', JSON.stringify(apiUser));
  } catch {}
}

export async function loadPersistedAuth() {
  try {
    const [userJson, apiUserJson, token] = await Promise.all([
      SecureStore.getItemAsync('user_data'),
      SecureStore.getItemAsync('api_user_data'),
      SecureStore.getItemAsync('access_token'),
    ]);
    if (!userJson || !token) return null;
    return {
      user: JSON.parse(userJson),
      apiUser: apiUserJson ? JSON.parse(apiUserJson) : null,
      token,
    };
  } catch {
    return null;
  }
}

async function getOrCreateApiProfile(identityUserId, user, token, telephone = '', language = 'fr') {
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  try {
    const res = await fetch(`${API_URL}/api/utilisateur/identity/${identityUserId}`, { headers });
    if (res.ok) return res.json();
  } catch {}
  try {
    const res = await fetch(`${API_URL}/api/utilisateur`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ identityUserId, prenom: user.prenom || '', nom: user.nom || '', email: user.email || '', telephone, language }),
    });
    if (res.ok || res.status === 201) return res.json();
  } catch {}
  return null;
}

async function loginAndBuildResult(data, telephone = '', language = 'fr') {
  await saveTokens(data);
  const user = buildUser(parseJwtPayload(data.access_token));
  const apiUser = await getOrCreateApiProfile(user.id, user, data.access_token, telephone, language).catch(() => null);
  await saveUserData(user, apiUser);
  return { accessToken: data.access_token, refreshToken: data.refresh_token, user, apiUser };
}

export async function loginWithPassword(email, password) {
  const data = await postToken({ grant_type: 'password', username: email, password, scope: SCOPES });
  return loginAndBuildResult(data);
}

export async function loginWithGoogle(accessToken) {
  const data = await postToken({ grant_type: 'urn:ietf:params:oauth:grant-type:google', access_token: accessToken, scope: SCOPES });
  return loginAndBuildResult(data);
}

export async function loginWithApple(identityToken) {
  const data = await postToken({ grant_type: 'urn:ietf:params:oauth:grant-type:apple', id_token: identityToken, scope: SCOPES });
  return loginAndBuildResult(data);
}

export async function refreshAccessToken() {
  const storedRefreshToken = await SecureStore.getItemAsync('refresh_token');
  if (!storedRefreshToken) throw new Error('No refresh token stored.');
  const data = await postToken({ grant_type: 'refresh_token', refresh_token: storedRefreshToken });
  return loginAndBuildResult(data);
}

export async function register(prenom, nom, email, password, telephone = '', language = 'fr') {
  const res = await fetch(`${AUTH_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prenom, nom, email, password, language }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.errors?.[0] ?? err.message ?? "Erreur lors de la création du compte.");
  }
  const data = await postToken({ grant_type: 'password', username: email, password, scope: SCOPES });
  return loginAndBuildResult(data, telephone, language);
}

export async function logout() {
  await Promise.all([
    SecureStore.deleteItemAsync('access_token'),
    SecureStore.deleteItemAsync('refresh_token'),
    SecureStore.deleteItemAsync('user_data'),
    SecureStore.deleteItemAsync('api_user_data'),
  ].map(p => p.catch(() => {})));
}

export async function forgotPassword(email) {
  const res = await fetch(`${AUTH_URL}/api/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? 'Erreur lors de la demande.');
  }
}

export async function resetPassword(email, code, newPassword) {
  const res = await fetch(`${AUTH_URL}/api/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code, newPassword }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? 'Erreur lors de la réinitialisation.');
  }
}

export async function deleteAccount() {
  const token = await SecureStore.getItemAsync('access_token');
  if (token) {
    const res = await fetch(`${AUTH_URL}/api/auth/account`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok && res.status !== 404 && res.status !== 204) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error ?? `Erreur suppression compte (${res.status})`);
    }
  }
  await SecureStore.deleteItemAsync('access_token').catch(() => {});
  await SecureStore.deleteItemAsync('refresh_token').catch(() => {});
}

export async function changePassword(email, currentPassword, newPassword) {
  const res = await fetch(`${AUTH_URL}/api/auth/change-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, currentPassword, newPassword }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? 'Erreur lors du changement de mot de passe.');
  }
}

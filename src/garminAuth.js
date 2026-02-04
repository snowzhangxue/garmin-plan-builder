const { GarminConnect } = require("@gooin/garmin-connect");
const {
  initSessionStore,
  getSession,
  saveSession,
  deleteSession,
  listSessionKeys
} = require("./garminSession");

function buildSigninPayload({ username, password } = {}) {
  const params = new URLSearchParams();
  if (username != null) params.set("username", username);
  if (password != null) params.set("password", password);
  return params.toString();
}

function sessionKeyForUser(username) {
  return `user:${username}`;
}

function usernameFromSessionKey(key) {
  if (!key?.startsWith("user:")) return null;
  return key.slice("user:".length);
}

async function validateSessionForUser({ username } = {}) {
  if (!username) return null;

  const client = new GarminConnect({ username, password: "" });
  const db = await initSessionStore();
  const sessionKey = sessionKeyForUser(username);
  const existingSession = await getSession(db, sessionKey);

  if (!existingSession?.oauth1 || !existingSession?.oauth2) {
    return null;
  }

  try {
    await client.loadToken(existingSession.oauth1, existingSession.oauth2);
    // Triggers refresh; if it fails, token is effectively unusable.
    const userProfile = await client.getUserProfile();
    if (!userProfile?.userName) {
      throw new Error("Unable to read user profile");
    }

    // Persist refreshed tokens if the library rotated them.
    try {
      const exported = client.exportToken();
      if (exported?.oauth1 && exported?.oauth2) {
        await saveSession(db, sessionKey, exported);
      }
    } catch (error) {
      // Non-fatal.
    }

    return {
      client,
      userProfile
    };
  } catch (error) {
    // Common failure: "No OAuth2 token available".
    console.warn("Cached Garmin session is invalid; clearing.", {
      message: error.message
    });
    await deleteSession(db, sessionKey);
    return null;
  }
}

async function loginGarmin({ username, password } = {}) {
  if (!username || !password) {
    throw new Error("Username and password are required to login.");
  }

  const client = new GarminConnect({ username, password });
  const sessionKey = sessionKeyForUser(username);
  const db = await initSessionStore();

  await client.login();
  await saveSession(db, sessionKey, client.exportToken());

  const userProfile = await client.getUserProfile();
  if (!userProfile?.userName) {
    throw new Error("Garmin login failed. Unable to read user profile.");
  }

  return {
    client,
    userProfile
  };
}

async function listValidUsers() {
  const db = await initSessionStore();
  const keys = await listSessionKeys(db);

  const usernames = [];
  for (const key of keys) {
    const username = usernameFromSessionKey(key);
    if (!username) continue;
    const valid = await validateSessionForUser({ username });
    if (valid) usernames.push(username);
  }

  return usernames;
}

module.exports = {
  buildSigninPayload,
  loginGarmin,
  validateSessionForUser,
  listValidUsers
};

const { GarminConnect } = require("@gooin/garmin-connect");
const {
  initSessionStore,
  getSession,
  saveSession,
  deleteSession
} = require("./garminSession");

async function loginGarmin({ username, password } = {}) {
  if (!username || !password) {
    throw new Error("Username and password are required to login.");
  }

  const client = new GarminConnect({ username, password });
  const sessionKey = `user:${username}`;
  const db = await initSessionStore();

  const existingSession = await getSession(db, sessionKey);
  if (!existingSession) {
    await client.login();
    await saveSession(db, sessionKey, client.exportToken());
  } else {
    try {
      await client.loadToken(existingSession.oauth1, existingSession.oauth2);
    } catch (error) {
      console.warn("Cached Garmin session is invalid; clearing and relogging.");
      await deleteSession(db, sessionKey);
      await client.login(username, password);
      await saveSession(db, sessionKey, client.exportToken());
    }
  }

  let userProfile;
  try {
    userProfile = await client.getUserProfile();
  } catch (error) {
    console.warn(
      "Garmin token refresh failed; clearing cached session and retrying login."
    );
    await deleteSession(db, sessionKey);
    await client.login(username, password);
    await saveSession(db, sessionKey, client.exportToken());
    userProfile = await client.getUserProfile();
  }
  if (!userProfile?.userName) {
    throw new Error("Garmin login failed. Unable to read user profile.");
  }

  return {
    client,
    userProfile
  };
}

module.exports = {
  loginGarmin
};

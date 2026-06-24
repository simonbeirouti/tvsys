export const extractBearerToken = (value) => {
    const header = Array.isArray(value) ? value[0] : value;
    if (!header)
        return undefined;
    const match = header.match(/^Bearer\s+(.+)$/i);
    return match?.[1]?.trim() || undefined;
};
export const bearerAuthorization = (accessToken) => `Bearer ${accessToken}`;
export const isSessionExpired = (session, skewSeconds = 60) => {
    if (!session?.expires_at)
        return false;
    return session.expires_at <= Math.floor(Date.now() / 1000) + skewSeconds;
};
export const getSessionAccessToken = (session) => session?.access_token?.trim() || undefined;

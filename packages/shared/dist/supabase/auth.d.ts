import type { AuthenticatedUser } from "./ownership.js";
export interface SupabaseSession {
    access_token: string;
    refresh_token?: string;
    expires_at?: number;
    token_type?: string;
    user?: AuthenticatedUser & Record<string, unknown>;
}
export interface OtpVerificationResponse {
    access_token: string;
    refresh_token?: string;
    expires_at?: number;
    token_type?: string;
    user?: AuthenticatedUser & Record<string, unknown>;
}
export declare const extractBearerToken: (value: string | string[] | null | undefined) => string | undefined;
export declare const bearerAuthorization: (accessToken: string) => string;
export declare const isSessionExpired: (session: Pick<SupabaseSession, "expires_at"> | undefined, skewSeconds?: number) => boolean;
export declare const getSessionAccessToken: (session: Pick<SupabaseSession, "access_token"> | undefined) => string | undefined;
//# sourceMappingURL=auth.d.ts.map
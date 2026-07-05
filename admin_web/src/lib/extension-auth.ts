import { getRequestHeaders } from '@tanstack/react-start/server';

type ExtensionAuthFailureCode = 'invalid_session' | 'email_not_verified';

interface ExtensionAuthFailure {
  ok: false;
  status: 401 | 403;
  body: {
    error: string;
    code: ExtensionAuthFailureCode;
  };
}

interface ExtensionAuthSuccess {
  ok: true;
  userId: string;
}

type ExtensionAuthResult = ExtensionAuthSuccess | ExtensionAuthFailure;

const invalidSession = (): ExtensionAuthFailure => ({
  ok: false,
  status: 401,
  body: { error: 'Invalid session', code: 'invalid_session' },
});

const emailNotVerified = (): ExtensionAuthFailure => ({
  ok: false,
  status: 403,
  body: { error: 'Email not verified', code: 'email_not_verified' },
});

const getExtensionAuthHeaders = (headers: Headers): Headers => {
  if (!headers.get('authorization')) {
    return headers;
  }
  const authHeaders = new Headers(headers);
  authHeaders.delete('cookie');
  return authHeaders;
};

const getVerifiedExtensionUserId = async (requestHeaders?: Headers): Promise<ExtensionAuthResult> => {
  const headers = getExtensionAuthHeaders(requestHeaders ?? getRequestHeaders());
  const { auth } = await import('@/auth/auth');
  let session: Awaited<ReturnType<typeof auth.api.getSession>>;
  try {
    session = await auth.api.getSession({ headers });
  } catch {
    return invalidSession();
  }
  if (!session?.user) {
    return invalidSession();
  }
  if (!session.user.emailVerified) {
    return emailNotVerified();
  }
  return { ok: true, userId: session.user.id };
};

export { getVerifiedExtensionUserId };
export type { ExtensionAuthResult };

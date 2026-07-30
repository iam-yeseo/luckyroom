import { cookies } from "next/headers";

export type PublicUser = {
  displayName: string;
  id: string;
};

const SESSION_COOKIE = "luckyroom_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function getPublicUser(): Promise<PublicUser> {
  const cookieStore = await cookies();
  const savedSession = cookieStore.get(SESSION_COOKIE)?.value;
  const sessionId = UUID_PATTERN.test(savedSession ?? "")
    ? (savedSession as string)
    : crypto.randomUUID();

  if (sessionId !== savedSession) {
    cookieStore.set(SESSION_COOKIE, sessionId, {
      httpOnly: true,
      maxAge: SESSION_MAX_AGE_SECONDS,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
  }

  return {
    displayName: `행운 손님 ${sessionId.slice(0, 4).toUpperCase()}`,
    id: `guest:${sessionId}`,
  };
}

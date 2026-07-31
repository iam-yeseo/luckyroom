/**
 * The GitHub Pages artifact is frontend-only. Its production host proxies
 * `/api/game` to the live service before static-file lookup.
 */
export const dynamic = "force-static";

export function GET() {
  return Response.json(
    { error: "The game API is unavailable from the static artifact." },
    { status: 404 },
  );
}

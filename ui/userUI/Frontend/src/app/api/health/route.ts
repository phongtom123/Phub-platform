export const dynamic = "force-dynamic";

/** Liveness only: does not expose environment values or call the database. */
export function GET() {
  return Response.json(
    { status: "ok" },
    { headers: { "Cache-Control": "no-store" } },
  );
}

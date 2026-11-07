import { NextResponse } from "next/server";
import { defaultFetcher, makeClient, parseCode } from "@/lib/sfu";

export const runtime = "nodejs";

// Server-side proxy so the browser never calls sfu.ca directly (no CORS problems, responses cached 24h).
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const client = makeClient(defaultFetcher);
  try {
    const dept = q.get("dept");
    if (dept) {
      if (!/^[a-z]{2,4}$/i.test(dept)) return NextResponse.json({ error: "Department must be 2-4 letters" }, { status: 400 });
      return NextResponse.json({ courses: await client.deptCourses(dept) });
    }
    const code = q.get("code");
    if (code) {
      if (!parseCode(code)) return NextResponse.json({ error: "Not a course code" }, { status: 400 });
      const l = await client.lookup(code);
      return l ? NextResponse.json({ course: l }) : NextResponse.json({ error: "Course not found in recent terms" }, { status: 404 });
    }
    return NextResponse.json({ error: "Use ?dept=CMPT or ?code=CMPT 225" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: "Could not reach the SFU API: " + (e as Error).message }, { status: 502 });
  }
}

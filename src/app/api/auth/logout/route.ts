import { apiSuccess } from "@/lib/utils";
import { buildClearAccessCookie, buildClearRefreshCookie } from "@/lib/auth";

export async function POST() {
  const response = apiSuccess(null, "Logged out");
  response.headers.append("Set-Cookie", buildClearAccessCookie());
  response.headers.append("Set-Cookie", buildClearRefreshCookie());
  return response;
}

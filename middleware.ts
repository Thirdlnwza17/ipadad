import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PASSWORD = process.env.ACCESS_PASSWORD || "Ram#10240";

function unauthorized() {
  return new NextResponse("รหัสผ่านไม่ถูกต้อง", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Protected Area"',
    },
  });
}

export function middleware(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!auth) return unauthorized();

  const [scheme, encoded] = auth.split(" ");
  if (scheme !== "Basic") return unauthorized();

  // Decode Basic Auth header
  const decoded = atob(encoded);
  // Basic Auth ส่งรูปแบบ user:pass แต่เราใช้เฉพาะ pass
  const pass = decoded.split(":")[1] || decoded;

  if (pass === PASSWORD) {
    return NextResponse.next(); // ✅ ผ่าน
  }

  return unauthorized(); // ❌ ผิด
}

export const config = {
  matcher: ["/((?!_next/static|favicon.ico).*)"], // ป้องกันทุกหน้า ยกเว้นไฟล์ระบบ
};
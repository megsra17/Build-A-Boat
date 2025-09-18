import { NextResponse } from "next/server"; 
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
    const {pathname, searchParams} = req.nextUrl;

    //Only gaurd /admin
    if(!pathname.startsWith("/admin")) return NextResponse.next();

    //let the login page through
    if(pathname === "/admin/login") return NextResponse.next();

    //check: require admin=ok cookie
    const adminCookie = req.cookies.get("admin")?.value;
    if(adminCookie === "ok") return NextResponse.next();

    //no cookie redirect to login
    const url = req.nextUrl.clone();
    url.pathname = "/admin/login";
    url.searchParams.set("next", pathname + (searchParams.size ? `?${searchParams.toString()}` : ""));
    return NextResponse.redirect(url);
}
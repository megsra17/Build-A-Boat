import Head from "next/head";

export function getToken(){
    if(typeof window === "undefined") return null;
    return localStorage.getItem("jwt");
}

export async function authFetch(
    input: RequestInfo | URL,
    init?: RequestInit
): Promise<Response> {
    const token = getToken();
    const headers = new Headers(init?.headers || {});
    if(token){
        headers.set("Authorization", `Bearer ${token}`);
    }
    return fetch(input, {
        ...init,
        headers
    });
}
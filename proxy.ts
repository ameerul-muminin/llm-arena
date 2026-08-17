import { clerkMiddleware } from "@clerk/nextjs/server";

/**
 * Next.js 16 renamed the `middleware` convention to `proxy`. Same behaviour,
 * different filename — Clerk's docs cover both, and this project is on 16.
 *
 * This only establishes the auth context. It deliberately protects nothing:
 * a thread has to be readable by anyone with the link, signed in or not, and
 * only sending a prompt or voting requires an account. Those checks live next
 * to the thing they protect, in the route handler, which is also what Clerk
 * recommends over guarding routes from here.
 */
export default clerkMiddleware();

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/(.*)",
  ],
};

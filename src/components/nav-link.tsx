"use client";
import { usePathname } from "next/navigation";
import Link from "next/link";
import type { ReactNode } from "react";
export function NavLink({href,children}:{href:string,children:ReactNode}) {
  const path=usePathname();
  const active=path===href||(href!=="/staff"&&path.startsWith(href+"/"));
  return <Link className={"nav-item"+(active?" active":"")} aria-current={active?"page":undefined} href={href} onClick={event=>event.currentTarget.closest("details")?.removeAttribute("open")}>{children}</Link>;
}

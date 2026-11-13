"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { Menu } from "lucide-react";

export function MobileMenu({children}:{children:ReactNode}) {
  const menu=useRef<HTMLDetailsElement>(null);
  const trigger=useRef<HTMLElement>(null);
  useEffect(()=>{
    function dismiss(event:PointerEvent) {
      if(menu.current?.open&&event.target instanceof Node&&!menu.current.contains(event.target)) menu.current.open=false;
    }
    document.addEventListener("pointerdown",dismiss);
    return ()=>document.removeEventListener("pointerdown",dismiss);
  },[]);
  return <details className="more" ref={menu} onKeyDown={event=>{
    if(event.key==="Escape"&&menu.current?.open){
      trigger.current?.focus({preventScroll:true});
      menu.current.open=false;
      event.stopPropagation();
    }
  }}>
    <summary ref={trigger} tabIndex={0}><Menu size={20} aria-hidden="true"/>Меню</summary>
    <div className="more-panel">{children}</div>
  </details>;
}

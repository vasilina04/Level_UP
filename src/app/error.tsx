"use client";
import { Button } from "@/components/ui/button";
export default function ErrorPage({reset}:{reset:()=>void}) {return <main className="global-state"><h1>Не удалось загрузить страницу</h1><p>Проверьте подключение и повторите попытку.</p><Button onClick={reset}>Повторить</Button></main>}

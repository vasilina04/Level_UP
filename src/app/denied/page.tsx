import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
export default function Denied() {return <main className="global-state"><ShieldAlert size={34}/><h1>Нет доступа</h1><p>Эта страница недоступна для вашей роли.</p><Button asChild><Link href="/">Вернуться в кабинет</Link></Button><p className="muted">Конкурсный прототип · Вымышленные данные</p></main>}

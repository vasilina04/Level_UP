import Link from "next/link";
import { Button } from "@/components/ui/button";
export default function NotFound() {return <main className="global-state"><h1>Страница недоступна</h1><p>Проверьте адрес или вернитесь в кабинет.</p><Button asChild><Link href="/">В кабинет</Link></Button><p className="muted">Конкурсный прототип · Вымышленные данные</p></main>}

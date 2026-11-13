import { GraduationCap, ShieldCheck, ArrowUpRight } from "lucide-react";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/access";
import { LoginForm } from "@/components/forms";
import { Brand } from "@/components/common";
export default async function LoginPage({searchParams}:{searchParams:Promise<{error?:string}>}) {
  if(await getUser()) redirect("/");
  const {error}=await searchParams;
  return <main className="login">
    <section className="login-art">
      <Brand/>
      <div className="login-copy"><span className="eyebrow"><GraduationCap size={18}/> ЦИФРОВОЙ ДЕКАНАТ</span><h1>Прокачай<br/>свою учёбу<span>.</span></h1><p>Расписание, оценки, квесты и заявки в одном кабинете.</p></div>
      <span className="art-footer"><ArrowUpRight size={17}/> LEVEL UP · УНИВЕР</span>
    </section>
    <section className="login-panel"><div className="login-box"><div className="mobile-brand"><Brand/></div><div className="icon-tile violet"><GraduationCap size={24}/></div><h2>Вход в кабинет</h2><p className="muted">Введите данные своего учебного аккаунта.</p><LoginForm initialError={error}/><p className="demo-note"><ShieldCheck size={17}/> Конкурсный прототип · Вымышленные данные</p></div></section>
  </main>;
}

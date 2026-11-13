import Link from "next/link";
import { LogOut, Settings, Trophy, UserRound, Zap } from "lucide-react";
import { requireStudent } from "@/lib/access";
import { recentBadges, statsFor } from "@/lib/queries";
import { logout, saveSettings } from "@/app/actions";
import { ActionForm, Submit } from "@/components/forms";
import { Avatar, BadgeIcon, CardHeader, Empty, Progress, SectionTitle } from "@/components/common";
import { Button } from "@/components/ui/button";
export default async function Profile(){
  const {id,name,student}=await requireStudent();
  const [stats,badges]=await Promise.all([statsFor(id),recentBadges(id)]);
  return <><SectionTitle title="Профиль"/><div className="dashboard-grid">
    <section className="card"><CardHeader title="Учебный аккаунт" icon={UserRound}/><div className="profile-name"><Avatar name={name}/><h2>{name}</h2></div><dl className="definition"><dt>Факультет</dt><dd>{student.faculty.name}</dd><dt>Направление</dt><dd>{student.program}</dd><dt>Курс и группа</dt><dd>{student.year} курс · {student.group.name}</dd><dt>Учебный год</dt><dd>{student.academicYear}</dd></dl></section>
    <section className="card"><CardHeader title="Мой уровень" icon={Zap} color="gold"/><div className="level-detail"><div className="level-emblem"><span>{stats.xp.level}</span></div><div><h3>Уровень {stats.xp.level}</h3><p>{stats.xp.total} XP всего</p></div></div><Progress value={stats.xp.percent} label="До следующего уровня"/><p className="muted">{stats.xp.ceiling-stats.xp.total} XP до уровня {stats.xp.level+1}</p></section>
    <section className="card"><CardHeader title="Достижения" icon={Trophy} color="gold" href="/achievements"/>{badges.length?<div className="badge-strip">{badges.map(({achievement:a})=><Link key={a.id} href="/achievements"><BadgeIcon icon={a.icon} color={a.color}/><strong>{a.name}</strong></Link>)}</div>:<Empty title="Достижений пока нет"/>}</section>
    <section className="card"><CardHeader title="Настройки" icon={Settings}/><ActionForm action={saveSettings} className="stack"><label>Тема<select name="theme" defaultValue={student.theme}><option value="dark">Тёмная</option><option value="light">Светлая</option></select></label><label className="checkbox"><input type="checkbox" name="reminders" defaultChecked={student.reminders}/> Напоминания о дедлайнах</label><label className="checkbox"><input type="checkbox" name="animations" defaultChecked={student.animations}/> Игровые анимации</label><Submit>Сохранить настройки</Submit></ActionForm><form className="spaced" action={logout}><Button variant="secondary"><LogOut size={17}/> Выйти из аккаунта</Button></form></section>
  </div></>;
}

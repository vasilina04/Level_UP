import Link from "next/link";
import { Bell, CalendarDays, ChartNoAxesColumn, ChevronRight, FileText, LayoutDashboard, LogOut, Map, MessageSquare, ShieldCheck, Swords, Trophy, UserRound, Zap } from "lucide-react";
import type { ReactNode } from "react";
import { Brand, Avatar, initials } from "@/components/common";
import { NavLink } from "@/components/nav-link";
import { MobileMenu } from "@/components/mobile-menu";
import { logout } from "@/app/actions";

const sections=[
  {label:"ОБЗОР",items:[{href:"/dashboard",label:"Главная",icon:LayoutDashboard},{href:"/semester-map",label:"Карта семестра",icon:Map},{href:"/quests",label:"Квесты",icon:Swords},{href:"/achievements",label:"Достижения",icon:Trophy}]},
  {label:"УЧЁБА",items:[{href:"/schedule",label:"Расписание",icon:CalendarDays},{href:"/grades",label:"Успеваемость",icon:ChartNoAxesColumn},{href:"/documents",label:"Заявки и справки",icon:FileText}]},
  {label:"АККАУНТ",items:[{href:"/notifications",label:"Уведомления",icon:Bell},{href:"/profile",label:"Профиль",icon:UserRound}]},
];
const staffItems=[{href:"/staff",label:"Заявки",icon:FileText},{href:"/staff/academic",label:"Учебные данные",icon:ChartNoAxesColumn}];
const teacherItems=[{href:"/teacher",label:"Вопросы студентов",icon:MessageSquare}];
export function Shell({children,name,subtitle,level,unread=0,staff=false,teacher=false,theme="dark",animations=true}:{children:ReactNode,name:string,subtitle:string,level?:number,unread?:number,staff?:boolean,teacher?:boolean,theme?:string,animations?:boolean}) {
  const groups=teacher?[{label:"ПРЕПОДАВАТЕЛЬ",items:teacherItems}]:staff?[{label:"ДЕКАНАТ",items:staffItems}]:sections;
  const profile=<><Avatar name={name}/><span><strong>{name}</strong><small>{subtitle}</small></span><ChevronRight size={16}/></>;
  const shortNav=teacher?teacherItems:staff?staffItems:[sections[0].items[0],{...sections[0].items[1],label:"Карта"},sections[0].items[2],{...sections[1].items[0],label:"Расписание"},{...sections[1].items[2],label:"Заявки"}];
  return <div className="shell" data-theme={theme} data-motion={animations?"on":"off"}>
    <a href="#main" className="skip">К содержимому</a>
    <aside className="sidebar"><Link href={teacher?"/teacher":staff?"/staff":"/dashboard"} className="brand-link"><Brand/></Link>
      <nav aria-label="Основное меню">{groups.map(group=><div className="nav-group" key={group.label}><p>{group.label}</p>{group.items.map(({icon:Icon,href,label})=><NavLink key={href} href={href}><Icon size={18}/><span>{label}</span>{href==="/notifications"&&unread>0&&<small aria-hidden="true">{unread}</small>}</NavLink>)}</div>)}</nav>
      <div className="sidebar-foot">{staff||teacher?<form action={logout}><button className="nav-item"><LogOut size={18}/> Выйти</button></form>:<Link className="account" href="/profile">{profile}</Link>}</div>
    </aside>
    <div className="workspace"><header className="topbar"><div className="crumb"><span>LEVEL UP</span><ChevronRight size={14}/><strong>{teacher?"Кабинет преподавателя":staff?"Кабинет сотрудника":"Кабинет студента"}</strong></div><div className="top-actions">
      <span className="demo-label"><ShieldCheck size={14}/> Конкурсный прототип · Вымышленные данные</span>
      {!staff&&!teacher&&<><Link href="/notifications" className="bell" aria-label={unread?"Уведомления, непрочитанных "+unread:"Уведомления"}><Bell size={19}/>{unread>0&&<i/>}</Link><Link href="/profile" className="top-avatar" aria-label={"Открыть профиль · "+initials(name)}><Avatar name={name}/></Link></>}
      {level&&<span className="level-pill"><Zap size={15}/> Ур. {level}</span>}
    </div></header>
    <main id="main" className="content" tabIndex={-1}>{children}</main>
    <footer className="page-footer">LEVEL UP · Универ <span>Конкурсный прототип с вымышленными данными</span></footer></div>
    <nav className="bottom-nav" aria-label="Мобильное меню">{shortNav.map(({icon:Icon,...item})=><NavLink key={item.href} {...item}><Icon size={19}/><span>{item.label}</span></NavLink>)}
    <MobileMenu>{groups.flatMap(g=>g.items).map(({icon:Icon,...item})=><NavLink key={item.href} {...item}><Icon size={18}/>{item.label}</NavLink>)}<form action={logout}><button className="nav-item"><LogOut size={18}/> Выйти</button></form></MobileMenu></nav>
  </div>;
}

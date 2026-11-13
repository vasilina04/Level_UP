import Link from "next/link";
import { ArrowRight, ArrowUpRight, BookOpen, ChevronRight, Compass, Flag, FlaskConical, Flame, GraduationCap, Inbox, Sparkles, Trophy, Zap, type LucideIcon } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
export function Brand() {return <div className="brand"><span className="brand-mark"><GraduationCap size={23}/></span><div><strong>LEVEL<span> UP</span></strong><small>УНИВЕР</small></div></div>;}
export const initials=(name:string)=>name.split(" ").slice(0,2).map(word=>word[0]).join("");
export function Avatar({name}:{name:string}) {return <span className="avatar" aria-hidden="true">{initials(name)}</span>;}
export function IconTile({icon:Icon,color="violet"}:{icon:LucideIcon,color?:string}) {return <span className={"icon-tile "+color}><Icon size={19} aria-hidden="true"/></span>;}
export function Progress({value,label}:{value:number,label:string}) {return <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value} className="progress"><span style={{width:value+"%"}}/></div>;}
export function ProgressRing({value,label}:{value:number,label:string}) {
  return <div className="progress-ring" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value} style={{"--progress":value+"%"} as CSSProperties}>
    <span aria-hidden="true">{value}<small>%</small></span>
  </div>;
}
export function SectionTitle({title,subtitle}:{title:string,subtitle?:string}) {return <header className="section-title"><h1>{title}</h1>{subtitle&&<p>{subtitle}</p>}</header>;}
export function CardHeader({title,icon:Icon,color,href,link="Все"}:{title:string,icon:LucideIcon,color?:string,href?:string,link?:string}) {return <div className="card-head"><div><IconTile icon={Icon} color={color}/><h2>{title}</h2></div>{href&&<Link href={href} className="text-link">{link}<ChevronRight size={16}/></Link>}</div>;}
export function Empty({title,children}:{title:string,children?:ReactNode}) {return <div className="empty"><IconTile icon={Inbox}/><strong>{title}</strong>{children&&<p>{children}</p>}</div>;}
export function Back({href,label}:{href:string,label:string}) {return <Link className="text-link back" href={href}><ArrowRight size={16}/>{label}</Link>;}
export function BadgeIcon({icon,color}:{icon:string,color:string}) {
  const icons:Record<string,LucideIcon>={flag:Flag,flask:FlaskConical,zap:Zap,compass:Compass,trophy:Trophy,flame:Flame};
  const Icon=icons[icon]||Sparkles;
  return <span className={"badge-icon "+color}><Icon size={23} aria-hidden="true"/></span>;
}
export function StatusPill({label,color="violet"}:{label:string,color?:string}) {return <span className={"pill "+color}>{label}</span>;}
export function QuestGlyph({color}:{color:string}) {return <IconTile icon={BookOpen} color={color}/>;}
export function Jump({href,label}:{href:string,label:string}) {return <Link href={href} className="text-link">{label}<ArrowUpRight size={16}/></Link>;}

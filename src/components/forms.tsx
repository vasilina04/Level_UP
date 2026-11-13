"use client";
import { useActionState, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { ArrowRight, Check, Eye, EyeOff, LoaderCircle, LockKeyhole, UserRound } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { Button } from "@/components/ui/button";
import { signIn } from "next-auth/react";
import { reviseSchedule, type Result } from "@/app/actions";
type Action = (previous:Result, data:FormData)=>Promise<Result>;
export function Submit({children}:{children:ReactNode}) {
  const {pending}=useFormStatus();
  return <Button type="submit" disabled={pending}>{pending?<><LoaderCircle size={17} className="spin"/> Подождите…</>:children}</Button>;
}
export function ActionForm({action,children,className,animate=false}:{action:Action,children:ReactNode,className?:string,animate?:boolean}) {
  const [state,submit]=useActionState(action,null);
  const reduceMotion=useReducedMotion();
  const destination=state?.navigateTo;
  useEffect(()=>{
    if(!destination) return;
    if(window.location.pathname===destination) window.location.reload();
    else window.location.assign(destination);
  },[destination]);
  return <form action={submit} className={className}>{children}
    {state&&<motion.p initial={state.leveled&&animate&&!reduceMotion?{scale:.88}:false} animate={{scale:1}} className={"form-feedback "+(state.success?"success":"error")} role={state.success?"status":"alert"}>{state.success&&<Check size={16}/>} {state.message}</motion.p>}
  </form>;
}
export function LoginForm({initialError}:{initialError?:string}) {
  const [visible,setVisible]=useState(false);
  const [pending,setPending]=useState(false);
  const [ready,setReady]=useState(false);
  const invalidCredentials="Неверный логин или пароль либо превышен лимит попыток.";
  const unavailable="Вход временно недоступен. Попробуйте позже.";
  const [error,setError]=useState(initialError==="CredentialsSignin"?invalidCredentials:initialError?unavailable:"");
  useEffect(()=>setReady(true),[]);
  async function enter(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if(pending) return;
    const data=new FormData(event.currentTarget);
    setError("");
    setPending(true);
    try {
      const result=await signIn("credentials",{login:data.get("login"),password:data.get("password"),redirect:false,redirectTo:"/"});
      if(result?.ok&&!result.error) {
        window.location.assign("/");
        return;
      }
      setError(result?.error==="CredentialsSignin"?invalidCredentials:unavailable);
    } catch {
      setError("Не удалось войти. Проверьте подключение и повторите попытку.");
    } finally {
      setPending(false);
    }
  }
  return <form method="post" onSubmit={enter} className="stack login-fields">
    <noscript>Для входа включите JavaScript в браузере.</noscript>
    <label>Логин<span className="input-icon"><UserRound size={17}/><input name="login" placeholder="Введите логин" autoComplete="username" required maxLength={64}/></span></label>
    <label>Пароль<span className="input-icon"><LockKeyhole size={17}/><input name="password" aria-label="Пароль" type={visible?"text":"password"} placeholder="Введите пароль" autoComplete="current-password" required maxLength={128}/>
      <button type="button" className="eye" onClick={()=>setVisible(!visible)} aria-label={visible?"Скрыть пароль":"Показать пароль"}>{visible?<EyeOff size={18}/>:<Eye size={18}/>}</button>
    </span></label>
    <Button type="submit" disabled={!ready||pending}>{pending?<><LoaderCircle size={17} className="spin"/> Подождите…</>:<>Войти в кабинет <ArrowRight size={17}/></>}</Button>
    {error&&<p className="form-feedback error" role="alert">{error}</p>}
  </form>;
}
export function ScheduleEditForm({id,revision,room,building,teacher}:{id:string,revision:number,room:string,building:string,teacher:string}){
  const [kind,setKind]=useState("room");
  return <ActionForm action={reviseSchedule} className="stack subject-detail">
    <input type="hidden" name="id" value={id}/><input type="hidden" name="revision" value={revision}/><input type="hidden" name="kind" value={kind}/>
    <label>Изменение<select value={kind} onChange={event=>setKind(event.target.value)}><option value="room">Другая аудитория</option><option value="teacher">Замена преподавателя</option><option value="time">Перенос занятия</option><option value="cancel">Отмена занятия</option></select></label>
    {kind==="room"&&<><label>Корпус<input name="building" defaultValue={building} maxLength={80} required/></label><label>Аудитория<input name="room" defaultValue={room} maxLength={80} required/></label></>}
    {kind==="teacher"&&<label>Преподаватель<input name="teacherOverride" defaultValue={teacher} maxLength={100} required/></label>}
    {kind==="time"&&<><label>Новое начало<input name="start" type="datetime-local" required/></label><label>Новое окончание<input name="end" type="datetime-local" required/></label></>}
    <label>Причина изменения<input name="reason" maxLength={200} minLength={3} required/></label><Submit>Сохранить изменение</Submit>
  </ActionForm>;
}

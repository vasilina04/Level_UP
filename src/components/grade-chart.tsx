"use client";
import { CartesianGrid, Line, ComposedChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { GradeWeek } from "@/lib/grade-trend";

const format = new Intl.NumberFormat("ru-RU",{maximumFractionDigits:2});
export function GradeChart({weeks}:{weeks:GradeWeek[]}) {
  const latest=weeks.at(-1)!;
  const points=weeks.map(week=>({...week,...Object.fromEntries([2,3,4,5].map(value=>["grade"+value,week.grades.some(g=>g.value===value)?value:null]))}));
  return <div className="grade-trend">
    <div className="grade-trend-head"><strong>{format.format(latest.average!)}</strong><span>Среднее за последнюю неделю<br/><small>{latest.period} · с учётом весов</small></span></div>
    <div className="chart" aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <ComposedChart accessibilityLayer={false} data={points} margin={{left:0,right:16,top:9,bottom:3}}>
          <CartesianGrid stroke="var(--line)" vertical={false}/>
          <XAxis dataKey="label" stroke="var(--muted)" tick={{fontSize:11}} minTickGap={24} tickLine={false}/>
          <YAxis width={24} domain={[2,5]} ticks={[2,3,4,5]} stroke="var(--muted)" tickLine={false} tick={{fontSize:11}}/>
          <Tooltip content={({active,payload})=>{
            const week=payload?.[0]?.payload as GradeWeek|undefined;
            if(!active||!week) return null;
            return <div className="grade-tooltip"><strong>{week.period}</strong>
              <p>{week.average===null?"Оценок нет":"Среднее · "+format.format(week.average)}</p>
              {week.grades.map(g=><div key={g.id}><span>{g.subject} · {g.title}</span><b>{g.value} ×{g.weight}</b></div>)}
            </div>;
          }}/>
          <Line type="linear" dataKey="average" stroke="var(--trend-average)" strokeWidth={3} dot={{r:4,fill:"var(--trend-average)"}} activeDot={{r:6}} isAnimationActive={false}/>
          {[2,3,4,5].map(value=><Line key={value} dataKey={"grade"+value} stroke="none" dot={{r:3.5,fill:"var(--card)",stroke:"var(--trend-point)",strokeWidth:2}} activeDot={false} isAnimationActive={false}/>)}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
    <div className="grade-legend"><span><i/>Среднее за неделю</span><span><i/>Оценки за работы</span></div>
    <details className="grade-data"><summary>Оценки по неделям</summary>
      {weeks.map(week=><div className="grade-week" key={week.week}><h3>{week.period}</h3>
        {week.average===null?<p>Оценок нет</p>:<><p>Среднее с учётом весов · {format.format(week.average)}</p><ul>{week.grades.map(g=><li key={g.id}><span>{g.date} · {g.subject} · {g.title}</span><strong>{g.value} · вес {g.weight}</strong></li>)}</ul></>}
      </div>)}
    </details>
  </div>;
}

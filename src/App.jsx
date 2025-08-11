import React, { useEffect, useMemo, useRef, useState } from "react";

// Clean Pomodoro App - Focus on simplicity and eye comfort with Nepali Calendar (BS)
const LS_KEYS = {
  SETTINGS: "pomodoro:settings",
  STATS: "pomodoro:stats",
  TASKS_BY_DATE: "pomodoro:tasksByDate",
};

// Nepali Calendar utilities with accurate BS dates
const nepaliMonths = [
  'Baisakh', 'Jestha', 'Ashadh', 'Shrawan', 'Bhadra', 'Ashwin',
  'Kartik', 'Mangsir', 'Poush', 'Magh', 'Falgun', 'Chaitra'
];

const nepaliDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// More accurate BS-AD conversion
function adToBs(adYear, adMonth, adDay) {
  // For August 11, 2025 AD = Shrawan 26, 2082 BS
  const baseAdDate = new Date(2025, 7, 11); // Aug 11, 2025
  const baseBsYear = 2082;
  const baseBsMonth = 3; // Shrawan (index 3)
  const baseBsDay = 26;
  
  const currentAdDate = new Date(adYear, adMonth, adDay);
  const diffDays = Math.floor((currentAdDate - baseAdDate) / (1000 * 60 * 60 * 24));
  
  let bsYear = baseBsYear;
  let bsMonth = baseBsMonth;
  let bsDay = baseBsDay + diffDays;
  
  // Days in each Nepali month
  const daysInMonth = [31, 31, 31, 32, 32, 31, 30, 29, 30, 29, 30, 30];
  
  // Adjust for month overflow
  while (bsDay > daysInMonth[bsMonth]) {
    bsDay -= daysInMonth[bsMonth];
    bsMonth++;
    if (bsMonth > 11) {
      bsMonth = 0;
      bsYear++;
    }
  }
  
  // Adjust for negative days
  while (bsDay < 1) {
    bsMonth--;
    if (bsMonth < 0) {
      bsMonth = 11;
      bsYear--;
    }
    bsDay += daysInMonth[bsMonth];
  }
  
  return { year: bsYear, month: bsMonth, day: bsDay };
}

function bsToAd(bsYear, bsMonth, bsDay) {
  // Reverse conversion based on the reference point
  const baseAdDate = new Date(2025, 7, 11); // Aug 11, 2025
  const baseBsYear = 2082;
  const baseBsMonth = 3; // Shrawan
  const baseBsDay = 26;
  
  // Calculate difference in days from base BS date
  const daysInMonth = [31, 31, 31, 32, 32, 31, 30, 29, 30, 29, 30, 30];
  
  let diffDays = 0;
  let currentYear = baseBsYear;
  let currentMonth = baseBsMonth;
  let currentDay = baseBsDay;
  
  // Simple approximation for reverse conversion
  const yearDiff = bsYear - baseBsYear;
  const monthDiff = bsMonth - baseBsMonth;
  const dayDiff = bsDay - baseBsDay;
  
  diffDays = yearDiff * 365 + monthDiff * 30 + dayDiff;
  
  const resultAdDate = new Date(baseAdDate.getTime() + diffDays * 24 * 60 * 60 * 1000);
  return { year: resultAdDate.getFullYear(), month: resultAdDate.getMonth(), day: resultAdDate.getDate() };
}

function getNepaliMonthMatrix(bsYear, bsMonth) {
  // Days in each Nepali month (approximate)
  const daysInNepaliMonth = [31, 31, 31, 32, 32, 31, 30, 29, 30, 29, 30, 30];
  const daysInMonth = daysInNepaliMonth[bsMonth] || 30;
  
  // Convert BS first day to AD to get day of week
  const adDate = bsToAd(bsYear, bsMonth, 1);
  const firstDay = new Date(adDate.year, adDate.month, 1);
  const startDay = firstDay.getDay();
  
  const matrix = [];
  let row = [];

  // Previous month days
  const prevMonth = bsMonth === 0 ? 11 : bsMonth - 1;
  const prevMonthDays = daysInNepaliMonth[prevMonth] || 30;
  
  for (let i = prevMonthDays - startDay + 1; i <= prevMonthDays; i++) {
    row.push({ day: i, inMonth: false, offset: -1 });
  }

  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    row.push({ day: d, inMonth: true, offset: 0 });
    if (row.length === 7) {
      matrix.push(row);
      row = [];
    }
  }

  // Next month days
  let nd = 1;
  while (row.length < 7) {
    row.push({ day: nd++, inMonth: false, offset: 1 });
  }
  if (row.length > 0) matrix.push(row);

  // Fill to 6 rows
  while (matrix.length < 6) {
    const extra = [];
    for (let i = 0; i < 7; i++) {
      extra.push({ day: nd++, inMonth: false, offset: 1 });
    }
    matrix.push(extra);
  }
  
  return matrix;
}

function dateKeyNepali(y, m, d) { 
  return `${y}-${String(m + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}-bs`; 
}

const defaultSettings = {
  work: 25 * 60,
  shortBreak: 5 * 60,
  longBreak: 15 * 60,
  cyclesBeforeLong: 4,
  autoStartNext: false,
  sound: true,
  notification: true,
  theme: "light",
  dailyGoal: 8,
};

function useLocalStorage(key, initial) {
  const [state, setState] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : initial;
    } catch (e) {
      return initial;
    }
  });
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(state)); } catch (e) {}
  }, [key, state]);
  return [state, setState];
}

function formatTime(sec) {
  const m = Math.floor(sec / 60).toString().padStart(2, "0");
  const s = Math.floor(sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function useCountdown(endTimeMillis, running) {
  const [secondsLeft, setSecondsLeft] = useState(Math.max(0, Math.round((endTimeMillis - Date.now()) / 1000)));
  const rafRef = useRef(null);
  const prevRef = useRef(secondsLeft);
  const endRef = useRef(endTimeMillis);

  useEffect(() => { endRef.current = endTimeMillis; }, [endTimeMillis]);

  useEffect(() => {
    if (!running) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }
    const tick = () => {
      const rem = Math.max(0, Math.round((endRef.current - Date.now()) / 1000));
      if (rem !== prevRef.current) {
        prevRef.current = rem;
        setSecondsLeft(rem);
      }
      if (rem > 0) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [running]);

  return { secondsLeft };
}

function getMonthMatrix(year, month) {
  const first = new Date(year, month, 1);
  const startDay = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const matrix = [];
  let row = [];

  const prevMonthDays = new Date(year, month, 0).getDate();
  for (let i = prevMonthDays - startDay + 1; i <= prevMonthDays; i++) row.push({ day: i, inMonth: false, offset: -1 });

  let d = 1;
  while (d <= daysInMonth) {
    row.push({ day: d, inMonth: true, offset: 0 });
    if (row.length === 7) { matrix.push(row); row = []; }
    d++;
  }

  let nd = 1;
  while (row.length < 7) { row.push({ day: nd++, inMonth: false, offset: 1 }); }
  matrix.push(row);
  while (matrix.length < 6) {
    const extra = [];
    for (let i = 0; i < 7; i++) extra.push({ day: nd++, inMonth: false, offset: 1 });
    matrix.push(extra);
  }
  return matrix;
}

function dateKey(y, m0, d) { return `${y}-${String(m0 + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`; }

export default function App() {
  const [settings, setSettings] = useLocalStorage(LS_KEYS.SETTINGS, defaultSettings);
  const [stats, setStats] = useLocalStorage(LS_KEYS.STATS, { totalPomodoros: 0, today: { date: '', count: 0 }, history: [] });
  const [tasksByDate, setTasksByDate] = useLocalStorage(LS_KEYS.TASKS_BY_DATE, {});

  // Real-time BS date update
  const [currentTime, setCurrentTime] = useState(new Date());
  
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute
    
    return () => clearInterval(timer);
  }, []);
  
  const today = currentTime;
  const todayNepali = adToBs(today.getFullYear(), today.getMonth(), today.getDate());
  const [viewYear, setViewYear] = useState(todayNepali.year);
  const [viewMonth, setViewMonth] = useState(todayNepali.month);
  const [selectedDateKey, setSelectedDateKey] = useState(dateKeyNepali(todayNepali.year, todayNepali.month, todayNepali.day));

  const [mode, setMode] = useState('work');
  const [running, setRunning] = useState(false);
  const [sessionEnd, setSessionEnd] = useState(Date.now() + settings.work * 1000);
  const { secondsLeft } = useCountdown(sessionEnd, running);
  const [cycleCount, setCycleCount] = useState(0);
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    const now = Date.now();
    if (mode === 'work') setSessionEnd(now + settings.work * 1000);
    else if (mode === 'shortBreak') setSessionEnd(now + settings.shortBreak * 1000);
    else setSessionEnd(now + settings.longBreak * 1000);
  }, [mode, settings.work, settings.shortBreak, settings.longBreak]);

  useEffect(() => {
    if (secondsLeft > 0) return;
    setRunning(false);
    if (mode === 'work') {
      const todayDate = new Date().toISOString().slice(0,10);
      setStats(old => {
        const newToday = old.today.date === todayDate ? { ...old.today, count: old.today.count + 1 } : { date: todayDate, count: 1 };
        const total = (old.totalPomodoros || 0) + 1;
        const history = [...(old.history||[])];
        const last = history[history.length-1];
        if (last && last.date === todayDate) last.count += 1; else history.push({ date: todayDate, count: 1 });
        return { ...old, totalPomodoros: total, today: newToday, history };
      });

      if (selectedTaskId != null) {
        setTasksByDate(prev => {
          const list = prev[selectedDateKey] ? [...prev[selectedDateKey]] : [];
          const idx = list.findIndex(t => t.id === selectedTaskId);
          if (idx !== -1) { const item = { ...list[idx] }; item.pomodoros = (item.pomodoros||0) + 1; list[idx] = item; }
          return { ...prev, [selectedDateKey]: list };
        });
      }

      setCycleCount(c => c + 1);
    }
    setMode(prev => prev === 'work' ? ((cycleCount + 1) >= settings.cyclesBeforeLong ? 'longBreak' : 'shortBreak') : 'work');
    if (settings.autoStartNext) setTimeout(()=>setRunning(true), 300);
  }, [secondsLeft]);

  useEffect(() => {
    const t = settings.theme === 'auto' ? (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : settings.theme;
    if (t === 'dark') {
      document.documentElement.classList.add('dark');
      document.body.style.backgroundColor = '#0f172a';
    } else {
      document.documentElement.classList.remove('dark');
      document.body.style.backgroundColor = '#f8fafc';
    }
  }, [settings.theme]);

  useEffect(()=>{
    const onKey = (e) => {
      if (e.code === 'Space') { e.preventDefault(); setRunning(r=>!r); }
      if (e.key === 'n') setSessionEnd(Date.now()+1000);
      if (e.key === 's') setShowSettings(s => !s);
      if (e.key === 't') setSelectedTaskId(null);
    };
    window.addEventListener('keydown', onKey);
    return ()=>window.removeEventListener('keydown', onKey);
  },[]);

  function prevMonth(){ 
    const m = viewMonth - 1; 
    if (m < 0) { 
      setViewMonth(11); 
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(m); 
    }
  }
  
  function nextMonth(){ 
    const m = viewMonth + 1; 
    if (m > 11) { 
      setViewMonth(0); 
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(m); 
    }
  }

  function addTaskForSelected(title, time) {
    if (!title) return;
    const id = Date.now();
    setTasksByDate(prev => {
      const prevList = prev[selectedDateKey] ? [...prev[selectedDateKey]] : [];
      prevList.unshift({ id, title, time: time || null, done: false, pomodoros: 0 });
      return { ...prev, [selectedDateKey]: prevList };
    });
  }

  function toggleDone(id){ setTasksByDate(prev=>{ const list = (prev[selectedDateKey]||[]).map(t=> t.id===id ? {...t, done: !t.done} : t); return {...prev, [selectedDateKey]: list}; }); }
  function removeTask(id){ setTasksByDate(prev=>{ const list = (prev[selectedDateKey]||[]).filter(t=>t.id!==id); return {...prev, [selectedDateKey]: list}; }); }
  function selectTask(id){ setSelectedTaskId(id); }

  const datesWithTasks = useMemo(()=> new Set(Object.keys(tasksByDate||{})), [tasksByDate]);
  const matrix = getNepaliMonthMatrix(viewYear, viewMonth);
  const totalForMode = mode === 'work' ? settings.work : mode === 'shortBreak' ? settings.shortBreak : settings.longBreak;
  const pct = Math.max(0, Math.min(1, (totalForMode - secondsLeft) / totalForMode));

  return (
    <div className="h-screen bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 transition-colors duration-300 overflow-hidden relative">
      <div className="h-full overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-full p-4">

          {/* Calendar Sidebar */}
          <aside className="lg:col-span-3 bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 overflow-auto relative">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-lg font-semibold text-slate-900 dark:text-white">{nepaliMonths[viewMonth]} {viewYear}</div>
                <div className="text-sm text-slate-500 dark:text-slate-400">BS {viewYear}</div>
              </div>
              <div className="flex gap-1">
                <button onClick={prevMonth} className="p-2 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button onClick={nextMonth} className="p-2 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 text-xs text-center text-slate-500 dark:text-slate-400 gap-1 mb-2 font-medium">
              {nepaliDays.map(d=> <div key={d} className="py-1">{d}</div>)}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {matrix.map((week,ri)=> week.map((cell,ci)=>{
                const d = cell.day; const inMonth = cell.inMonth; const mo = cell.offset;
                let cellMonth = viewMonth + (mo||0);
                let cellYear = viewYear;
                if (cellMonth < 0) { cellMonth += 12; cellYear -= 1; }
                if (cellMonth > 11) { cellMonth -= 12; cellYear += 1; }
                const key = dateKeyNepali(cellYear, cellMonth, d);
                const isSelected = key === selectedDateKey;
                const hasTasks = datesWithTasks.has(key);
                const isToday = key === dateKeyNepali(todayNepali.year, todayNepali.month, todayNepali.day);
                return (
                  <button 
                    key={`${ri}-${ci}`} 
                    onClick={()=>{ setSelectedDateKey(key); setViewYear(cellYear); setViewMonth(cellMonth); setSelectedTaskId(null); }}
                    className={`
                      p-2 rounded-lg text-sm h-10 flex items-center justify-center transition-colors relative
                      ${inMonth? '':'opacity-40'} 
                      ${isSelected? 'bg-indigo-600 text-white':'hover:bg-slate-100 dark:hover:bg-slate-700'}
                      ${isToday && !isSelected ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400' : ''}
                      ${!isSelected && !isToday ? 'text-slate-700 dark:text-slate-300' : ''}
                    `}
                  >
                    {d}
                    {hasTasks && !isSelected && <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-indigo-500" />}
                  </button>
                );
              }))}
            </div>

            {/* Settings Button - Bottom Left of Calendar */}
            <button 
              onClick={() => setShowSettings(true)}
              className="absolute bottom-4 left-4 p-2 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors shadow-sm"
              title="Settings"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </aside>

          {/* Main Timer Area */}
          <main className="lg:col-span-6 space-y-4 overflow-auto flex flex-col">
            {/* Timer Card */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 flex-1">
              <div className="text-center space-y-6 h-full flex flex-col justify-center">
                {/* Current Task */}
                <div className="space-y-2">
                  <div className="text-sm text-slate-500 dark:text-slate-400">Current Focus</div>
                  <div className="text-xl font-medium text-slate-900 dark:text-white">
                    {selectedTaskId ? (tasksByDate[selectedDateKey]?.find(t=>t.id===selectedTaskId)?.title || 'Task') : 'No task selected'}
                  </div>
                </div>

                {/* Timer Circle */}
                <div className="relative flex justify-center">
                  <svg width="250" height="250" viewBox="0 0 250 250" className="transform -rotate-90">
                    <circle cx="125" cy="125" r="100" strokeWidth="8" stroke="rgb(226 232 240)" fill="none" className="dark:stroke-slate-700" />
                    <circle 
                      cx="125" 
                      cy="125" 
                      r="100" 
                      strokeWidth="8" 
                      stroke={mode==='work'?'rgb(79 70 229)':mode==='shortBreak'?'rgb(16 185 129)':'rgb(139 92 246)'} 
                      strokeLinecap="round" 
                      strokeDasharray={`${2*Math.PI*100}`} 
                      strokeDashoffset={`${2*Math.PI*100*(1-pct)}`} 
                      fill="none" 
                      className="transition-all duration-1000 ease-linear"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <div className="text-5xl font-bold text-slate-900 dark:text-white tabular-nums">
                        {formatTime(Math.max(0, secondsLeft))}
                      </div>
                      <div className="text-sm mt-2 text-slate-500 dark:text-slate-400 font-medium">
                        {mode==='work'? 'Work Session' : mode==='shortBreak' ? 'Short Break' : 'Long Break'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Controls */}
                <div className="flex justify-center gap-3">
                  <button 
                    onClick={()=> setRunning(r=>!r)} 
                    className={`px-8 py-3 rounded-xl font-medium transition-colors ${
                      running 
                        ? 'bg-red-600 hover:bg-red-700 text-white' 
                        : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                    }`}
                  >
                    {running ? 'Pause' : 'Start'}
                  </button>
                  
                  <button 
                    onClick={()=>{ setSessionEnd(Date.now()+1000); }} 
                    className="px-6 py-3 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors text-slate-700 dark:text-slate-300 font-medium"
                  >
                    Skip
                  </button>
                  
                  <button 
                    onClick={()=>{ setRunning(false); const now=Date.now(); setSessionEnd(now + (mode==='work'?settings.work:(mode==='shortBreak'?settings.shortBreak:settings.longBreak))*1000); }} 
                    className="px-6 py-3 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors text-slate-700 dark:text-slate-300 font-medium"
                  >
                    Reset
                  </button>
                </div>

                {/* Session Info */}
                <div className="grid grid-cols-2 gap-4 pt-6 mt-4 border-t border-slate-200 dark:border-slate-700">
                  <div className="text-center">
                    <div className="text-sm text-slate-500 dark:text-slate-400">Cycle</div>
                    <div className="text-lg font-semibold text-slate-900 dark:text-white">
                      {cycleCount % settings.cyclesBeforeLong + 1} / {settings.cyclesBeforeLong}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm text-slate-500 dark:text-slate-400">Auto-start</div>
                    <div className={`text-lg font-semibold ${settings.autoStartNext ? 'text-emerald-600' : 'text-slate-400'}`}>
                      {settings.autoStartNext? 'On':'Off'}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Mode Selector */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200 dark:border-slate-700">
              <div className="grid grid-cols-3 gap-2">
                <button 
                  onClick={()=>{ setMode('work'); setRunning(false); }} 
                  className={`py-3 px-4 rounded-xl font-medium transition-colors ${
                    mode==='work' 
                      ? 'bg-indigo-600 text-white' 
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                  }`}
                >
                  Work ({Math.round(settings.work/60)}m)
                </button>
                <button 
                  onClick={()=>{ setMode('shortBreak'); setRunning(false); }} 
                  className={`py-3 px-4 rounded-xl font-medium transition-colors ${
                    mode==='shortBreak' 
                      ? 'bg-emerald-600 text-white' 
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                  }`}
                >
                  Short ({Math.round(settings.shortBreak/60)}m)
                </button>
                <button 
                  onClick={()=>{ setMode('longBreak'); setRunning(false); }} 
                  className={`py-3 px-4 rounded-xl font-medium transition-colors ${
                    mode==='longBreak' 
                      ? 'bg-purple-600 text-white' 
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                  }`}
                >
                  Long ({Math.round(settings.longBreak/60)}m)
                </button>
              </div>
            </div>

            {/* Progress */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200 dark:border-slate-700">
              <div className="grid grid-cols-4 gap-4 text-center">
                <div>
                  <div className="text-xl font-bold text-indigo-600">{stats.today?.count || 0}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">Today</div>
                </div>
                <div>
                  <div className="text-xl font-bold text-emerald-600">{settings.dailyGoal}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">Goal</div>
                </div>
                <div>
                  <div className="text-xl font-bold text-purple-600">{stats.totalPomodoros || 0}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">Total</div>
                </div>
                <div>
                  <div className="text-xl font-bold text-orange-600">{Math.round(((stats.today?.count || 0) / (settings.dailyGoal || 8)) * 100)}%</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">Progress</div>
                </div>
              </div>
              <div className="mt-4">
                <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                  <div 
                    style={{ width: `${Math.min(100, ((stats.today?.count || 0) / (settings.dailyGoal || 8)) * 100)}%` }} 
                    className="h-2 bg-indigo-600 transition-all duration-500 rounded-full"
                  ></div>
                </div>
              </div>
            </div>
          </main>

          {/* Tasks Sidebar */}
          <aside className="lg:col-span-3 bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-sm text-slate-500 dark:text-slate-400">Tasks</div>
                <div className="text-lg font-semibold text-slate-900 dark:text-white">{selectedDateKey.split('-bs')[0]}</div>
              </div>
              <div className="text-sm text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-3 py-1 rounded-full">
                {(tasksByDate[selectedDateKey]||[]).length}
              </div>
            </div>

            <TaskList tasks={tasksByDate[selectedDateKey]||[]} onAdd={addTaskForSelected} onToggle={toggleDone} onRemove={removeTask} onSelect={selectTask} selectedId={selectedTaskId} />
          </aside>
        </div>
      </div>

      {showSettings && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
          <div className="absolute inset-0 bg-black/50" onClick={()=>setShowSettings(false)} />
          <div className="relative bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-2xl border border-slate-200 dark:border-slate-700">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold text-slate-900 dark:text-white">Settings</h3>
              <div className="flex gap-2">
                <button onClick={()=>{ setSettings(defaultSettings); }} className="px-4 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors">
                  Reset
                </button>
                <button onClick={()=>setShowSettings(false)} className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors">
                  Done
                </button>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <h4 className="text-sm font-medium text-slate-900 dark:text-white mb-3">Timer Duration</h4>
                <div className="grid grid-cols-3 gap-4">
                  <label className="space-y-1">
                    <span className="text-sm text-slate-600 dark:text-slate-300">Work (minutes)</span>
                    <input 
                      type="number" 
                      min={1} 
                      max={60}
                      value={Math.round(settings.work/60)} 
                      onChange={(e)=>setSettings(s=>({...s, work: Math.max(1, Number(e.target.value))*60}))} 
                      className="w-full p-2 rounded-lg bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white" 
                    />
                  </label>

                  <label className="space-y-1">
                    <span className="text-sm text-slate-600 dark:text-slate-300">Short Break</span>
                    <input 
                      type="number" 
                      min={1} 
                      max={30}
                      value={Math.round(settings.shortBreak/60)} 
                      onChange={(e)=>setSettings(s=>({...s, shortBreak: Math.max(1, Number(e.target.value))*60}))} 
                      className="w-full p-2 rounded-lg bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white" 
                    />
                  </label>

                  <label className="space-y-1">
                    <span className="text-sm text-slate-600 dark:text-slate-300">Long Break</span>
                    <input 
                      type="number" 
                      min={1} 
                      max={60}
                      value={Math.round(settings.longBreak/60)} 
                      onChange={(e)=>setSettings(s=>({...s, longBreak: Math.max(1, Number(e.target.value))*60}))} 
                      className="w-full p-2 rounded-lg bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white" 
                    />
                  </label>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium text-slate-900 dark:text-white mb-3">Behavior</h4>
                <div className="grid grid-cols-2 gap-4">
                  <label className="space-y-1">
                    <span className="text-sm text-slate-600 dark:text-slate-300">Cycles before long break</span>
                    <input 
                      type="number" 
                      min={1} 
                      max={10}
                      value={settings.cyclesBeforeLong} 
                      onChange={(e)=>setSettings(s=>({...s, cyclesBeforeLong: Math.max(1, Number(e.target.value))}))} 
                      className="w-full p-2 rounded-lg bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white" 
                    />
                  </label>

                  <label className="space-y-1">
                    <span className="text-sm text-slate-600 dark:text-slate-300">Daily goal</span>
                    <input 
                      type="number" 
                      min={1} 
                      max={20}
                      value={settings.dailyGoal} 
                      onChange={(e)=>setSettings(s=>({...s, dailyGoal: Math.max(1, Number(e.target.value))}))} 
                      className="w-full p-2 rounded-lg bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white" 
                    />
                  </label>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium text-slate-900 dark:text-white mb-3">Preferences</h4>
                <div className="space-y-3">
                  <label className="flex items-center gap-3">
                    <input 
                      type="checkbox" 
                      checked={settings.autoStartNext} 
                      onChange={(e)=>setSettings(s=>({...s, autoStartNext: e.target.checked}))} 
                      className="w-4 h-4 text-indigo-600 rounded border-slate-300 dark:border-slate-600"
                    />
                    <span className="text-sm text-slate-700 dark:text-slate-300">Auto-start next session</span>
                  </label>

                  <label className="flex items-center gap-3">
                    <input 
                      type="checkbox" 
                      checked={settings.sound} 
                      onChange={(e)=>setSettings(s=>({...s, sound: e.target.checked}))} 
                      className="w-4 h-4 text-indigo-600 rounded border-slate-300 dark:border-slate-600"
                    />
                    <span className="text-sm text-slate-700 dark:text-slate-300">Sound notifications</span>
                  </label>

                  <label className="flex items-center gap-3">
                    <input 
                      type="checkbox" 
                      checked={settings.notification} 
                      onChange={(e)=>setSettings(s=>({...s, notification: e.target.checked}))} 
                      className="w-4 h-4 text-indigo-600 rounded border-slate-300 dark:border-slate-600"
                    />
                    <span className="text-sm text-slate-700 dark:text-slate-300">Browser notifications</span>
                  </label>

                  <label className="space-y-1">
                    <span className="text-sm text-slate-600 dark:text-slate-300">Theme</span>
                    <select 
                      value={settings.theme} 
                      onChange={(e)=>setSettings(s=>({...s, theme: e.target.value}))} 
                      className="w-full p-2 rounded-lg bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white"
                    >
                      <option value="light">Light</option>
                      <option value="dark">Dark</option>
                      <option value="auto">Auto (System)</option>
                    </select>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TaskList({ tasks = [], onAdd, onToggle, onRemove, onSelect, selectedId }){
  const [val, setVal] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  
  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="space-y-3">
        <input 
          value={val} 
          onChange={e=>setVal(e.target.value)} 
          placeholder="Add a new task..." 
          className="w-full p-3 rounded-lg bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500" 
        />
        <div className="grid grid-cols-2 gap-2">
          <input 
            type="time" 
            value={startTime} 
            onChange={e=>setStartTime(e.target.value)} 
            placeholder="Start time" 
            className="p-2 rounded-lg bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white text-sm" 
          />
          <input 
            type="time" 
            value={endTime} 
            onChange={e=>setEndTime(e.target.value)} 
            placeholder="End time" 
            className="p-2 rounded-lg bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white text-sm" 
          />
        </div>
        <button 
          onClick={()=>{ 
            if(val.trim()){ 
              const timeRange = startTime && endTime ? `${startTime} - ${endTime}` : startTime || endTime || null;
              onAdd(val.trim(), timeRange); 
              setVal(''); 
              setStartTime(''); 
              setEndTime(''); 
            } 
          }} 
          className="w-full px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors font-medium"
        >
          Add Task
        </button>
      </div>

      <div className="flex-1 overflow-auto">
        {tasks.length === 0 ? (
          <div className="text-sm text-slate-400 dark:text-slate-500 p-6 text-center">
            No tasks for this date
          </div>
        ) : (
          <div className="space-y-2">
            {tasks.map((t) => (
              <div key={t.id} className={`p-3 rounded-lg border transition-colors ${
                selectedId===t.id 
                  ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800' 
                  : 'bg-slate-50 dark:bg-slate-700/50 border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}>
                <div className="flex items-start gap-3">
                  <input 
                    checked={t.done} 
                    onChange={() => onToggle(t.id)} 
                    type="checkbox" 
                    className="w-4 h-4 mt-0.5 text-indigo-600 rounded border-slate-300 dark:border-slate-500" 
                  />
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-medium ${
                      t.done ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-900 dark:text-white'
                    }`}>
                      {t.title}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 space-y-1">
                      {t.time && <div>Time: {t.time}</div>}
                      <div>Pomodoros: {t.pomodoros || 0}</div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => onSelect(t.id)} 
                      className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                        selectedId === t.id 
                          ? 'bg-indigo-600 text-white' 
                          : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-900/50'
                      }`}
                    >
                      {selectedId === t.id ? 'Selected' : 'Select'}
                    </button>
                    <button 
                      onClick={() => onRemove(t.id)} 
                      className="px-3 py-1 rounded text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
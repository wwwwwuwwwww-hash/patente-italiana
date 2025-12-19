
import React, { useState, useEffect, useCallback } from 'react';
import { Category, Word, QuizState, UserStats } from './types';
import { INITIAL_VOCABULARY } from './constants';
import { updateWordProgress } from './utils/spacedRepetition';
import { getWordExplanation } from './services/geminiService';
import confetti from 'canvas-confetti';

const App: React.FC = () => {
  const [view, setView] = useState<'HOME' | 'QUIZ'>('HOME');
  const [vocabulary, setVocabulary] = useState<Word[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category | 'ALL'>('ALL');
  const [quiz, setQuiz] = useState<QuizState>({
    currentWord: null,
    options: [],
    selectedIndex: null,
    isCorrect: null,
  });
  const [stats, setStats] = useState<UserStats>({
    learnedCount: 0,
    totalCorrect: 0,
    totalAttempts: 0,
  });
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [newIt, setNewIt] = useState('');
  const [newCn, setNewCn] = useState('');
  const [newCat, setNewCat] = useState<Category>(Category.GENERAL);

  const [showAiExplanation, setShowAiExplanation] = useState(false);
  const [aiText, setAiText] = useState("");
  const [loadingAi, setLoadingAi] = useState(false);
  const [shareToast, setShareToast] = useState<{show: boolean, msg: string}>({show: false, msg: ""});

  useEffect(() => {
    const savedVocab = localStorage.getItem('patente_vocab_v2');
    if (savedVocab) {
      const parsedVocab: Word[] = JSON.parse(savedVocab);
      const mergedMap = new Map<string, Word>();
      INITIAL_VOCABULARY.forEach(w => mergedMap.set(w.id, w));
      parsedVocab.forEach(p => mergedMap.set(p.id, p));
      setVocabulary(Array.from(mergedMap.values()));
    } else {
      setVocabulary(INITIAL_VOCABULARY);
    }
    const savedStats = localStorage.getItem('patente_stats_v2');
    if (savedStats) setStats(JSON.parse(savedStats));
  }, []);

  useEffect(() => {
    if (vocabulary.length > 0) {
      localStorage.setItem('patente_vocab_v2', JSON.stringify(vocabulary));
    }
  }, [vocabulary]);

  useEffect(() => {
    localStorage.setItem('patente_stats_v2', JSON.stringify(stats));
  }, [stats]);

  const fireConfetti = () => {
    const duration = 3 * 1000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };
    const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;
    const interval: any = setInterval(function() {
      const timeLeft = animationEnd - Date.now();
      if (timeLeft <= 0) return clearInterval(interval);
      const particleCount = 50 * (timeLeft / duration);
      confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
      confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
    }, 250);
  };

  const generateQuiz = useCallback((categoryOverride?: Category | 'ALL') => {
    const now = Date.now();
    const activeCategory = categoryOverride || selectedCategory;
    let pool = vocabulary.filter(w => (activeCategory === 'ALL' || w.category === activeCategory));
    if (pool.length === 0) return;

    const dueWords = pool.filter(w => w.nextReviewDate <= now);
    let selectedWord: Word;
    if (dueWords.length > 0) {
      selectedWord = dueWords[Math.floor(Math.random() * dueWords.length)];
    } else {
      const unlearned = pool.filter(w => w.repetition === 0);
      selectedWord = unlearned.length > 0 ? unlearned[Math.floor(Math.random() * unlearned.length)] : pool[Math.floor(Math.random() * pool.length)];
    }

    const otherWords = vocabulary.filter(w => w.id !== selectedWord.id);
    const wrongOptions = [...otherWords].sort(() => 0.5 - Math.random()).slice(0, 2).map(w => w.cn);
    const allOptions = [...wrongOptions, selectedWord.cn].sort(() => 0.5 - Math.random());

    setQuiz({ currentWord: selectedWord, options: allOptions, selectedIndex: null, isCorrect: null });
    setShowAiExplanation(false);
    setAiText("");
  }, [vocabulary, selectedCategory]);

  const handleSelectOption = (index: number) => {
    if (quiz.selectedIndex !== null) return;
    const isCorrect = quiz.options[index] === quiz.currentWord?.cn;
    setQuiz(prev => ({ ...prev, selectedIndex: index, isCorrect }));
    setStats(prev => ({
      ...prev,
      totalAttempts: prev.totalAttempts + 1,
      totalCorrect: isCorrect ? prev.totalCorrect + 1 : prev.totalCorrect,
    }));
    if (isCorrect) fireConfetti();
    if (quiz.currentWord) {
      const updatedWord = updateWordProgress(quiz.currentWord, isCorrect ? 5 : 0);
      setVocabulary(prev => prev.map(w => w.id === updatedWord.id ? updatedWord : w));
    }
  };

  const copyUrl = () => {
    const url = window.location.href;
    if (url.startsWith('blob:')) {
      setShareToast({show: true, msg: "检测到临时链接，请使用 GitHub Pages 部署后的网址分享。"});
    } else {
      navigator.clipboard.writeText(url).then(() => {
        setShareToast({show: true, msg: "正式链接已复制！请在 Safari 中打开并添加至主屏幕。"});
      });
    }
    setTimeout(() => setShareToast({show: false, msg: ""}), 3000);
  };

  const handleAddCustomWord = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIt || !newCn) return;
    const newWord: Word = {
      id: `custom-${Date.now()}`,
      it: newIt.trim(),
      cn: newCn.trim(),
      category: newCat,
      interval: 0,
      easeFactor: 2.5,
      nextReviewDate: 0,
      repetition: 0
    };
    setVocabulary(prev => [newWord, ...prev]);
    setNewIt(''); setNewCn(''); setShowAddModal(false);
  };

  const fetchAiExplanation = async () => {
    if (!quiz.currentWord) return;
    setLoadingAi(true);
    setShowAiExplanation(true);
    const explanation = await getWordExplanation(quiz.currentWord.it);
    setAiText(explanation);
    setLoadingAi(false);
  };

  const renderHome = () => (
    <div className="w-full max-w-4xl space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-24">
      <div className="flex flex-col sm:flex-row justify-between items-center bg-slate-900/50 p-6 rounded-[2rem] border border-slate-800 shadow-2xl backdrop-blur-md gap-4">
        <div>
          <h2 className="text-xl font-bold">词库管理 · CUSTOM</h2>
          <p className="text-slate-500 text-xs uppercase tracking-widest font-black">Manual entry system active</p>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-4 rounded-2xl font-black flex items-center justify-center gap-2 transition-all shadow-lg active:scale-95"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4" /></svg>
          添加新单词
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div 
          onClick={() => { setSelectedCategory('ALL'); setView('QUIZ'); generateQuiz('ALL'); }}
          className="col-span-1 md:col-span-2 lg:col-span-3 bg-gradient-to-br from-indigo-600 to-indigo-900 p-8 rounded-[2.5rem] shadow-2xl cursor-pointer hover:scale-[1.01] transition-all group overflow-hidden relative border border-white/10"
        >
          <div className="relative z-10 flex justify-between items-center text-white">
            <div>
              <h3 className="text-3xl font-black mb-1 italic tracking-tighter uppercase">Mixed Training</h3>
              <p className="text-indigo-200 text-sm font-bold opacity-80">全库随机 · 共计 {vocabulary.length} 词</p>
            </div>
            <div className="bg-white/10 p-5 rounded-3xl border border-white/10 group-active:scale-90 transition-transform">
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
          </div>
          <div className="absolute -right-20 -bottom-20 w-64 h-64 bg-white/5 rounded-full blur-3xl"></div>
        </div>

        {Object.values(Category).map((cat) => {
          const catWords = vocabulary.filter(w => w.category === cat);
          const learned = catWords.filter(w => w.repetition > 0).length;
          const percent = catWords.length > 0 ? Math.round((learned / catWords.length) * 100) : 0;
          return (
            <div 
              key={cat}
              onClick={() => { setSelectedCategory(cat); setView('QUIZ'); generateQuiz(cat); }}
              className="bg-slate-900 p-6 rounded-[2rem] border border-slate-800 shadow-xl hover:border-indigo-500/30 transition-all cursor-pointer active:scale-95"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-slate-800 text-indigo-400 rounded-xl"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg></div>
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{learned}/{catWords.length}</span>
              </div>
              <h4 className="text-sm font-black text-slate-100 mb-6 truncate">{cat}</h4>
              <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                <div className="bg-indigo-500 h-full" style={{ width: `${percent}%` }}></div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderQuiz = () => (
    <div className="w-full max-w-2xl animate-in zoom-in-95 duration-300 px-2 pb-32">
      <button 
        onClick={() => setView('HOME')}
        className="mb-6 flex items-center gap-2 text-slate-500 hover:text-indigo-400 transition-colors font-black uppercase text-[10px] tracking-widest"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7" /></svg>
        DASHBOARD
      </button>

      {quiz.currentWord ? (
        <main className="bg-slate-900 rounded-[3rem] shadow-2xl p-8 sm:p-12 border border-slate-800 relative">
          <div className="flex justify-between items-center mb-12">
            <span className="px-4 py-1 bg-indigo-500/10 text-indigo-400 rounded-full text-[9px] font-black tracking-widest uppercase border border-indigo-500/20">
              {quiz.currentWord.category}
            </span>
            <div className="flex gap-1">
               {[...Array(5)].map((_, i) => (
                 <div key={i} className={`w-1.5 h-1.5 rounded-full ${i < (quiz.currentWord?.repetition || 0) ? 'bg-indigo-500' : 'bg-slate-800'}`}></div>
               ))}
            </div>
          </div>

          <div className="text-center mb-16">
            <h2 className="text-5xl sm:text-6xl font-black text-white mb-6 tracking-tighter leading-tight break-words">{quiz.currentWord.it}</h2>
            {quiz.isCorrect !== null && (
              <div className="animate-in fade-in slide-in-from-top-4">
                <p className="text-3xl text-indigo-400 font-black mb-2">{quiz.currentWord.cn}</p>
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Next review in {quiz.currentWord.interval} days</span>
              </div>
            )}
          </div>

          <div className="space-y-3">
            {quiz.options.map((opt, idx) => {
              const isSelected = quiz.selectedIndex === idx;
              const isOptionCorrect = opt === quiz.currentWord?.cn;
              let btnClass = "w-full p-6 rounded-2xl border-2 text-left transition-all text-lg font-bold flex justify-between items-center ";
              
              if (quiz.selectedIndex === null) {
                btnClass += "border-slate-800 bg-slate-950/30 text-slate-300 active:scale-[0.97]";
              } else {
                if (isOptionCorrect) btnClass += "border-emerald-500 bg-emerald-500/10 text-emerald-400";
                else if (isSelected) btnClass += "border-rose-500 bg-rose-500/10 text-rose-400";
                else btnClass += "border-slate-800 text-slate-700 opacity-30";
              }

              return (
                <button key={idx} onClick={() => handleSelectOption(idx)} className={btnClass} disabled={quiz.selectedIndex !== null}>
                  <span className="pr-4">{opt}</span>
                  {quiz.selectedIndex !== null && isOptionCorrect && <div className="bg-emerald-500 text-slate-950 p-1 rounded-lg"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7"></path></svg></div>}
                </button>
              );
            })}
          </div>

          {quiz.selectedIndex !== null && (
            <div className="mt-12 flex flex-col sm:flex-row gap-4">
              <button
                onClick={() => generateQuiz()}
                className="flex-1 bg-white text-slate-950 py-5 rounded-2xl font-black text-lg shadow-xl active:scale-95 transition-all flex justify-center items-center gap-3"
              >
                继续学习
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
              </button>
              <button
                onClick={fetchAiExplanation}
                className="py-5 px-8 border-2 border-slate-800 text-slate-400 rounded-2xl active:scale-95 transition-all flex items-center justify-center"
              >
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              </button>
            </div>
          )}
        </main>
      ) : null}
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col items-center pt-12 px-4 relative">
      <header className="w-full max-w-4xl mb-12 flex flex-col items-center text-center gap-6 relative">
        <button 
           onClick={copyUrl}
           className="absolute right-0 top-0 p-3 bg-slate-900 border border-slate-800 rounded-2xl text-slate-500 active:scale-90 transition-all group"
           title="分享正式地址"
        >
          <svg className="w-5 h-5 group-hover:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
        </button>

        <div>
          <h1 className="text-4xl font-black tracking-tighter mb-1">
            PATENTE <span className="text-indigo-500 italic">PRO</span>
          </h1>
          <p className="text-slate-600 font-black uppercase tracking-[0.3em] text-[8px]">Smart Spaced Repetition</p>
        </div>
        
        <div className="flex bg-slate-900/80 backdrop-blur-md px-8 py-3 rounded-full border border-slate-800 shadow-xl">
          <div className="pr-6 border-r border-slate-800 flex flex-col items-center">
            <span className="text-[8px] text-slate-500 font-black uppercase tracking-widest mb-0.5">Mastered</span>
            <span className="text-xl font-black text-indigo-500 leading-none">{vocabulary.filter(w => w.repetition > 5).length}</span>
          </div>
          <div className="pl-6 flex flex-col items-center">
            <span className="text-[8px] text-slate-500 font-black uppercase tracking-widest mb-0.5">Correct</span>
            <span className="text-xl font-black text-white leading-none">{stats.totalCorrect}</span>
          </div>
        </div>
      </header>

      {view === 'HOME' ? renderHome() : renderQuiz()}

      {/* Share Toast */}
      {shareToast.show && (
        <div className="fixed top-10 left-1/2 -translate-x-1/2 bg-indigo-600 text-white px-8 py-4 rounded-3xl font-bold text-sm shadow-2xl z-[300] animate-in fade-in slide-in-from-top-4 max-w-[80vw] text-center">
          {shareToast.msg}
        </div>
      )}

      {/* Manual Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-xl flex items-center justify-center p-4 z-[200] animate-in fade-in duration-200">
          <div className="bg-slate-900 w-full max-w-md rounded-[2.5rem] border border-slate-800 p-8 shadow-2xl">
            <h3 className="text-xl font-black mb-8 italic tracking-tight uppercase">Add Word</h3>
            <form onSubmit={handleAddCustomWord} className="space-y-5">
              <input required value={newIt} onChange={e => setNewIt(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-5 py-4 text-lg font-bold focus:border-indigo-600 outline-none" placeholder="意大利语 (Italiano)" />
              <input required value={newCn} onChange={e => setNewCn(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-5 py-4 text-lg font-bold focus:border-indigo-600 outline-none" placeholder="中文 (Cinese)" />
              <select value={newCat} onChange={e => setNewCat(e.target.value as Category)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-5 py-4 font-bold appearance-none">
                {Object.values(Category).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 py-4 text-slate-500 font-black">CANCEL</button>
                <button type="submit" className="flex-[2] bg-indigo-600 py-4 rounded-xl font-black shadow-lg shadow-indigo-600/20 active:scale-95 transition-all">SAVE WORD</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AI Modal */}
      {showAiExplanation && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-xl flex items-center justify-center p-4 z-[200] animate-in fade-in duration-300">
          <div className="bg-slate-900 w-full max-w-lg rounded-[2.5rem] border border-slate-800 overflow-hidden shadow-2xl">
            <div className="bg-indigo-600 p-8 flex justify-between items-center text-white">
              <h3 className="text-xl font-black italic tracking-tighter">AI INSIGHT</h3>
              <button onClick={() => setShowAiExplanation(false)} className="p-2 bg-white/10 rounded-xl active:scale-90 transition-transform">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-8">
              {loadingAi ? (
                <div className="flex flex-col items-center gap-6 py-12">
                  <div className="w-12 h-12 border-4 border-slate-800 border-t-indigo-500 rounded-full animate-spin"></div>
                  <p className="text-slate-600 text-[10px] font-black uppercase tracking-widest animate-pulse">Analyzing...</p>
                </div>
              ) : (
                <div className="animate-in fade-in slide-in-from-bottom-4">
                   <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 mb-8">
                      <p className="text-slate-300 leading-relaxed text-lg italic">"{aiText}"</p>
                   </div>
                   <p className="text-slate-600 text-[8px] font-black uppercase tracking-widest text-center">Based on 2024 Exam Manuals</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <footer className="mt-auto py-12 text-slate-800 text-[8px] font-black uppercase tracking-[0.4em] text-center border-t border-slate-900 w-full max-w-4xl">
        Built for Italian Driving License Prep
      </footer>
    </div>
  );
};

export default App;

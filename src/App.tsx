import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  Phone, 
  Mic, 
  MicOff, 
  User, 
  MessageSquare, 
  Lightbulb, 
  ChevronRight, 
  Search, 
  Activity,
  History,
  TrendingUp,
  Settings,
  HelpCircle,
  FileText,
  Zap,
  Globe,
  Share2,
  Clock,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { CRMContact, TranscriptEntry, AISuggestion, Sentiment, StrategySynthesis } from './types';
import { MOCK_CONTACTS, SALES_SCRIPTS } from './constants';
import { analyzeConversation } from './services/geminiService';
import { speakText } from './services/elevenLabsService';

// --- Sub-components ---

interface StatCardProps {
  label: string;
  value: string | number;
  icon: any;
  color: string;
  trend?: string;
}

const StatCard = React.memo(({ label, value, icon: Icon, color, trend }: StatCardProps) => (
  <div className="bg-surface-800 p-4 rounded-xl border border-white/5 relative overflow-hidden group">
    <div className={`absolute top-0 right-0 w-24 h-24 ${color} opacity-[0.03] -mr-8 -mt-8 rounded-full group-hover:scale-110 transition-transform`} />
    <div className="flex items-center gap-4 relative z-10">
      <div className={`p-2.5 rounded-lg ${color} bg-opacity-10 ring-1 ring-white/10`}>
        <Icon className={`w-5 h-5 ${color.replace('bg-', 'text-')}`} />
      </div>
      <div className="flex-1">
        <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">{label}</p>
        <div className="flex items-end gap-2">
            <p className="text-xl font-bold bg-gradient-to-br from-white to-slate-400 bg-clip-text text-transparent">{value}</p>
            {trend && <span className="text-[10px] text-emerald-400 font-bold mb-1">+{trend}%</span>}
        </div>
      </div>
    </div>
  </div>
));

interface SuggestionCardProps {
  suggestion: AISuggestion;
}

const SuggestionCard = React.memo(({ suggestion }: SuggestionCardProps) => {
  const icons = useMemo(() => ({
    tactic: <Zap className="w-4 h-4" />,
    feedback: <Lightbulb className="w-4 h-4" />,
    alert: <AlertCircle className="w-4 h-4" />,
  }), []);

  const priorityColors = useMemo(() => ({
    high: 'from-red-500/20 to-transparent border-red-500/50 text-red-200',
    medium: 'from-amber-500/20 to-transparent border-amber-500/50 text-amber-200',
    low: 'from-brand/20 to-transparent border-brand/50 text-brand',
  }), []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`p-4 rounded-xl border bg-gradient-to-br ${priorityColors[suggestion.priority]} backdrop-blur-sm`}
    >
      <div className="flex items-center gap-2 mb-2">
        <div className={`p-1.5 rounded-md bg-white/10`}>{icons[suggestion.type]}</div>
        <span className="font-bold text-sm tracking-tight">{suggestion.title}</span>
      </div>
      <p className="text-xs leading-relaxed opacity-80 font-medium">{suggestion.description}</p>
    </motion.div>
  );
});

export default function App() {
  const [isCalling, setIsCalling] = useState(false);
  const [activeContact, setActiveContact] = useState<CRMContact | null>(null);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);
  const [strategy, setStrategy] = useState<StrategySynthesis | null>(null);
  const [sentiment, setSentiment] = useState<Sentiment>(Sentiment.NEUTRAL);
  const [inputText, setInputText] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState('');
  
  const recognitionRef = useRef<any>(null);
  const isListeningRef = useRef(false);
  const interimTextRef = useRef('');
  const silenceTimerRef = useRef<any>(null);
  const analysisTimerRef = useRef<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Update refs
  useEffect(() => {
    isListeningRef.current = isListening;
    interimTextRef.current = interimText;
  }, [isListening, interimText]);

  // Speech Recognition Setup
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'uz-UZ';

      recognitionRef.current.onresult = (event: any) => {
        let interim = '';
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const transcriptChunk = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            handleAddTranscript(transcriptChunk.trim(), 'customer');
            setInterimText('');
          } else {
            interim += transcriptChunk;
          }
        }
        
        if (interim) {
          setInterimText(interim);
          // Auto-commit interim after 1.5s of silence
          silenceTimerRef.current = setTimeout(() => {
            if (interimTextRef.current) {
              handleAddTranscript(interimTextRef.current.trim(), 'customer');
              setInterimText('');
            }
          }, 1500);
        }
      };

      recognitionRef.current.onend = () => {
        if (isListeningRef.current) {
          try {
            recognitionRef.current.start();
          } catch (e) {
            console.error("Failed to restart recognition:", e);
          }
        }
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech Recognition Error', event.error);
        if (event.error === 'not-allowed') {
          setIsListening(false);
        }
      };
    }
    
    return () => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    };
  }, []);

  const toggleListening = useCallback(() => {
    if (!recognitionRef.current) return;

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
      setInterimText('');
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (e) {
        console.error("Start error:", e);
      }
    }
  }, [isListening]);

  useEffect(() => {
    if (scrollRef.current) {
        scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [transcript, interimText]);

  const handleStartCall = useCallback(() => {
    setIsCalling(true);
    setActiveContact(MOCK_CONTACTS[0]);
    setTranscript([
      { id: '1', timestamp: new Date(), speaker: 'operator', text: 'Assalomu alaykum, Dilshod aka! Sadoo AI assistant orqali uchrashuvimizni boshlasak.' }
    ]);
    
    // Auto-start listening on call start
    if (recognitionRef.current && !isListeningRef.current) {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (e) {
        console.error("Auto-start mic failed:", e);
      }
    }
  }, []);

  const handleEndCall = useCallback(() => {
    setIsCalling(false);
    setActiveContact(null);
    setTranscript([]);
    setSuggestions([]);
    setStrategy(null);
    setSentiment(Sentiment.NEUTRAL);
    if (isListeningRef.current && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
      setInterimText('');
    }
    if (analysisTimerRef.current) clearTimeout(analysisTimerRef.current);
  }, []);

  const handleAddTranscript = useCallback(async (text: string, speaker: 'operator' | 'customer' = 'customer') => {
    if (!text.trim()) return;
    
    // Use a more robust prefix to prevent duplicate key errors
    const entryId = `entry-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    
    setTranscript(prev => {
      const newEntry: TranscriptEntry = {
        id: entryId,
        timestamp: new Date(),
        speaker,
        text
      };
      const updated = [...prev, newEntry];
      
      // Debounced Analysis: Clear existing timer and start a new one
      if (analysisTimerRef.current) clearTimeout(analysisTimerRef.current);
      
      analysisTimerRef.current = setTimeout(() => {
        setIsAnalyzing(true);
        const fullText = updated.map(t => `${t.speaker === 'operator' ? 'Operator' : 'Mijoz'}: ${t.text}`).join('\n');
        
        analyzeConversation(fullText).then(result => {
          setSentiment(result.sentiment);
          setSuggestions(prevS => {
            const fresh = [...result.suggestions];
            
            // Check for quota alerts in suggestions
            const hasQuotaAlert = fresh.some(s => s.description.includes('limit') || s.description.includes('band'));
            
            // Only speak if it's a real high priority suggestion and not a repeat error
            if (fresh.length > 0 && fresh[0].priority === 'high' && !hasQuotaAlert) {
              speakText(fresh[0].title + ". " + fresh[0].description);
            }
            
            return [...fresh, ...prevS].slice(0, 5);
          });
          
          if (result.strategy) {
            setStrategy((prevStrat) => {
              if (prevStrat?.methodName !== result.strategy?.methodName) {
                speakText("Yangi strategiya: " + result.strategy?.methodName);
              }
              return result.strategy;
            });
          }
          setIsAnalyzing(false);
        }).catch(() => setIsAnalyzing(false));
      }, 2500); // 2.5s debounce to save quota significantly

      return updated;
    });
    setInputText('');
  }, []);

  return (
    <div className="h-screen w-full flex bg-[#0A0C10] text-slate-200 overflow-hidden font-sans">
      
      {/* 1. LEFT: LIVE TRANSCRIPTION (4 cols) */}
      <section className="w-[30%] min-w-[350px] border-r border-white/5 flex flex-col bg-surface-900/50">
        <div className="p-5 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-brand rounded-lg flex items-center justify-center font-black text-white shadow-lg glow-blue">S</div>
                <h1 className="font-bold tracking-tight">SADOO <span className="text-brand">AI</span></h1>
            </div>
            <div className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase transition-colors ${
                sentiment === Sentiment.POSITIVE ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/20' :
                sentiment === Sentiment.NEGATIVE ? 'bg-red-500/20 text-red-400 border border-red-500/20' :
                'bg-slate-500/20 text-slate-400 border border-slate-500/20'
            }`}>
                {sentiment} Mood
            </div>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-6 no-scrollbar">
            {transcript.map((entry) => (
                <motion.div 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    key={entry.id} 
                    className={`flex flex-col ${entry.speaker === 'operator' ? 'items-end' : 'items-start'}`}
                >
                    <div className="flex items-center gap-2 mb-1 px-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                            {entry.speaker === 'operator' ? 'Siz' : 'Mijoz'}
                        </span>
                        <Clock className="w-2.5 h-2.5 text-slate-600" />
                    </div>
                    <div className={`max-w-[90%] p-3.5 rounded-2xl text-sm leading-relaxed ${
                        entry.speaker === 'operator' 
                        ? 'bg-brand/10 text-brand border border-brand/20 rounded-tr-none' 
                        : 'bg-surface-800 text-slate-300 rounded-tl-none border border-white/5'
                    }`}>
                        {entry.text}
                    </div>
                </motion.div>
            ))}
            
            {/* Interim Text Display */}
            {interimText && (
                <div className="flex flex-col items-start animate-pulse mb-6">
                    <div className="flex items-center gap-2 mb-1 px-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Mijoz gapirmoqda...</span>
                    </div>
                    <div className="max-w-[80%] p-3.5 rounded-2xl bg-white/5 text-slate-400 text-sm border border-white/5 rounded-tl-none italic">
                        {interimText}...
                    </div>
                </div>
            )}

            {isAnalyzing && (
                <div className="flex items-center gap-3 text-[10px] text-slate-500 font-medium animate-pulse">
                    <div className="flex gap-1">
                        <div className="w-1 h-1 bg-brand rounded-full animate-bounce" />
                        <div className="w-1 h-1 bg-brand rounded-full animate-bounce [animation-delay:0.2s]" />
                        <div className="w-1 h-1 bg-brand rounded-full animate-bounce [animation-delay:0.4s]" />
                    </div>
                    Tahlil qilinmoqda...
                </div>
            )}
        </div>

        <div className="p-4 bg-[#0F1218] border-t border-white/5">
            <div className="flex gap-3 mb-3">
                <button 
                    onClick={toggleListening}
                    disabled={!isCalling}
                    className={`flex-1 py-3 rounded-xl text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${
                        isListening 
                        ? 'bg-red-500/20 text-red-500 border border-red-500/50 animate-pulse' 
                        : 'bg-brand/10 text-brand border border-brand/20'
                    }`}
                >
                    {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                    {isListening ? "Mijozni eshitishni to'xtatish" : "Mijoz ovozini yoqish"}
                </button>
            </div>
            <div className="relative">
                <input 
                    type="text" 
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddTranscript(inputText)}
                    placeholder="Muloqot matnini bu yerga yozing..."
                    disabled={!isCalling}
                    className="w-full bg-[#1A1F26] border border-white/10 rounded-xl py-4 pl-5 pr-14 text-sm focus:ring-2 ring-brand/20 outline-none transition-all placeholder:text-slate-600"
                />
                <button 
                    onClick={() => handleAddTranscript(inputText)}
                    className="absolute right-2 top-2 h-10 w-10 bg-brand text-white rounded-lg flex items-center justify-center hover:scale-105 transition-transform shadow-lg shadow-brand/20"
                >
                    <ChevronRight className="w-6 h-6" />
                </button>
            </div>
        </div>
      </section>

      {/* 2. MIDDLE: AI SUGGESTIONS & STRATEGY SYNTHESIS (4 cols) */}
      <section className="flex-1 border-r border-white/5 flex flex-col bg-[#0A0C10]">
        <div className="p-5 border-b border-white/5 flex items-center gap-3">
            <Zap className="w-5 h-5 text-brand" />
            <h2 className="font-bold text-sm uppercase tracking-widest text-slate-400">Strategik Markaz</h2>
        </div>

        <div className="p-6 space-y-8 overflow-y-auto no-scrollbar">
            {/* Strategy Synthesis Block */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em]">Metodlar Kombinatsiyasi</h3>
                    <div className="h-px flex-1 bg-white/5 ml-4"></div>
                </div>
                
                <AnimatePresence mode="wait">
                    {strategy ? (
                        <motion.div 
                            key={strategy.methodName}
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="bg-brand/5 border border-brand/20 rounded-2xl p-6 relative overflow-hidden"
                        >
                            <div className="absolute top-0 right-0 p-4 opacity-10">
                                <Share2 className="w-12 h-12 text-brand" />
                            </div>
                            <div className="relative z-10">
                                <h4 className="text-brand font-black text-lg mb-1 leading-tight">{strategy.methodName}</h4>
                                <p className="text-[10px] text-slate-400 font-bold mb-4 uppercase tracking-widest">{strategy.combination}</p>
                                <div className="p-4 bg-black/40 rounded-xl border border-white/5">
                                    <p className="text-sm text-slate-200 leading-relaxed italic">
                                        "{strategy.benefit}"
                                    </p>
                                </div>
                            </div>
                        </motion.div>
                    ) : (
                        <div className="h-32 rounded-2xl border border-dashed border-white/10 flex items-center justify-center text-slate-600 text-xs text-center px-10 italic">
                            Suhbat tahlili natijasida yangi metodlar kombinatsiyasi bu yerda paydo bo'ladi...
                        </div>
                    )}
                </AnimatePresence>
            </div>

            {/* AI Suggestions Grid */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em]">Tezkor Feedback</h3>
                    <div className="h-px flex-1 bg-white/5 ml-4"></div>
                </div>
                <div className="grid grid-cols-1 gap-4">
                    {suggestions.map((s) => (
                        <SuggestionCard key={s.id} suggestion={s} />
                    ))}
                    {suggestions.length === 0 && (
                        <div className="space-y-3 opacity-20">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="h-20 bg-white/10 rounded-xl animate-pulse" />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
      </section>

      {/* 3. RIGHT: STATS & CRM (4 cols) */}
      <section className="w-[25%] min-w-[300px] flex flex-col bg-surface-900/30">
        <div className="p-5 border-b border-white/5 flex items-center justify-between">
            <h2 className="font-bold text-sm uppercase tracking-widest text-slate-400">Metrics & CRM</h2>
            {isCalling && (
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                    <span className="text-[10px] font-bold text-red-400">LIVE</span>
                </div>
            )}
        </div>

        <div className="p-6 space-y-8 overflow-y-auto no-scrollbar">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 gap-4">
                <StatCard label="O'rtacha davomiylik" value="4:12" icon={Clock} color="bg-blue-500" trend="12" />
                <StatCard label="Muvaffaqiyat ehtimoli" value="84%" icon={CheckCircle2} color="bg-emerald-500" trend="5" />
                <StatCard label="Mijoz jalb qilinganligi" value="LOW" icon={Activity} color="bg-amber-500" />
            </div>

            {/* CRM Profile Card */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em]">Mijoz Profili</h3>
                    <div className="h-px flex-1 bg-white/5 ml-4"></div>
                </div>
                {activeContact ? (
                    <div className="bg-surface-800 rounded-2xl border border-white/5 p-6 shadow-2xl">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-14 h-14 rounded-full bg-brand/20 border border-brand/30 flex items-center justify-center text-brand font-black text-xl">
                                {activeContact.name[0]}
                            </div>
                            <div>
                                <h4 className="font-bold text-lg">{activeContact.name}</h4>
                                <p className="text-[10px] text-slate-500 font-mono">{activeContact.phone}</p>
                            </div>
                        </div>
                        <div className="space-y-3">
                            <div className="flex justify-between items-center py-2 border-b border-white/5">
                                <span className="text-xs text-slate-500">Tier:</span>
                                <span className="text-xs font-bold text-amber-400">{activeContact.loyaltyTier}</span>
                            </div>
                            <div className="flex justify-between items-center py-2 border-b border-white/5">
                                <span className="text-xs text-slate-500">Xaridlar:</span>
                                <span className="text-xs font-bold">$1,240</span>
                            </div>
                        </div>
                        <button className="w-full mt-6 bg-white/5 hover:bg-white/10 text-white py-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2">
                            <History className="w-4 h-4" />
                            To'liq tarix
                        </button>
                    </div>
                ) : (
                    <div className="p-8 border border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center text-center">
                        <User className="w-8 h-8 text-slate-700 mb-2" />
                        <p className="text-[10px] text-slate-600 font-bold uppercase">Mijoz tanlanmagan</p>
                    </div>
                )}
            </div>

            {/* Action Buttons */}
            {!isCalling ? (
                <button 
                  onClick={handleStartCall}
                  className="w-full bg-brand p-4 rounded-2xl font-black text-sm uppercase tracking-widest text-white shadow-xl glow-blue hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-3"
                >
                  <Phone className="w-5 h-5" />
                  Muloqotni Boshlash
                </button>
            ) : (
                <div className="space-y-3">
                    <button 
                      onClick={handleEndCall}
                      className="w-full bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all flex items-center justify-center gap-3"
                    >
                      <Phone className="w-5 h-5 rotate-[135deg]" />
                      Tugatish
                    </button>
                    <button className="w-full bg-emerald-500 p-4 rounded-2xl font-black text-sm uppercase tracking-widest text-white shadow-xl shadow-emerald-500/20 hover:brightness-110 transition-all flex items-center justify-center gap-3">
                      <CheckCircle2 className="w-5 h-5" />
                      SOTILDI
                    </button>
                </div>
            )}
        </div>
      </section>

    </div>
  );
}

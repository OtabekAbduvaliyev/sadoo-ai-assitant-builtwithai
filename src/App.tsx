import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  ChevronRight,
  CheckCircle2,
  Zap,
  AlertTriangle,
  Info,
  TrendingUp,
  Clock,
  BarChart2,
  User,
  History,
  Layers,
  Activity,
  X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { CRMContact, TranscriptEntry, AISuggestion, Sentiment, StrategySynthesis } from './types';
import { MOCK_CONTACTS } from './constants';
import { analyzeConversation } from './services/geminiService';
import { speakText } from './services/elevenLabsService';

/* ─────────────────────────────────────
   Waveform — live mic indicator
───────────────────────────────────── */
const Waveform = ({ active }: { active: boolean }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 2, height: 16 }}>
    {[0.6, 1, 0.75, 1, 0.5].map((h, i) => (
      <div
        key={i}
        style={{
          width: 2,
          borderRadius: 2,
          background: active ? 'var(--accent)' : 'var(--text-dim)',
          height: active ? undefined : 4,
          animation: active ? `wave ${0.8 + i * 0.15}s ease-in-out infinite alternate` : 'none',
          animationDelay: `${i * 0.1}s`,
          minHeight: 4,
          maxHeight: 14,
          transform: `scaleY(${h})`,
        }}
      />
    ))}
  </div>
);

/* ─────────────────────────────────────
   Sentiment pill
───────────────────────────────────── */
const SENTIMENT_MAP: Record<string, { label: string; color: string; dot: string }> = {
  [Sentiment.POSITIVE]: { label: 'Ijobiy', color: 'var(--green-muted)', dot: 'var(--green)' },
  [Sentiment.NEGATIVE]: { label: 'Salbiy', color: 'var(--red-muted)', dot: 'var(--red)' },
  [Sentiment.NEUTRAL]: { label: 'Neytral', color: 'var(--bg-3)', dot: 'var(--text-dim)' },
};

const SentimentPill = ({ sentiment }: { sentiment: Sentiment }) => {
  const s = SENTIMENT_MAP[sentiment] ?? SENTIMENT_MAP[Sentiment.NEUTRAL];
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      background: s.color, borderRadius: 100,
      padding: '4px 10px', fontSize: 11, fontWeight: 600,
      color: 'var(--text-secondary)', letterSpacing: '0.02em',
    }}>
      <div style={{ width: 6, height: 6, borderRadius: '50%', background: s.dot, flexShrink: 0 }} />
      {s.label}
    </div>
  );
};

/* ─────────────────────────────────────
   Metric card
───────────────────────────────────── */
interface MetricProps {
  label: string;
  value: string;
  trend?: string;
  trendUp?: boolean;
  icon: React.ElementType;
  accent?: string;
}

const MetricCard = ({ label, value, trend, trendUp, icon: Icon, accent = 'var(--accent)' }: MetricProps) => (
  <div style={{
    background: 'var(--bg-2)', borderRadius: 10, padding: '14px 16px',
    display: 'flex', alignItems: 'center', gap: 12,
  }}>
    <div style={{
      width: 36, height: 36, borderRadius: 8, flexShrink: 0,
      background: `color-mix(in srgb, ${accent} 12%, transparent)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <Icon size={15} color={accent} />
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 10, color: 'var(--text-dim)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 2 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{value}</span>
        {trend && (
          <span style={{ fontSize: 10, fontWeight: 700, color: trendUp ? 'var(--green)' : 'var(--red)' }}>
            {trendUp ? '↑' : '↓'} {trend}
          </span>
        )}
      </div>
    </div>
  </div>
);

/* ─────────────────────────────────────
   Suggestion card
───────────────────────────────────── */
const PRIORITY_CONFIG = {
  high: { border: 'var(--red)', bg: 'var(--red-muted)', icon: AlertTriangle, label: 'Muhim' },
  medium: { border: 'var(--amber)', bg: 'var(--amber-muted)', icon: Info, label: "O'rta" },
  low: { border: 'var(--green)', bg: 'var(--green-muted)', icon: TrendingUp, label: 'Past' },
};

const SuggestionCard = React.memo(({ suggestion }: { suggestion: AISuggestion }) => {
  const cfg = PRIORITY_CONFIG[suggestion.priority];
  const Icon = cfg.icon;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ type: 'spring', stiffness: 320, damping: 28 }}
      style={{
        borderLeft: `2px solid ${cfg.border}`,
        background: cfg.bg,
        borderRadius: '0 8px 8px 0',
        padding: '10px 14px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <Icon size={12} color={cfg.border} />
        <span style={{ fontSize: 11, fontWeight: 700, color: cfg.border, letterSpacing: '0.04em' }}>{cfg.label}</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginLeft: 2 }}>{suggestion.title}</span>
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.55, margin: 0 }}>{suggestion.description}</p>
    </motion.div>
  );
});

/* ─────────────────────────────────────
   Transcript bubble
───────────────────────────────────── */
const Bubble: React.FC<{ entry: TranscriptEntry }> = ({ entry }) => {
  const isOp = entry.speaker === 'operator';
  return (
    <motion.div
      initial={{ opacity: 0, x: isOp ? 8 : -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2 }}
      style={{ display: 'flex', flexDirection: 'column', alignItems: isOp ? 'flex-end' : 'flex-start' }}
    >
      <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-dim)', marginBottom: 4, paddingInline: 2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
        {isOp ? 'Siz' : 'Mijoz'}
      </span>
      <div style={{
        maxWidth: '88%', padding: '9px 13px', borderRadius: isOp ? '12px 2px 12px 12px' : '2px 12px 12px 12px',
        background: isOp ? 'var(--accent)' : 'var(--bg-3)',
        color: isOp ? '#fff' : 'var(--text-primary)',
        fontSize: 13, lineHeight: 1.55,
      }}>
        {entry.text}
      </div>
    </motion.div>
  );
};

/* ─────────────────────────────────────
   Skeleton loader
───────────────────────────────────── */
const Skeleton = ({ h = 72 }: { h?: number }) => (
  <div style={{ height: h, borderRadius: 8, background: 'var(--bg-3)', overflow: 'hidden', position: 'relative' }}>
    <div style={{
      position: 'absolute', inset: 0,
      background: 'linear-gradient(90deg, transparent 0%, var(--bg-2) 50%, transparent 100%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.6s ease-in-out infinite',
    }} />
  </div>
);

/* ─────────────────────────────────────
   Section header
───────────────────────────────────── */
const SectionHead = ({ children }: { children: React.ReactNode }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>{children}</span>
    <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
  </div>
);

/* ─────────────────────────────────────
   Main App
───────────────────────────────────── */
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
  const [callSeconds, setCallSeconds] = useState(0);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isSoldSuccess, setIsSoldSuccess] = useState(false);

  const recognitionRef = useRef<any>(null);
  const isListeningRef = useRef(false);
  const interimTextRef = useRef('');
  const silenceTimerRef = useRef<any>(null);
  const analysisTimerRef = useRef<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<any>(null);

  useEffect(() => { isListeningRef.current = isListening; }, [isListening]);
  useEffect(() => { interimTextRef.current = interimText; }, [interimText]);

  /* Call timer */
  useEffect(() => {
    if (isCalling) {
      setCallSeconds(0);
      timerRef.current = setInterval(() => setCallSeconds(s => s + 1), 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [isCalling]);

  const callDuration = useMemo(() => {
    const m = Math.floor(callSeconds / 60);
    const s = callSeconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }, [callSeconds]);

  /* Speech recognition */
  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    recognitionRef.current = new SR();
    recognitionRef.current.continuous = true;
    recognitionRef.current.interimResults = true;
    recognitionRef.current.lang = 'uz-UZ';

    recognitionRef.current.onresult = (e: any) => {
      let interim = '';
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      for (let i = e.resultIndex; i < e.results.length; ++i) {
        const chunk = e.results[i][0].transcript;
        if (e.results[i].isFinal) {
          handleAddTranscript(chunk.trim(), 'customer');
          setInterimText('');
        } else {
          interim += chunk;
        }
      }
      if (interim) {
        setInterimText(interim);
        silenceTimerRef.current = setTimeout(() => {
          if (interimTextRef.current) {
            handleAddTranscript(interimTextRef.current.trim(), 'customer');
            setInterimText('');
          }
        }, 700);
      }
    };

    recognitionRef.current.onend = () => {
      if (isListeningRef.current) {
        try { recognitionRef.current.start(); } catch { }
      }
    };
    recognitionRef.current.onerror = (e: any) => {
      if (e.error === 'not-allowed') setIsListening(false);
    };
    return () => { if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current); };
  }, []);

  const toggleListening = useCallback(() => {
    if (!recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop(); setIsListening(false); setInterimText('');
    } else {
      try { recognitionRef.current.start(); setIsListening(true); } catch { }
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
    setTranscript([{ id: '1', timestamp: new Date(), speaker: 'operator', text: 'Assalomu alaykum, Dilshod aka! Sadoo AI assistant orqali uchrashuvimizni boshlasak.' }]);
    if (recognitionRef.current && !isListeningRef.current) {
      try { recognitionRef.current.start(); setIsListening(true); } catch { }
    }
  }, []);

  const handleEndCall = useCallback(() => {
    setIsCalling(false); setActiveContact(null); setTranscript([]);
    setSuggestions([]); setStrategy(null); setSentiment(Sentiment.NEUTRAL);
    if (isListeningRef.current && recognitionRef.current) {
      recognitionRef.current.stop(); setIsListening(false); setInterimText('');
    }
    if (analysisTimerRef.current) clearTimeout(analysisTimerRef.current);
  }, []);

  const handleSold = useCallback(() => {
    setIsSoldSuccess(true);
    setTimeout(() => setIsSoldSuccess(false), 5000);
    handleEndCall();
  }, [handleEndCall]);

  const handleAddTranscript = useCallback(async (text: string, speaker: 'operator' | 'customer' = 'customer') => {
    if (!text.trim()) return;
    const entryId = `entry-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;

    setTranscript(prev => {
      const newEntry: TranscriptEntry = { id: entryId, timestamp: new Date(), speaker, text };
      const updated = [...prev, newEntry];

      if (analysisTimerRef.current) clearTimeout(analysisTimerRef.current);
      analysisTimerRef.current = setTimeout(() => {
        setIsAnalyzing(true);
        const fullText = updated.map(t => `${t.speaker === 'operator' ? 'Operator' : 'Mijoz'}: ${t.text}`).join('\n');
        analyzeConversation(fullText).then(result => {
          setSentiment(result.sentiment);
          setSuggestions(result.suggestions.slice(0, 4));
          if (result.suggestions[0]?.priority === 'high') {
            speakText(result.suggestions[0].title + '. ' + result.suggestions[0].description);
          }
          if (result.strategy) {
            setStrategy(prev => {
              if (prev?.methodName !== result.strategy?.methodName) speakText('Yangi strategiya: ' + result.strategy?.methodName);
              return result.strategy;
            });
          }
          setIsAnalyzing(false);
        }).catch(() => setIsAnalyzing(false));
      }, 400);

      return updated;
    });
    setInputText('');
  }, []);

  /* ─── Render ─── */
  return (
    <>
      {/* Global styles injected once */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        :root {
          --bg-1: #F5F7FA;
          --bg-2: #FFFFFF;
          --bg-3: #EDF0F5;
          --bg-4: #E2E6ED;
          --border: rgba(0,0,0,0.07);
          --border-strong: rgba(0,0,0,0.11);

          --text-primary: #0F1623;
          --text-secondary: #4B5772;
          --text-dim: #8C97AE;

          --accent: #2563EB;
          --accent-muted: rgba(37,99,235,0.08);
          --accent-hover: #1D4ED8;

          --green: #16A34A;
          --green-muted: rgba(22,163,74,0.08);
          --red: #DC2626;
          --red-muted: rgba(220,38,38,0.07);
          --amber: #D97706;
          --amber-muted: rgba(217,119,6,0.08);

          --font: 'DM Sans', sans-serif;
          --mono: 'DM Mono', monospace;
          --radius: 12px;
        }

        html, body, #root { height: 100%; }

        body {
          font-family: var(--font);
          background: var(--bg-1);
          color: var(--text-primary);
          -webkit-font-smoothing: antialiased;
        }

        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: var(--bg-4); border-radius: 4px; }

        input::placeholder { color: var(--text-dim); }
        input:focus { outline: none; }

        button { cursor: pointer; font-family: var(--font); border: none; }

        @keyframes wave {
          from { transform: scaleY(0.4); }
          to   { transform: scaleY(1); }
        }

        @keyframes shimmer {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }

        @keyframes ping {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.4; transform: scale(1.5); }
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>

      <div style={{ height: '100vh', width: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* ══ TOP NAV BAR ══ */}
        <header style={{
          height: 52, flexShrink: 0,
          display: 'flex', alignItems: 'center', paddingInline: 20, gap: 16,
          background: 'var(--bg-2)',
          borderBottom: '1px solid var(--border)',
          zIndex: 10,
        }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <img src="/Sadoo.png" alt="Sadoo AI" style={{ height: 42, objectFit: 'contain' }} />
          </div>

          <div style={{ width: 1, height: 20, background: 'var(--border)', marginInline: 4 }} />

          {/* Sentiment */}
          <SentimentPill sentiment={sentiment} />

          {/* Spacer */}
          <div style={{ flex: 1 }} />

          {/* Live badge + timer */}
          {isCalling && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{
                  width: 7, height: 7, borderRadius: '50%', background: 'var(--red)',
                  animation: 'ping 1.2s ease-in-out infinite',
                }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--red)', letterSpacing: '0.08em' }}>JONLI</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Waveform active={isListening} />
                <span style={{ fontSize: 13, fontWeight: 600, fontFamily: 'var(--mono)', color: 'var(--text-secondary)' }}>
                  {callDuration}
                </span>
              </div>
            </div>
          )}

          {/* Call actions */}
          {!isCalling ? (
            <button
              onClick={handleStartCall}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: 'var(--accent)', color: '#fff',
                padding: '7px 14px', borderRadius: 8,
                fontSize: 12, fontWeight: 700, letterSpacing: '0.04em',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent-hover)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'var(--accent)')}
            >
              <Phone size={13} /> Muloqotni boshlash
            </button>
          ) : (
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={handleEndCall}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: 'var(--red-muted)', color: 'var(--red)',
                  border: '1px solid rgba(248,113,113,0.25)',
                  padding: '7px 14px', borderRadius: 8,
                  fontSize: 12, fontWeight: 700, letterSpacing: '0.04em',
                  transition: 'all 0.15s',
                }}
              >
                <PhoneOff size={13} /> Tugatish
              </button>
              <button
                onClick={handleSold}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: 'var(--green-muted)', color: 'var(--green)',
                  border: '1px solid rgba(34,197,94,0.25)',
                  padding: '7px 14px', borderRadius: 8,
                  fontSize: 12, fontWeight: 700, letterSpacing: '0.04em',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(34,197,94,0.12)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'var(--green-muted)')}
              >
                <CheckCircle2 size={13} /> SOTILDI
              </button>
            </div>
          )}
        </header>

        {/* ══ THREE PANEL BODY ══ */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>

          {/* ── LEFT: Transcript ── */}
          <section style={{
            width: 320, flexShrink: 0,
            display: 'flex', flexDirection: 'column',
            background: 'var(--bg-2)',
            borderRight: '1px solid var(--border)',
          }}>
            {/* Mic toggle */}
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
              <button
                onClick={toggleListening}
                disabled={!isCalling}
                style={{
                  width: '100%', padding: '9px', borderRadius: 8,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                  fontSize: 12, fontWeight: 600,
                  background: isListening ? 'rgba(248,113,113,0.1)' : 'var(--accent-muted)',
                  color: isListening ? 'var(--red)' : 'var(--accent)',
                  border: `1px solid ${isListening ? 'rgba(248,113,113,0.25)' : 'rgba(59,130,246,0.25)'}`,
                  opacity: !isCalling ? 0.4 : 1,
                  transition: 'all 0.15s',
                }}
              >
                {isListening ? <MicOff size={13} /> : <Mic size={13} />}
                {isListening ? 'Tinglashni to\'xtatish' : 'Mijoz ovozini yoqish'}
              </button>
            </div>

            {/* Messages */}
            <div
              ref={scrollRef}
              style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 14 }}
            >
              {transcript.length === 0 && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: 0.35 }}>
                  <Phone size={28} color="var(--text-dim)" />
                  <p style={{ fontSize: 12, color: 'var(--text-dim)', textAlign: 'center' }}>Muloqot hali boshlanmagan</p>
                </div>
              )}

              {transcript.map(entry => <Bubble key={entry.id} entry={entry} />)}

              {interimText && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-dim)', marginBottom: 4, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                    Mijoz gapirmoqda…
                  </span>
                  <div style={{
                    padding: '9px 13px', borderRadius: '2px 12px 12px 12px',
                    background: 'var(--bg-3)', color: 'var(--text-dim)',
                    fontSize: 13, fontStyle: 'italic',
                    border: '1px dashed var(--border-strong)',
                  }}>
                    {interimText}
                  </div>
                </div>
              )}

              {isAnalyzing && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{
                    width: 14, height: 14, borderRadius: '50%',
                    border: '2px solid var(--accent)',
                    borderTopColor: 'transparent',
                    animation: 'spin 0.7s linear infinite',
                  }} />
                  <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>Tahlil qilinmoqda…</span>
                </div>
              )}
            </div>

            {/* Text input */}
            <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', background: 'var(--bg-1)' }}>
              <div style={{ position: 'relative' }}>
                <input
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddTranscript(inputText)}
                  placeholder="Muloqot matnini yozing…"
                  disabled={!isCalling}
                  style={{
                    width: '100%', background: 'var(--bg-3)',
                    border: '1px solid var(--border-strong)', borderRadius: 8,
                    padding: '9px 40px 9px 12px',
                    fontSize: 13, color: 'var(--text-primary)',
                    opacity: !isCalling ? 0.4 : 1,
                  }}
                />
                <button
                  onClick={() => handleAddTranscript(inputText)}
                  disabled={!isCalling}
                  style={{
                    position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
                    width: 28, height: 28, borderRadius: 6,
                    background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    opacity: !isCalling ? 0.4 : 1,
                    transition: 'background 0.15s',
                  }}
                >
                  <ChevronRight size={15} color="#fff" />
                </button>
              </div>
            </div>
          </section>

          {/* ── MIDDLE: Analysis ── */}
          <section style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            background: 'var(--bg-1)', padding: '20px 24px', overflowY: 'auto',
          }}>
            <div style={{ maxWidth: 640, margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 24 }}>

              {/* Strategy */}
              <div>
                <SectionHead>Muloqot strategiyasi</SectionHead>
                {strategy ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    style={{
                      background: 'var(--bg-2)', borderRadius: 'var(--radius)',
                      padding: '20px', border: '1px solid var(--border)',
                      boxShadow: '0 2px 8px -2px rgba(0,0,0,0.04)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--accent-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Layers size={16} color="var(--accent)" />
                      </div>
                      <span style={{ fontSize: 16, fontWeight: 700 }}>{strategy.methodName}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div style={{ fontSize: 13, background: 'var(--bg-3)', padding: '10px 14px', borderRadius: 8, borderLeft: '3px solid var(--accent)' }}>
                        <div style={{ fontWeight: 700, fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 4 }}>Uslub</div>
                        {strategy.combination}
                      </div>
                      <div style={{ fontSize: 13, background: 'var(--green-muted)', padding: '10px 14px', borderRadius: 8, borderLeft: '3px solid var(--green)' }}>
                        <div style={{ fontWeight: 700, fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 4 }}>Kutilayotgan natija</div>
                        {strategy.benefit}
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <Skeleton h={140} />
                )}
              </div>

              {/* Suggestions */}
              <div>
                <SectionHead>Sun'iy intellekt tavsiyalari</SectionHead>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {suggestions.length > 0 ? (
                    <AnimatePresence mode="popLayout">
                      {suggestions.map(s => (
                        <SuggestionCard key={s.id} suggestion={s} />
                      ))}
                    </AnimatePresence>
                  ) : (
                    <>
                      <Skeleton h={72} />
                      <Skeleton h={72} />
                    </>
                  )}
                </div>
              </div>

            </div>
          </section>

          {/* ── RIGHT: Metrics + CRM ── */}
          <section style={{
            width: 280,
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--bg-2)',
          }}>
            <div style={{
              padding: '12px 20px', borderBottom: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <BarChart2 size={14} color="var(--accent)" />
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-dim)' }}>
                Metrics & CRM
              </span>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 20px', display: 'flex', flexDirection: 'column', gap: 24 }}>

              {/* Stats */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <MetricCard
                  label="O'rtacha davomiylik"
                  value="4:12"
                  trend="12%"
                  trendUp
                  icon={Clock}
                  accent="var(--accent)"
                />
                <MetricCard
                  label="Muvaffaqiyat ehtimoli"
                  value="84%"
                  trend="5%"
                  trendUp
                  icon={TrendingUp}
                  accent="var(--green)"
                />
                <MetricCard
                  label="Mijoz jalb qilinganligi"
                  value="Past"
                  icon={Activity}
                  accent="var(--amber)"
                />
              </div>

              {/* CRM */}
              <div>
                <SectionHead>Mijoz profili</SectionHead>

                {activeContact ? (
                  <div style={{
                    background: 'var(--bg-3)', border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)', padding: '14px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                      <div style={{
                        width: 40, height: 40, borderRadius: '50%',
                        background: 'var(--accent-muted)',
                        border: '1px solid rgba(59,130,246,0.25)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 15, fontWeight: 700, color: 'var(--accent)', flexShrink: 0,
                      }}>
                        {activeContact.name[0]}
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 1 }}>
                          {activeContact.name}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--mono)' }}>
                          {activeContact.phone}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                      {[
                        { label: 'Tier', value: activeContact.loyaltyTier, color: 'var(--amber)' },
                        { label: 'Jami xaridlar', value: '$1,240', color: 'var(--text-primary)' },
                        { label: 'So\'nggi xarid', value: '15 kun oldin', color: 'var(--text-secondary)' },
                      ].map((row, i) => (
                        <div key={i} style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          paddingBlock: 9,
                          borderBottom: i < 2 ? '1px solid var(--border)' : 'none',
                        }}>
                          <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>{row.label}</span>
                          <span style={{ fontSize: 12, fontWeight: 600, color: row.color }}>{row.value}</span>
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={() => setIsHistoryOpen(true)}
                      style={{
                        marginTop: 12, width: '100%', padding: '8px', borderRadius: 8,
                        background: 'var(--bg-4)', color: 'var(--text-secondary)',
                        fontSize: 12, fontWeight: 600,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        border: '1px solid var(--border)',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-2)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg-4)')}
                    >
                      <History size={12} /> To'liq tarix
                    </button>
                  </div>
                ) : (
                  <div style={{
                    padding: '32px 16px', border: '1px dashed var(--border-strong)',
                    borderRadius: 'var(--radius)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}>
                    <User size={22} color="var(--text-dim)" />
                    <span style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 600 }}>Mijoz tanlanmagan</span>
                    <span style={{ fontSize: 11, color: 'var(--text-dim)', opacity: 0.6 }}>Muloqotni boshlang</span>
                  </div>
                )}
              </div >
            </div >
          </section >

        </div >
      </div>

      <HistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        contact={activeContact}
      />

      <SuccessToast show={isSoldSuccess} />
    </>
  );
}

/* ─────────────────────────────────────
   History Modal
───────────────────────────────────── */
function HistoryModal({ isOpen, onClose, contact }: { isOpen: boolean; onClose: () => void; contact: CRMContact | null }) {
  if (!isOpen || !contact) return null;

  const historyItems = [
    { date: '2026-04-12', event: 'Uchrashuv belgilandi', type: 'call', description: 'Mijoz mahsulotga qiziqish bildirdi.' },
    { date: '2026-03-28', event: 'Taqdimot yuborildi', type: 'email', description: 'Narxlar va texnik hujjatlar.' },
    { date: '2026-03-15', event: 'Xarid amalga oshirildi', type: 'purchase', description: 'Premium paket (1 yillik).' },
  ];

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
    }}>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        style={{ position: 'absolute', inset: 0, background: 'rgba(15, 22, 35, 0.4)', backdropFilter: 'blur(4px)' }}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        style={{
          position: 'relative', width: '100%', maxWidth: 480, height: '80vh',
          background: 'var(--bg-2)', borderRadius: 16, overflow: 'hidden',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
          display: 'flex', flexDirection: 'column',
        }}
      >
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700 }}>Muloqotlar tarixi</h2>
            <p style={{ fontSize: 13, color: 'var(--text-dim)' }}>{contact.name} bilan barcha aloqalar</p>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-3)', color: 'var(--text-secondary)' }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24, position: 'relative' }}>
            <div style={{ position: 'absolute', left: 7, top: 8, bottom: 8, width: 1, background: 'var(--border)' }} />

            {historyItems.map((item, i) => (
              <div key={i} style={{ display: 'flex', gap: 16, position: 'relative' }}>
                <div style={{
                  width: 15, height: 15, borderRadius: '50%', background: 'var(--bg-2)',
                  border: `2px solid ${item.type === 'purchase' ? 'var(--green)' : 'var(--accent)'}`,
                  zIndex: 1, marginTop: 4, flexShrink: 0,
                }} />
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 4 }}>
                    {item.date}
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>
                    {item.event}
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    {item.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ padding: '16px 24px', background: 'var(--bg-1)', borderTop: '1px solid var(--border)' }}>
          <button
            onClick={onClose}
            style={{
              width: '100%', padding: '10px', borderRadius: 8,
              background: 'var(--text-primary)', color: '#fff',
              fontSize: 14, fontWeight: 600,
            }}
          >
            Yopish
          </button>
        </div>
      </motion.div>
    </div>
  );
}

/* ─────────────────────────────────────
   Success Toast
───────────────────────────────────── */
function SuccessToast({ show }: { show: boolean }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: -100, x: '-50%' }}
          animate={{ opacity: 1, y: 24 }}
          exit={{ opacity: 0, y: -100 }}
          style={{
            position: 'fixed', left: '50%', zIndex: 1000,
            background: 'var(--green)', color: '#fff',
            padding: '12px 24px', borderRadius: 100,
            boxShadow: '0 10px 25px -5px rgba(22, 163, 74, 0.4)',
            display: 'flex', alignItems: 'center', gap: 10,
            fontWeight: 700, fontSize: 15,
          }}
        >
          <CheckCircle2 size={20} />
          Muvaffaqiyatli sotildi! Tabriklaymiz! 🎉
        </motion.div>
      )}
    </AnimatePresence>
  );
}
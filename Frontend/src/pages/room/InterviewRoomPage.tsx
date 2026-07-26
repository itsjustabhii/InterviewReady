import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useParams, Link } from 'react-router-dom';
import {
  Mic, MicOff, Video, VideoOff, PhoneOff, MessageSquare,
  Users, Code, ScreenShare, Send, Settings,
} from 'lucide-react';
import clsx from 'clsx';

const CHAT_SEED = [
  { id: 1, author: 'Sarah Chen', mine: false, text: "Hi! Ready to get started? We'll do a 45-min system design followed by feedback." },
  { id: 2, author: 'You', mine: true, text: "Absolutely! I've been practising URL shortener and rate limiter designs." },
  { id: 3, author: 'Sarah Chen', mine: false, text: "Great choice. Let's start with URL shortener. Walk me through your approach." },
];

const CODE_STARTER = `// URL Shortener - System Design Notes
// ------------------------------------------

class URLShortener {
  // Step 1: Estimate scale
  // - 100M writes/day → ~1200 writes/s
  // - 10:1 read:write ratio → ~12,000 reads/s

  // Step 2: Core API
  // POST /shorten → { shortUrl }
  // GET  /:code   → 301 redirect

  // Step 3: Data model
  // urls table: id, shortCode(6 chars), longUrl, userId, createdAt, expiresAt

  // Step 4: Short code generation
  // base62 encode a counter OR MD5 hash first 6 chars

  // Step 5: Scale considerations
  // - Separate read/write services
  // - Cache popular URLs (Redis TTL)
  // - CDN at edge for most popular 1%
}
`;

export default function InterviewRoomPage() {
  const { id } = useParams();
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [tab, setTab] = useState<'chat' | 'code'>('chat');
  const [messages, setMessages] = useState(CHAT_SEED);
  const [input, setInput] = useState('');
  const [code, setCode] = useState(CODE_STARTER);
  const [elapsed, setElapsed] = useState(0);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const interval = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  };

  const sendMessage = () => {
    if (!input.trim()) return;
    setMessages((prev) => [...prev, { id: Date.now(), author: 'You', mine: true, text: input }]);
    setInput('');
  };

  return (
    <div className="h-screen bg-[#0a0a0f] text-white flex flex-col overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 bg-black/40 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
          <span className="text-sm font-medium">Live Session</span>
          <span className="px-2 py-0.5 rounded-full bg-white/10 text-xs font-mono">{formatTime(elapsed)}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-white/60">
          <Users size={14} />
          <span>Session #{id || 'b1'}</span>
        </div>
        <Link to="/" className="flex items-center gap-1.5 text-xs text-white/50 hover:text-white transition-colors">
          <Settings size={14} />
        </Link>
      </div>

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Video area */}
        <div className="flex-1 flex flex-col">
          <div className="flex-1 grid grid-cols-2 gap-2 p-3">
            {/* Remote video */}
            <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-slate-800 to-slate-900 border border-white/5">
              <img
                src="https://i.pravatar.cc/600?img=47"
                alt="Interviewer"
                className="w-full h-full object-cover opacity-80"
              />
              <div className="absolute bottom-3 left-3 px-2.5 py-1 rounded-lg bg-black/60 text-xs font-medium">
                Sarah Chen · Google
              </div>
            </div>

            {/* Local video */}
            <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-slate-700 to-slate-800 border border-white/5">
              <div className="w-full h-full flex items-center justify-center">
                {camOn ? (
                  <img
                    src="https://i.pravatar.cc/600?img=33"
                    alt="You"
                    className="w-full h-full object-cover opacity-80"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-3 text-white/40">
                    <VideoOff size={40} />
                    <span className="text-sm">Camera off</span>
                  </div>
                )}
              </div>
              <div className="absolute bottom-3 left-3 px-2.5 py-1 rounded-lg bg-black/60 text-xs font-medium">
                You
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-3 py-4 px-6 border-t border-white/5">
            <ControlBtn active={micOn} onClick={() => setMicOn(!micOn)} icon={micOn ? <Mic size={18} /> : <MicOff size={18} />} label={micOn ? 'Mute' : 'Unmute'} />
            <ControlBtn active={camOn} onClick={() => setCamOn(!camOn)} icon={camOn ? <Video size={18} /> : <VideoOff size={18} />} label={camOn ? 'Stop video' : 'Start video'} />
            <ControlBtn icon={<ScreenShare size={18} />} label="Share screen" />
            <button
              onClick={() => setTab(tab === 'chat' ? 'code' : 'chat')}
              className="flex flex-col items-center gap-1 px-4 py-2 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-all"
            >
              {tab === 'chat' ? <Code size={18} /> : <MessageSquare size={18} />}
              <span className="text-[10px]">{tab === 'chat' ? 'Code' : 'Chat'}</span>
            </button>
            <button className="flex flex-col items-center gap-1 px-4 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white transition-all ml-4">
              <PhoneOff size={18} />
              <span className="text-[10px]">End</span>
            </button>
          </div>
        </div>

        {/* Side panel */}
        <motion.div
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 340, opacity: 1 }}
          className="flex flex-col border-l border-white/10 bg-black/40 backdrop-blur-xl overflow-hidden"
          style={{ minWidth: 340 }}
        >
          {/* Panel tabs */}
          <div className="flex border-b border-white/10">
            {(['chat', 'code'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={clsx(
                  'flex-1 py-3 text-sm font-medium capitalize transition-colors',
                  tab === t ? 'text-white border-b-2 border-[var(--accent)]' : 'text-white/40 hover:text-white/70'
                )}
              >
                {t === 'chat' ? <><MessageSquare size={14} className="inline mr-1.5" />Chat</> : <><Code size={14} className="inline mr-1.5" />Whiteboard</>}
              </button>
            ))}
          </div>

          {/* Chat */}
          {tab === 'chat' && (
            <div className="flex flex-col flex-1 overflow-hidden">
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((m) => (
                  <div key={m.id} className={clsx('flex flex-col gap-1', m.mine ? 'items-end' : 'items-start')}>
                    <span className="text-xs text-white/40 px-1">{m.author}</span>
                    <div
                      className={clsx(
                        'max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed',
                        m.mine
                          ? 'bg-[var(--accent)] text-white rounded-br-md'
                          : 'bg-white/10 text-white/90 rounded-bl-md'
                      )}
                    >
                      {m.text}
                    </div>
                  </div>
                ))}
                <div ref={chatBottomRef} />
              </div>
              <div className="p-3 border-t border-white/10">
                <div className="flex items-center gap-2 bg-white/5 rounded-2xl border border-white/10 px-4 py-2.5">
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                    placeholder="Send a message..."
                    className="flex-1 bg-transparent text-sm text-white placeholder:text-white/30 outline-none"
                  />
                  <button onClick={sendMessage} className="text-[var(--accent)] hover:text-white transition-colors">
                    <Send size={16} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Code whiteboard */}
          {tab === 'code' && (
            <div className="flex-1 overflow-hidden flex flex-col">
              <div className="px-4 py-2.5 border-b border-white/10 flex items-center justify-between">
                <span className="text-xs text-white/50 font-mono">notes.ts</span>
                <span className="text-xs text-emerald-400">● shared</span>
              </div>
              <textarea
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="flex-1 bg-transparent text-xs font-mono text-slate-300 p-4 resize-none outline-none leading-relaxed"
                spellCheck={false}
              />
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}

function ControlBtn({
  icon, label, active = true, onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all',
        active
          ? 'text-white/70 hover:text-white hover:bg-white/10'
          : 'text-red-400 bg-red-500/10 hover:bg-red-500/20'
      )}
    >
      {icon}
      <span className="text-[10px]">{label}</span>
    </button>
  );
}

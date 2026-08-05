import { useRef, useEffect, useState } from 'react';
import { Send } from 'lucide-react';
import clsx from 'clsx';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { markMessagesRead } from '../../store/slices/roomSlice';
import type { Socket } from 'socket.io-client';

interface Props {
  socketRef: React.RefObject<Socket | null>;
  roomId: string | null;
}

export default function ChatPanel({ socketRef, roomId }: Props) {
  const dispatch = useAppDispatch();
  const { messages } = useAppSelector((s) => s.room);
  const { user } = useAppSelector((s) => s.auth);
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    dispatch(markMessagesRead());
  }, [dispatch]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = () => {
    const text = input.trim();
    if (!text || !socketRef.current || !roomId) return;
    socketRef.current.emit('chat-message', { roomId, text });
    setInput('');
  };

  const isMine = (senderId: string) => senderId === user?.id;

  const groupedMessages = messages.reduce<Array<{ key: string; msgs: typeof messages }>>(
    (acc, msg) => {
      const last = acc[acc.length - 1];
      if (last && last.msgs[0].senderId === msg.senderId) {
        last.msgs.push(msg);
      } else {
        acc.push({ key: msg.id, msgs: [msg] });
      }
      return acc;
    }, [] as Array<{ key: string; msgs: typeof messages }>
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {groupedMessages.length === 0 && (
          <div className="text-center py-8 text-white/30 text-sm">
            Chat is empty. Say hello!
          </div>
        )}

        {groupedMessages.map((group) => {
          const mine = isMine(group.msgs[0].senderId);
          return (
            <div key={group.key} className={clsx('flex flex-col', mine ? 'items-end' : 'items-start')}>
              {!mine && (
                <div className="flex items-center gap-2 mb-1 px-1">
                  <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[9px] font-bold text-white/60 overflow-hidden">
                    {group.msgs[0].avatar
                      ? <img src={group.msgs[0].avatar} alt="" className="w-full h-full object-cover" />
                      : group.msgs[0].senderName?.[0]}
                  </div>
                  <span className="text-xs text-white/40">{group.msgs[0].senderName}</span>
                </div>
              )}

              {group.msgs.map((m) => (
                <div
                  key={m.id}
                  className={clsx(
                    'max-w-[82%] px-3.5 py-2 text-sm leading-relaxed mb-0.5',
                    mine
                      ? 'bg-[var(--accent)] text-white rounded-2xl rounded-br-sm'
                      : 'bg-white/10 text-white/90 rounded-2xl rounded-bl-sm',
                    m.type === 'code' && 'font-mono text-xs bg-slate-800/80'
                  )}
                >
                  {m.type === 'system' ? (
                    <span className="italic text-white/40">{m.text}</span>
                  ) : m.text}
                </div>
              ))}

              <span className="text-[10px] text-white/25 px-1 mt-0.5">
                {new Date(group.msgs[group.msgs.length - 1].sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-white/5">
        <div className="flex items-center gap-2 bg-white/5 rounded-2xl border border-white/10 px-3 py-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Type a message…"
            className="flex-1 bg-transparent text-sm text-white placeholder:text-white/25 outline-none"
            maxLength={2000}
          />
          <button
            onClick={send}
            disabled={!input.trim()}
            className="text-[var(--accent)] disabled:opacity-30 hover:text-white transition-colors"
          >
            <Send size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}

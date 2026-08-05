import { useRef } from 'react';
import { Save } from 'lucide-react';
import clsx from 'clsx';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { setCodeContent } from '../../store/slices/roomSlice';
import type { Socket } from 'socket.io-client';

interface Props {
  socketRef: React.RefObject<Socket | null>;
  roomId: string | null;
}

const LANGUAGES = ['javascript', 'python', 'java', 'cpp', 'go', 'typescript', 'rust'];

export default function CodePanel({ socketRef, roomId }: Props) {
  const dispatch = useAppDispatch();
  const { codeContent } = useAppSelector((s) => s.room);
  const langRef = useRef('javascript');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChange = (val: string) => {
    dispatch(setCodeContent(val));

    // Debounce broadcast to peers (150ms)
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      socketRef.current?.emit('code-update', { roomId, content: val });
    }, 150);
  };

  const handleSave = () => {
    socketRef.current?.emit('save-code', {
      roomId,
      language: langRef.current,
      code: codeContent,
      label: `Snapshot ${new Date().toLocaleTimeString()}`,
    });
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/5 bg-black/20">
        <select
          defaultValue="javascript"
          onChange={(e) => { langRef.current = e.target.value; }}
          className="bg-transparent text-xs text-white/50 font-mono outline-none cursor-pointer"
        >
          {LANGUAGES.map((l) => (
            <option key={l} value={l} className="bg-slate-900 text-white">{l}</option>
          ))}
        </select>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-emerald-400 font-medium">● live shared</span>
          <button
            onClick={handleSave}
            className="flex items-center gap-1 text-[10px] text-white/40 hover:text-white transition-colors px-2 py-1 rounded-lg hover:bg-white/10"
          >
            <Save size={11} /> Save snapshot
          </button>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 relative overflow-hidden">
        {/* Line numbers */}
        <div className="absolute left-0 top-0 bottom-0 w-10 flex flex-col pt-4 text-right pr-2.5 text-[10px] font-mono text-white/15 select-none overflow-hidden leading-5 pointer-events-none">
          {codeContent.split('\n').map((_, idx) => (
            <span key={idx}>{idx + 1}</span>
          ))}
        </div>

        <textarea
          value={codeContent}
          onChange={(e) => handleChange(e.target.value)}
          spellCheck={false}
          className={clsx(
            'absolute inset-0 w-full h-full resize-none outline-none',
            'bg-transparent text-[13px] font-mono text-slate-200 leading-5',
            'pl-12 pt-4 pr-4 pb-4',
          )}
          style={{ tabSize: 2 }}
          onKeyDown={(e) => {
            // Tab key → insert 2 spaces
            if (e.key === 'Tab') {
              e.preventDefault();
              const s = e.currentTarget;
              const start = s.selectionStart;
              const end = s.selectionEnd;
              const next = codeContent.substring(0, start) + '  ' + codeContent.substring(end);
              handleChange(next);
              requestAnimationFrame(() => { s.selectionStart = s.selectionEnd = start + 2; });
            }
          }}
        />
      </div>
    </div>
  );
}

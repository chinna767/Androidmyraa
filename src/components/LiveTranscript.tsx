import React, { useRef, useEffect } from 'react';
import { TranscriptItem } from '../types';
import { Sparkles, User } from 'lucide-react';

interface LiveTranscriptProps {
  transcript: TranscriptItem[];
  onClearTranscript?: () => void;
}

export const LiveTranscript: React.FC<LiveTranscriptProps> = ({ transcript }) => {
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript]);

  if (transcript.length === 0) {
    return null;
  }

  return (
    <div id="live-transcript-container" className="w-full max-w-md mx-auto my-2 px-2">
      <div className="bg-slate-900/60 border border-slate-800/70 rounded-xl p-2.5 shadow-lg backdrop-blur-md max-h-32 overflow-y-auto space-y-2">
        {transcript.map((item) => (
          <div
            key={item.id}
            className={`flex items-start gap-1.5 ${
              item.speaker === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            {item.speaker === 'myraa' && (
              <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-pink-500 to-purple-600 flex items-center justify-center text-white shrink-0 mt-0.5 shadow-sm">
                <Sparkles className="w-2.5 h-2.5" />
              </div>
            )}
            <div
              className={`px-2.5 py-1 rounded-xl text-xs max-w-[85%] leading-relaxed ${
                item.speaker === 'user'
                  ? 'bg-sky-600/30 text-sky-100 border border-sky-500/30 rounded-tr-none'
                  : 'bg-slate-800/80 text-slate-200 border border-slate-700/60 rounded-tl-none'
              }`}
            >
              <p>{item.text}</p>
              {item.isStreaming && (
                <span className="inline-block w-1.5 h-2.5 ml-1 bg-pink-400 animate-pulse" />
              )}
            </div>
            {item.speaker === 'user' && (
              <div className="w-5 h-5 rounded-full bg-sky-600 flex items-center justify-center text-white shrink-0 mt-0.5 shadow-sm">
                <User className="w-2.5 h-2.5" />
              </div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
};

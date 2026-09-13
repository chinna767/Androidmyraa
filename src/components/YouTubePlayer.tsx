import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, Pause, Square, X, Music, Volume2, ExternalLink } from 'lucide-react';
import { YouTubePlayerState, systemControlManager } from '../services/SystemControlManager';

export const YouTubePlayer: React.FC = () => {
  const [playerState, setPlayerState] = useState<YouTubePlayerState>({
    isOpen: false,
    isPlaying: false,
    videoQuery: '',
    title: '',
  });

  useEffect(() => {
    const unsubscribe = systemControlManager.subscribeYouTube((state) => {
      setPlayerState(state);
    });
    return unsubscribe;
  }, []);

  if (!playerState.isOpen) return null;

  const searchQuery = encodeURIComponent(playerState.videoQuery || 'music');
  const embedUrl = `https://www.youtube.com/embed?listType=search&list=${searchQuery}&autoplay=${
    playerState.isPlaying ? '1' : '0'
  }`;

  return (
    <AnimatePresence>
      <motion.div
        id="youtube-floating-player"
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.95 }}
        className="w-full max-w-md mx-auto my-3 bg-slate-900/90 border border-purple-900/50 rounded-2xl p-3 shadow-2xl backdrop-blur-xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-red-600/30 border border-red-500/40 flex items-center justify-center text-red-400">
              <Music className="w-3.5 h-3.5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-white truncate max-w-[200px]">
                {playerState.title || playerState.videoQuery || 'YouTube Playback'}
              </p>
              <p className="text-[10px] text-slate-400">MYRAA Media Controller</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <a
              href={`https://www.youtube.com/results?search_query=${searchQuery}`}
              target="_blank"
              rel="noreferrer"
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Open in YouTube tab"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <button
              onClick={() => systemControlManager.youtube_stop()}
              className="p-1 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
              title="Close Player"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Embedded IFrame Player Container */}
        <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-black/80 border border-slate-800 mb-3 shadow-inner">
          <iframe
            src={embedUrl}
            title="YouTube video player"
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>

        {/* Media Controls Bar */}
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            {playerState.isPlaying ? (
              <button
                onClick={() => systemControlManager.youtube_pause()}
                className="flex items-center gap-1 px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-purple-300 border border-purple-500/30 transition-colors shadow-sm"
              >
                <Pause className="w-3 h-3" />
                <span>Pause</span>
              </button>
            ) : (
              <button
                onClick={() => systemControlManager.youtube_resume()}
                className="flex items-center gap-1 px-3 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-xs font-medium text-white transition-colors shadow-sm"
              >
                <Play className="w-3 h-3 fill-current" />
                <span>Resume</span>
              </button>
            )}
            <button
              onClick={() => systemControlManager.youtube_stop()}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-rose-950/60 hover:text-rose-300 text-xs font-medium text-slate-400 transition-colors"
            >
              <Square className="w-3 h-3" />
              <span>Stop</span>
            </button>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <Volume2 className="w-3.5 h-3.5 text-purple-400" />
            <span className="font-mono">{systemControlManager.getStateSnapshot().volume.level}%</span>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

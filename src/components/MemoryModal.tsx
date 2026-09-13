import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Trash2,
  Plus,
  Sparkles,
  Brain,
  Check,
  Search,
  Edit2,
  Shield,
  Clock,
  Tag,
  Star,
} from 'lucide-react';
import { MemoryEntity, MemoryCategory } from '../types';
import { memoryEngine } from '../services/MemoryEngine';

interface MemoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CATEGORIES: { label: string; value: MemoryCategory | 'ALL' }[] = [
  { label: 'All', value: 'ALL' },
  { label: 'Identity', value: 'IDENTITY' },
  { label: 'Preferences', value: 'PREFERENCES' },
  { label: 'Projects', value: 'PROJECTS' },
  { label: 'Goals', value: 'GOALS' },
  { label: 'Habits', value: 'HABITS' },
  { label: 'Relationships', value: 'RELATIONSHIPS' },
  { label: 'Conversational', value: 'CONVERSATIONAL_PREFERENCES' },
];

export const MemoryModal: React.FC<MemoryModalProps> = ({ isOpen, onClose }) => {
  const [memories, setMemories] = useState<MemoryEntity[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<MemoryCategory | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form states
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [newCategory, setNewCategory] = useState<MemoryCategory>('PREFERENCES');
  const [newImportance, setNewImportance] = useState(0.85);
  const [newIsTemporary, setNewIsTemporary] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);

  useEffect(() => {
    const unsub = memoryEngine.subscribe((data) => {
      setMemories(data);
    });
    return unsub;
  }, []);

  const filteredMemories = useMemo(() => {
    let list = memories;
    if (selectedCategory !== 'ALL') {
      list = list.filter(
        (m) =>
          m.category.toUpperCase() === selectedCategory.toUpperCase() ||
          (selectedCategory === 'PREFERENCES' && m.category === 'Preference') ||
          (selectedCategory === 'PROJECTS' && m.category === 'Project') ||
          (selectedCategory === 'GOALS' && m.category === 'Goal') ||
          (selectedCategory === 'RELATIONSHIPS' && m.category === 'Relationship')
      );
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (m) =>
          m.key.toLowerCase().includes(q) ||
          m.value.toLowerCase().includes(q) ||
          m.category.toLowerCase().includes(q)
      );
    }
    return list;
  }, [memories, selectedCategory, searchQuery]);

  const handleSaveMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKey.trim() || !newValue.trim()) return;

    let expirationAt: string | undefined = undefined;
    if (newIsTemporary) {
      const expDate = new Date();
      expDate.setDate(expDate.getDate() + 7);
      expirationAt = expDate.toISOString();
    }

    if (editingId) {
      const existing = memories.find((m) => m.memoryId === editingId || m.id === editingId);
      if (existing) {
        const updated: MemoryEntity = {
          ...existing,
          key: newKey.trim().toLowerCase().replace(/\s+/g, '_'),
          value: newValue.trim(),
          normalizedValue: newValue.toLowerCase().trim(),
          category: newCategory,
          importance: newImportance,
          expirationAt,
          updatedAt: new Date().toISOString(),
        };
        await memoryEngine.saveMemory(
          updated.key,
          updated.value,
          updated.category,
          'manual',
          updated.importance
        );
        setSaveFeedback('Memory updated successfully');
      }
    } else {
      const result = await memoryEngine.saveMemory(
        newKey.trim(),
        newValue.trim(),
        newCategory,
        'manual',
        newImportance
      );
      if (result.success) {
        setSaveFeedback('Memory saved to persistent storage');
      } else {
        setSaveFeedback(result.error || 'Failed to save memory');
      }
    }

    setTimeout(() => setSaveFeedback(null), 2500);
    resetForm();
  };

  const resetForm = () => {
    setNewKey('');
    setNewValue('');
    setNewCategory('PREFERENCES');
    setNewImportance(0.85);
    setNewIsTemporary(false);
    setIsAdding(false);
    setEditingId(null);
  };

  const handleStartEdit = (mem: MemoryEntity) => {
    setEditingId(mem.memoryId || mem.id || '');
    setNewKey(mem.key);
    setNewValue(mem.value);
    setNewCategory(mem.category);
    setNewImportance(mem.importance || 0.8);
    setNewIsTemporary(!!mem.expirationAt);
    setIsAdding(true);
  };

  const handleDelete = async (id: string) => {
    await memoryEngine.deleteMemory(id);
    setSaveFeedback('Memory removed from storage');
    setTimeout(() => setSaveFeedback(null), 2000);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-2xl bg-slate-900 border border-purple-900/60 rounded-2xl shadow-2xl p-6 overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-600/30 border border-purple-500/40 flex items-center justify-center text-purple-300">
                <Brain className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>MYRAA&apos;s Long-Term Memory</span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-purple-950 text-purple-300 border border-purple-800 font-mono">
                    {memories.length} active
                  </span>
                </h2>
                <p className="text-xs text-slate-400">
                  Durable persistent memory engine across sessions, restarts, and months for Chinna
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Search & Category Filter Pills */}
          <div className="pt-3 pb-2 space-y-2.5">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search persistent memories by key, value, or topic..."
                className="w-full bg-slate-950 border border-slate-800 focus:border-purple-500 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none transition-colors"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-[11px]">
              {CATEGORIES.map((cat) => {
                const isActive = selectedCategory === cat.value;
                return (
                  <button
                    key={cat.value}
                    onClick={() => setSelectedCategory(cat.value)}
                    className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition-all ${
                      isActive
                        ? 'bg-purple-600 text-white shadow-sm'
                        : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    {cat.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Add / Edit Form */}
          <div className="py-2.5 border-b border-slate-800">
            {!isAdding ? (
              <button
                onClick={() => {
                  resetForm();
                  setIsAdding(true);
                }}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-dashed border-purple-500/40 hover:border-purple-500/80 bg-purple-950/20 hover:bg-purple-950/40 text-xs font-semibold text-purple-300 transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>Add Persistent Memory for Chinna</span>
              </button>
            ) : (
              <form
                onSubmit={handleSaveMemory}
                className="space-y-3 bg-slate-950/80 p-3.5 rounded-xl border border-purple-900/50"
              >
                <div className="flex items-center justify-between text-xs font-semibold text-purple-300">
                  <span>{editingId ? 'Edit Memory Record' : 'New Memory Record'}</span>
                  <button
                    type="button"
                    onClick={resetForm}
                    className="text-slate-400 hover:text-white text-[11px]"
                  >
                    Cancel
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Memory Key (e.g. favorite_game)"
                    value={newKey}
                    onChange={(e) => setNewKey(e.target.value)}
                    className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 font-mono"
                    required
                  />
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as MemoryCategory)}
                    className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500"
                  >
                    <option value="IDENTITY">IDENTITY (Name, Identity)</option>
                    <option value="PREFERENCES">PREFERENCES (Games, Food, Music)</option>
                    <option value="PROJECTS">PROJECTS (MYRAA, Apps, Code)</option>
                    <option value="GOALS">GOALS (Career, Learning)</option>
                    <option value="HABITS">HABITS (Routines, Work times)</option>
                    <option value="RELATIONSHIPS">RELATIONSHIPS (Family, Friends)</option>
                    <option value="CONVERSATIONAL_PREFERENCES">CONVERSATIONAL STYLE</option>
                  </select>
                </div>

                <textarea
                  placeholder="Memory detail / fact (e.g. Chinna's favorite game is Minecraft)..."
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  rows={2}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 resize-none"
                  required
                />

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <div className="flex items-center gap-4 text-[11px] text-slate-400">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newIsTemporary}
                        onChange={(e) => setNewIsTemporary(e.target.checked)}
                        className="rounded border-slate-700 text-purple-600 focus:ring-0"
                      />
                      <span>Temporary (Expires in 7 days)</span>
                    </label>

                    <div className="flex items-center gap-1">
                      <span>Importance:</span>
                      <span className="font-mono text-purple-300 font-bold">
                        {Math.round(newImportance * 100)}%
                      </span>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-xs font-semibold text-white transition-colors shadow-md"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{editingId ? 'Update Memory' : 'Save to Memory'}</span>
                  </button>
                </div>
              </form>
            )}

            {saveFeedback && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-2 flex items-center justify-center gap-1.5 text-xs font-medium text-emerald-400 bg-emerald-950/30 border border-emerald-800/40 py-1 rounded-lg"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{saveFeedback}</span>
              </motion.div>
            )}
          </div>

          {/* Memory List */}
          <div className="flex-1 overflow-y-auto py-3 space-y-2.5 pr-1">
            {filteredMemories.length === 0 ? (
              <div className="py-8 text-center text-slate-500 text-xs">
                No persistent memories found matching criteria.
              </div>
            ) : (
              filteredMemories.map((mem) => (
                <div
                  key={mem.memoryId || mem.id}
                  className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/90 hover:border-purple-900/60 transition-all flex items-start justify-between gap-3 group"
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold text-purple-300 font-mono">
                        {mem.key}
                      </span>
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-purple-950/90 text-purple-300 border border-purple-800/60">
                        {mem.category}
                      </span>
                      <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                        <Star className="w-2.5 h-2.5 text-amber-400" />
                        {Math.round((mem.importance || 0.8) * 100)}%
                      </span>
                      {mem.source && (
                        <span className="text-[10px] text-slate-500 font-mono">
                          via {mem.source.toLowerCase()}
                        </span>
                      )}
                      {mem.expirationAt && (
                        <span className="text-[10px] text-amber-400/90 flex items-center gap-0.5 bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-900/40">
                          <Clock className="w-2.5 h-2.5" />
                          temp
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-200 leading-relaxed break-words">
                      {mem.value}
                    </p>
                    <div className="flex items-center gap-3 text-[10px] text-slate-500 font-mono">
                      <span>Updated {new Date(mem.updatedAt).toLocaleDateString()}</span>
                      {mem.accessCount ? <span>Accessed {mem.accessCount}x</span> : null}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleStartEdit(mem)}
                      title="Edit memory"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-purple-300 hover:bg-purple-950/40 transition-colors"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(mem.memoryId || mem.id || '')}
                      title="Delete / Forget memory"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer Persistence Status */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
            <div className="flex items-center gap-1.5 text-emerald-400">
              <Shield className="w-3.5 h-3.5" />
              <span>ACID Persistent Storage Active (IndexedDB + LocalStorage)</span>
            </div>
            <span>Survives Restarts &amp; Sessions</span>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

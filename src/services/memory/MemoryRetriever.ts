import { MemoryEntity } from '../../types';
import { MemoryRepository } from './MemoryRepository';

export interface RankedMemory {
  entity: MemoryEntity;
  relevanceScore: number;
}

export class MemoryRetriever {
  /**
   * Retrieves the most relevant memories for a given conversation prompt.
   * Filters out irrelevant memories to avoid overloading context.
   */
  public static async retrieveRelevantMemories(
    prompt: string,
    repository: MemoryRepository,
    limit: number = 6
  ): Promise<MemoryEntity[]> {
    const activeMemories = repository.getAllActiveMemories();
    if (activeMemories.length === 0) return [];

    const promptTerms = this.tokenize(prompt);
    const now = Date.now();
    const ranked: RankedMemory[] = [];

    for (const mem of activeMemories) {
      const score = this.calculateRelevance(mem, promptTerms, prompt, now);
      if (score > 0.25 || mem.category === 'IDENTITY' || mem.importance >= 0.95) {
        ranked.push({ entity: mem, relevanceScore: score });
      }
    }

    // Sort by relevance score descending
    ranked.sort((a, b) => b.relevanceScore - a.relevanceScore);

    const results = ranked.slice(0, limit).map((r) => r.entity);

    // Asynchronously mark accessed
    for (const mem of results) {
      repository.markAccessed(mem.memoryId).catch(() => {});
    }

    return results;
  }

  private static calculateRelevance(
    mem: MemoryEntity,
    promptTerms: string[],
    rawPrompt: string,
    now: number
  ): number {
    const memTerms = this.tokenize(`${mem.key} ${mem.value} ${mem.category}`);
    const lowerPrompt = rawPrompt.toLowerCase();

    // 1. Semantic overlap (Jaccard + keyword boost)
    let overlapCount = 0;
    for (const term of promptTerms) {
      if (memTerms.includes(term)) {
        overlapCount++;
      }
    }
    const overlapRatio = promptTerms.length > 0 ? overlapCount / promptTerms.length : 0;

    // Direct substring or specific category hit
    let directBoost = 0;
    if (lowerPrompt.includes(mem.key.toLowerCase())) directBoost += 0.3;
    if (lowerPrompt.includes(mem.normalizedValue)) directBoost += 0.3;

    // Topic matching
    if (
      (lowerPrompt.includes('game') || lowerPrompt.includes('play')) &&
      (mem.key.includes('game') || mem.category === 'PREFERENCES')
    ) {
      directBoost += 0.35;
    }
    if (
      (lowerPrompt.includes('song') || lowerPrompt.includes('music')) &&
      (mem.key.includes('music') || mem.key.includes('song'))
    ) {
      directBoost += 0.35;
    }
    if (
      (lowerPrompt.includes('project') || lowerPrompt.includes('myraa') || lowerPrompt.includes('building')) &&
      mem.category === 'PROJECTS'
    ) {
      directBoost += 0.35;
    }

    const semanticScore = Math.min(1.0, overlapRatio * 2 + directBoost);

    // 2. Importance & Confidence
    const importanceScore = mem.importance;
    const confidenceScore = mem.confidence;

    // 3. Recency (exponential decay over 30 days)
    const ageDays = (now - new Date(mem.updatedAt).getTime()) / (1000 * 60 * 60 * 24);
    const recencyScore = Math.max(0.1, Math.exp(-ageDays / 30));

    // 4. Frequency
    const frequencyScore = Math.min(1.0, (mem.accessCount || 0) / 10);

    // Weighted composite score:
    // Semantic: 45%, Importance: 25%, Confidence: 15%, Recency: 10%, Frequency: 5%
    const totalScore =
      semanticScore * 0.45 +
      importanceScore * 0.25 +
      confidenceScore * 0.15 +
      recencyScore * 0.10 +
      frequencyScore * 0.05;

    return Math.round(totalScore * 100) / 100;
  }

  private static tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 2 && !STOP_WORDS.has(t));
  }
}

const STOP_WORDS = new Set([
  'the',
  'and',
  'that',
  'this',
  'with',
  'from',
  'what',
  'when',
  'where',
  'which',
  'who',
  'why',
  'how',
  'for',
  'about',
  'you',
  'your',
  'are',
  'was',
  'were',
  'will',
  'would',
  'can',
  'could',
  'should',
]);

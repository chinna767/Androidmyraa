import { MemoryRepository } from './MemoryRepository';

export interface ForgetResult {
  success: boolean;
  forgottenCount: number;
  message: string;
  forgottenKeys: string[];
}

export class MemoryForgetter {
  public static async forget(
    keyword: string,
    repository: MemoryRepository
  ): Promise<ForgetResult> {
    const kw = keyword.toLowerCase().trim();
    if (!kw) {
      return {
        success: false,
        forgottenCount: 0,
        message: "I'm not sure which memory you'd like me to forget, Chinna.",
        forgottenKeys: [],
      };
    }

    const activeMemories = repository.getAllActiveMemories();
    const toForget = activeMemories.filter((m) => {
      const k = m.key.toLowerCase();
      const v = m.value.toLowerCase();
      const cat = m.category.toLowerCase();
      return k.includes(kw) || v.includes(kw) || kw.includes(k) || kw.includes(v) || cat.includes(kw);
    });

    if (toForget.length === 0) {
      return {
        success: true,
        forgottenCount: 0,
        message: "I couldn't find any saved memory matching that to forget, Chinna.",
        forgottenKeys: [],
      };
    }

    const forgottenKeys: string[] = [];
    for (const mem of toForget) {
      const ok = await repository.deleteMemory(mem.memoryId);
      if (ok) {
        forgottenKeys.push(mem.key);
      }
    }

    if (forgottenKeys.length > 0) {
      return {
        success: true,
        forgottenCount: forgottenKeys.length,
        message: "Okay, I've forgotten that.",
        forgottenKeys,
      };
    } else {
      return {
        success: false,
        forgottenCount: 0,
        message: "I couldn't remove that memory just now.",
        forgottenKeys: [],
      };
    }
  }
}

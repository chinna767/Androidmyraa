export class CodeAnalyzer {
  private static instance: CodeAnalyzer | null = null;

  private constructor() {}

  public static getInstance(): CodeAnalyzer {
    if (!CodeAnalyzer.instance) {
      CodeAnalyzer.instance = new CodeAnalyzer();
    }
    return CodeAnalyzer.instance;
  }

  /**
   * Detects if the user query is explicitly asking for code explanation, code modification, or output prediction.
   */
  public isCodeRelatedQuery(query: string): boolean {
    const q = query.toLowerCase();
    return (
      q.includes('code') ||
      q.includes('function') ||
      q.includes('variable') ||
      q.includes('method') ||
      q.includes('class') ||
      q.includes('explain this') ||
      q.includes('what does this do') ||
      q.includes('what will happen if I change') ||
      q.includes('what happens if I change') ||
      q.includes('can I change this') ||
      q.includes('what will be the output') ||
      q.includes('what is the output') ||
      q.includes('predict the output') ||
      q.includes('programming language') ||
      q.includes('syntax') ||
      q.includes('kotlin') ||
      q.includes('java') ||
      q.includes('python') ||
      q.includes('javascript') ||
      q.includes('typescript') ||
      q.includes('c++') ||
      q.includes('rust') ||
      q.includes('smali')
    );
  }

  /**
   * Distinguishes code modification queries ("What happens if I change X?")
   */
  public isCodeChangeQuery(query: string): boolean {
    const q = query.toLowerCase();
    return (
      q.includes('if i change') ||
      q.includes('if i modify') ||
      q.includes('can i change') ||
      q.includes('can i set this to') ||
      q.includes('what happens if i change') ||
      q.includes('what will happen if i change')
    );
  }

  /**
   * Distinguishes output prediction queries ("What will the output be?")
   */
  public isOutputPredictionQuery(query: string): boolean {
    const q = query.toLowerCase();
    return (
      q.includes('what will the output be') ||
      q.includes('what is the output') ||
      q.includes('what will be the output') ||
      q.includes('predict the output') ||
      q.includes('what does it print') ||
      q.includes('what does this return')
    );
  }
}

export const codeAnalyzer = CodeAnalyzer.getInstance();

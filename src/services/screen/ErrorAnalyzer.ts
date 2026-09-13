export class ErrorAnalyzer {
  private static instance: ErrorAnalyzer | null = null;

  private constructor() {}

  public static getInstance(): ErrorAnalyzer {
    if (!ErrorAnalyzer.instance) {
      ErrorAnalyzer.instance = new ErrorAnalyzer();
    }
    return ErrorAnalyzer.instance;
  }

  /**
   * Detects if the user query is asking about an error, bug, or debugging.
   */
  public isErrorOrDebugQuery(query: string): boolean {
    const q = query.toLowerCase();
    return (
      q.includes('wrong') ||
      q.includes('error') ||
      q.includes('exception') ||
      q.includes('crash') ||
      q.includes('debug') ||
      q.includes('bug') ||
      q.includes('failed') ||
      q.includes('failure') ||
      q.includes('stack trace') ||
      q.includes('nullpointer') ||
      q.includes("why isn't this working") ||
      q.includes('why is this failing') ||
      q.includes('why am i getting')
    );
  }
}

export const errorAnalyzer = ErrorAnalyzer.getInstance();

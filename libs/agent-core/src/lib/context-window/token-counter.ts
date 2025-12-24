/**
 * Token counting utilities for context window management
 * 
 * This uses a simple approximation for token counting.
 * For production, consider using tiktoken or model-specific tokenizers.
 */

/**
 * Model-specific token estimation ratios
 * These are approximate values - actual tokenization varies
 */
const MODEL_TOKEN_RATIOS: Record<string, number> = {
  'llama3': 4.0,      // ~4 chars per token
  'llama3.1': 4.0,
  'llama3.2': 4.0,
  'llama2': 4.0,
  'mistral': 4.0,
  'mixtral': 4.0,
  'codellama': 3.5,   // Code models tend to have smaller tokens
  'deepseek-coder': 3.5,
  'phi3': 4.0,
  'gemma': 4.0,
  'qwen': 3.8,
  'default': 4.0,
};

/**
 * Maximum context sizes for common models
 */
export const MODEL_CONTEXT_SIZES: Record<string, number> = {
  'llama3': 8192,
  'llama3.1': 131072,  // 128K context
  'llama3.2': 131072,
  'llama2': 4096,
  'mistral': 32768,    // 32K context
  'mixtral': 32768,
  'codellama': 16384,
  'deepseek-coder': 16384,
  'phi3': 128000,
  'gemma': 8192,
  'qwen': 32768,
  'default': 4096,
};

export class TokenCounter {
  private modelName: string;
  private tokenRatio: number;

  constructor(modelName = 'default') {
    this.modelName = this.normalizeModelName(modelName);
    this.tokenRatio = MODEL_TOKEN_RATIOS[this.modelName] || MODEL_TOKEN_RATIOS['default'];
  }

  /**
   * Normalize model name for lookup
   */
  private normalizeModelName(name: string): string {
    const normalized = name.toLowerCase().split(':')[0]; // Remove version tags like :latest
    
    // Match known models
    for (const known of Object.keys(MODEL_TOKEN_RATIOS)) {
      if (normalized.includes(known)) {
        return known;
      }
    }
    
    return 'default';
  }

  /**
   * Count tokens in a string (approximate)
   */
  countTokens(text: string): number {
    if (!text) return 0;

    // More accurate estimation:
    // 1. Split by whitespace and punctuation
    // 2. Account for subword tokenization
    
    // Count words
    const words = text.split(/\s+/).filter(w => w.length > 0);
    
    // Count punctuation (often separate tokens)
    const punctuation = (text.match(/[.,!?;:'"()[\]{}]/g) || []).length;
    
    // Count numbers (often split into multiple tokens)
    const numberMatches: string[] = text.match(/\d+/g) ?? [];
    let numbers = 0;
    for (const n of numberMatches) {
      numbers += Math.ceil(n.length / 3);
    }
    
    // Base token count from character estimation
    const charBasedEstimate = Math.ceil(text.length / this.tokenRatio);
    
    // Word-based estimate (average 1.3 tokens per word for English)
    const wordBasedEstimate = Math.ceil(words.length * 1.3);
    
    // Take the average of estimates for better accuracy
    const estimate = Math.ceil((charBasedEstimate + wordBasedEstimate) / 2) + punctuation + numbers;
    
    // Add overhead for special tokens
    return estimate + 4; // BOS, EOS, and formatting tokens
  }

  /**
   * Count tokens for a message with role overhead
   */
  countMessageTokens(role: string, content: string): number {
    const contentTokens = this.countTokens(content);
    
    // Add overhead for role formatting
    // Most models use special tokens for role demarcation
    const roleOverhead = 4; // <role>, </role>, newlines, etc.
    
    return contentTokens + roleOverhead;
  }

  /**
   * Count total tokens for an array of messages
   */
  countMessagesTokens(messages: Array<{ role: string; content: string }>): number {
    let total = 0;
    
    for (const msg of messages) {
      total += this.countMessageTokens(msg.role, msg.content);
    }
    
    // Add conversation structure overhead
    total += 3; // Beginning and end of conversation markers
    
    return total;
  }

  /**
   * Get the maximum context size for the model
   */
  getMaxContextSize(): number {
    return MODEL_CONTEXT_SIZES[this.modelName] || MODEL_CONTEXT_SIZES['default'];
  }

  /**
   * Calculate how many tokens are available
   */
  getAvailableTokens(usedTokens: number): number {
    return Math.max(0, this.getMaxContextSize() - usedTokens);
  }

  /**
   * Check if text would exceed available tokens
   */
  wouldExceed(text: string, usedTokens: number, reservedTokens = 0): boolean {
    const textTokens = this.countTokens(text);
    const maxAvailable = this.getMaxContextSize() - usedTokens - reservedTokens;
    return textTokens > maxAvailable;
  }

  /**
   * Truncate text to fit within token limit
   */
  truncateToFit(text: string, maxTokens: number): string {
    if (this.countTokens(text) <= maxTokens) {
      return text;
    }

    // Binary search for optimal truncation point
    let low = 0;
    let high = text.length;
    
    while (low < high) {
      const mid = Math.floor((low + high + 1) / 2);
      const truncated = text.slice(0, mid);
      
      if (this.countTokens(truncated) <= maxTokens) {
        low = mid;
      } else {
        high = mid - 1;
      }
    }

    // Truncate at word boundary if possible
    const truncated = text.slice(0, low);
    const lastSpace = truncated.lastIndexOf(' ');
    
    if (lastSpace > low * 0.8) {
      return truncated.slice(0, lastSpace) + '...';
    }
    
    return truncated + '...';
  }
}


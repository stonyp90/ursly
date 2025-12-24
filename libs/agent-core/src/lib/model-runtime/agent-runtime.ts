import { Injectable, Logger, Inject, Optional } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import {
  IModelRuntime,
  IRAGService,
  IContextLearningService,
  MODEL_RUNTIME,
  RAG_SERVICE,
  CONTEXT_LEARNING_SERVICE,
  ModelInstance,
  ModelStartOptions,
  GenerationResponse,
  GenerationChunk,
  RAGDocument,
  RAGQueryOptions,
  ContextSource,
} from './model-runtime.types';
import {
  IContextWindowManager,
  CONTEXT_WINDOW_MANAGER,
  ContextWindowConfig,
  Message,
  TokenUsageStats,
  ContextRotationResult,
} from '../context-window';

/**
 * Agent runtime configuration
 */
export interface AgentRuntimeConfig {
  agentId: string;
  model: string;
  systemPrompt?: string;
  contextConfig?: Partial<ContextWindowConfig>;
  enableLearning?: boolean;
  enableRAG?: boolean;
  ragTopK?: number;
}

/**
 * Generation options with context injection
 */
export interface AgentGenerationOptions {
  /** Additional context sources to inject */
  contextSources?: ContextSource[];
  /** Use RAG to find relevant context */
  useRAG?: boolean;
  /** RAG query options */
  ragOptions?: RAGQueryOptions;
  /** Include learned context */
  includeLearnedContext?: boolean;
  /** Custom system prompt override */
  systemPromptOverride?: string;
  /** Stream response */
  stream?: boolean;
  /** Images for multimodal models */
  images?: string[];
}

/**
 * Agent generation result
 */
export interface AgentGenerationResult {
  response: string;
  model: string;
  tokenUsage: TokenUsageStats;
  contextRotated: boolean;
  windowNumber: number;
  ragDocumentsUsed?: number;
  learnedContextUsed?: boolean;
}

/**
 * Agent Runtime
 * 
 * Unified interface for running AI agents with:
 * - Model lifecycle management (start/stop/switch)
 * - Context window management with auto-rotation
 * - RAG-enhanced generation
 * - Context learning from conversations
 * - Dynamic context injection
 */
@Injectable()
export class AgentRuntime {
  private readonly logger = new Logger(AgentRuntime.name);
  private agentConfigs: Map<string, AgentRuntimeConfig> = new Map();
  private activeAgents: Set<string> = new Set();

  constructor(
    @Inject(MODEL_RUNTIME)
    private readonly modelRuntime: IModelRuntime,
    @Inject(CONTEXT_WINDOW_MANAGER)
    private readonly contextManager: IContextWindowManager,
    @Optional()
    @Inject(RAG_SERVICE)
    private readonly ragService?: IRAGService,
    @Optional()
    @Inject(CONTEXT_LEARNING_SERVICE)
    private readonly learningService?: IContextLearningService,
  ) {
    this.logger.log('Agent Runtime initialized');
  }

  /**
   * Initialize an agent with configuration
   */
  async initializeAgent(config: AgentRuntimeConfig): Promise<void> {
    const { agentId, model, systemPrompt, contextConfig } = config;

    this.logger.log(`Initializing agent ${agentId} with model ${model}`);

    // Store config
    this.agentConfigs.set(agentId, config);

    // Create context window
    this.contextManager.createWindow(agentId, {
      ...contextConfig,
      modelName: model,
    });

    // Add system prompt if provided
    if (systemPrompt) {
      this.contextManager.addMessage(agentId, {
        role: 'system',
        content: systemPrompt,
      });
    }

    this.activeAgents.add(agentId);
    this.logger.log(`Agent ${agentId} initialized successfully`);
  }

  /**
   * Start the model for an agent
   */
  async startModel(agentId: string, options?: ModelStartOptions): Promise<ModelInstance> {
    const config = this.getAgentConfig(agentId);
    return this.modelRuntime.start(config.model, options);
  }

  /**
   * Stop the model for an agent
   */
  async stopModel(agentId: string): Promise<void> {
    const config = this.getAgentConfig(agentId);
    await this.modelRuntime.stop(config.model);
  }

  /**
   * Switch to a different model for an agent
   */
  async switchModel(agentId: string, newModel: string): Promise<ModelInstance> {
    const config = this.getAgentConfig(agentId);
    const oldModel = config.model;

    // Update config
    config.model = newModel;
    this.agentConfigs.set(agentId, config);

    // Switch model runtime
    const instance = await this.modelRuntime.switchModel(oldModel, newModel);

    this.logger.log(`Agent ${agentId} switched from ${oldModel} to ${newModel}`);
    return instance;
  }

  /**
   * Generate a response with full context management
   */
  async generate(
    agentId: string,
    userPrompt: string,
    options: AgentGenerationOptions = {}
  ): Promise<AgentGenerationResult> {
    const config = this.getAgentConfig(agentId);
    let contextRotated = false;
    let ragDocumentsUsed = 0;
    let learnedContextUsed = false;

    // Check for context rotation
    if (this.contextManager.shouldRotate(agentId)) {
      await this.contextManager.rotateWindow(agentId);
      contextRotated = true;
    }

    // Build enhanced context
    let enhancedPrompt = userPrompt;

    // 1. Inject RAG context if enabled
    if ((config.enableRAG || options.useRAG) && this.ragService) {
      const ragContext = await this.buildRAGContext(userPrompt, options.ragOptions);
      if (ragContext.documents.length > 0) {
        enhancedPrompt = `${ragContext.contextString}\n\n---\n\nUser: ${userPrompt}`;
        ragDocumentsUsed = ragContext.documents.length;
      }
    }

    // 2. Inject learned context if enabled
    if ((config.enableLearning || options.includeLearnedContext) && this.learningService) {
      const learnedContext = await this.learningService.getLearnedContext(
        agentId,
        userPrompt,
        { topK: 3 }
      );
      if (learnedContext) {
        enhancedPrompt = `[Relevant learned context]\n${learnedContext}\n\n${enhancedPrompt}`;
        learnedContextUsed = true;
      }
    }

    // 3. Inject custom context sources
    if (options.contextSources && options.contextSources.length > 0) {
      const contextString = options.contextSources
        .map(s => `[${s.type}: ${s.id}]\n${s.content}`)
        .join('\n\n');
      enhancedPrompt = `${contextString}\n\n---\n\n${enhancedPrompt}`;
    }

    // Add user message to context
    this.contextManager.addMessage(agentId, {
      role: 'user',
      content: enhancedPrompt,
    });

    // Get all context messages
    const contextMessages = this.contextManager.getContextMessages(agentId);

    // Apply system prompt override if provided
    if (options.systemPromptOverride) {
      const sysIndex = contextMessages.findIndex(m => m.role === 'system');
      if (sysIndex >= 0) {
        contextMessages[sysIndex] = {
          ...contextMessages[sysIndex],
          content: options.systemPromptOverride,
        };
      }
    }

    // Generate response
    const messages = contextMessages.map(m => ({
      role: m.role,
      content: m.content,
      images: options.images,
    }));

    const response = await this.modelRuntime.generate({
      messages,
      images: options.images,
    });

    // Add assistant response to context
    this.contextManager.addMessage(agentId, {
      role: 'assistant',
      content: response.content,
    });

    // Learn from conversation if enabled
    if (config.enableLearning && this.learningService) {
      const recentMessages = contextMessages.slice(-10);
      // Fire and forget - don't block response
      this.learningService.learnFromConversation(agentId, recentMessages).catch(err => {
        this.logger.warn(`Learning failed: ${err.message}`);
      });
    }

    const tokenUsage = this.contextManager.getTokenUsage(agentId);
    const window = this.contextManager.getWindow(agentId);

    return {
      response: response.content,
      model: response.model,
      tokenUsage,
      contextRotated,
      windowNumber: window?.windowNumber || 1,
      ragDocumentsUsed,
      learnedContextUsed,
    };
  }

  /**
   * Generate a streaming response
   */
  async *generateStream(
    agentId: string,
    userPrompt: string,
    options: AgentGenerationOptions = {}
  ): AsyncGenerator<{
    chunk: string;
    done: boolean;
    result?: AgentGenerationResult;
  }> {
    const config = this.getAgentConfig(agentId);
    let contextRotated = false;
    let ragDocumentsUsed = 0;
    let learnedContextUsed = false;

    // Check for context rotation
    if (this.contextManager.shouldRotate(agentId)) {
      await this.contextManager.rotateWindow(agentId);
      contextRotated = true;
    }

    // Build enhanced context (same as non-streaming)
    let enhancedPrompt = userPrompt;

    if ((config.enableRAG || options.useRAG) && this.ragService) {
      const ragContext = await this.buildRAGContext(userPrompt, options.ragOptions);
      if (ragContext.documents.length > 0) {
        enhancedPrompt = `${ragContext.contextString}\n\n---\n\nUser: ${userPrompt}`;
        ragDocumentsUsed = ragContext.documents.length;
      }
    }

    if ((config.enableLearning || options.includeLearnedContext) && this.learningService) {
      const learnedContext = await this.learningService.getLearnedContext(agentId, userPrompt);
      if (learnedContext) {
        enhancedPrompt = `[Learned context]\n${learnedContext}\n\n${enhancedPrompt}`;
        learnedContextUsed = true;
      }
    }

    // Add user message
    this.contextManager.addMessage(agentId, {
      role: 'user',
      content: enhancedPrompt,
    });

    const contextMessages = this.contextManager.getContextMessages(agentId);
    const messages = contextMessages.map(m => ({
      role: m.role,
      content: m.content,
    }));

    // Stream response
    let fullResponse = '';
    for await (const chunk of this.modelRuntime.generateStream({ messages })) {
      fullResponse += chunk.content;
      yield { chunk: chunk.content, done: false };

      if (chunk.done) {
        break;
      }
    }

    // Add complete response to context
    this.contextManager.addMessage(agentId, {
      role: 'assistant',
      content: fullResponse,
    });

    // Learn from conversation
    if (config.enableLearning && this.learningService) {
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      this.learningService.learnFromConversation(agentId, contextMessages.slice(-10)).catch(() => {});
    }

    const tokenUsage = this.contextManager.getTokenUsage(agentId);
    const window = this.contextManager.getWindow(agentId);

    yield {
      chunk: '',
      done: true,
      result: {
        response: fullResponse,
        model: config.model,
        tokenUsage,
        contextRotated,
        windowNumber: window?.windowNumber || 1,
        ragDocumentsUsed,
        learnedContextUsed,
      },
    };
  }

  /**
   * Build RAG context from query
   */
  private async buildRAGContext(
    query: string,
    options?: RAGQueryOptions
  ): Promise<{ documents: RAGDocument[]; contextString: string }> {
    if (!this.ragService) {
      return { documents: [], contextString: '' };
    }

    const documents = await this.ragService.query(query, {
      topK: options?.topK || 5,
      minScore: options?.minScore || 0.3,
      ...options,
    });

    if (documents.length === 0) {
      return { documents: [], contextString: '' };
    }

    const contextString = '[Relevant Context]\n' + documents
      .map((d, i) => `[${i + 1}] ${d.content}`)
      .join('\n\n');

    return { documents, contextString };
  }

  /**
   * Add context dynamically without generating
   */
  addContext(agentId: string, role: 'user' | 'assistant' | 'system', content: string): Message {
    this.getAgentConfig(agentId); // Validate agent exists
    return this.contextManager.addMessage(agentId, { role, content });
  }

  /**
   * Reset/restart context window
   */
  async resetContext(agentId: string, keepSystemPrompt = true): Promise<void> {
    const config = this.getAgentConfig(agentId);
    
    this.contextManager.clearWindow(agentId);

    if (keepSystemPrompt && config.systemPrompt) {
      this.contextManager.addMessage(agentId, {
        role: 'system',
        content: config.systemPrompt,
      });
    }

    this.logger.log(`Context reset for agent ${agentId}`);
  }

  /**
   * Manually trigger context rotation
   */
  async rotateContext(agentId: string): Promise<ContextRotationResult> {
    this.getAgentConfig(agentId);
    return this.contextManager.rotateWindow(agentId);
  }

  /**
   * Add documents to RAG
   */
  async addRAGDocuments(documents: RAGDocument[]): Promise<void> {
    if (!this.ragService) {
      throw new Error('RAG service not available');
    }
    await this.ragService.addDocuments(documents);
  }

  /**
   * Query RAG documents
   */
  async queryRAG(query: string, options?: RAGQueryOptions): Promise<RAGDocument[]> {
    if (!this.ragService) {
      throw new Error('RAG service not available');
    }
    return this.ragService.query(query, options);
  }

  /**
   * Get token usage for agent
   */
  getTokenUsage(agentId: string): TokenUsageStats {
    return this.contextManager.getTokenUsage(agentId);
  }

  /**
   * Get context messages for agent
   */
  getContextMessages(agentId: string): Message[] {
    return this.contextManager.getContextMessages(agentId);
  }

  /**
   * Get learning stats for agent
   */
  async getLearningStats(agentId: string): Promise<{
    documentCount: number;
    conversationCount: number;
    lastLearnedAt?: Date;
  } | null> {
    if (!this.learningService) {
      return null;
    }
    return this.learningService.getStats(agentId);
  }

  /**
   * Export agent's learned knowledge
   */
  async exportKnowledge(agentId: string): Promise<RAGDocument[]> {
    if (!this.learningService) {
      return [];
    }
    return this.learningService.exportKnowledge(agentId);
  }

  /**
   * Import knowledge for agent
   */
  async importKnowledge(agentId: string, documents: RAGDocument[]): Promise<void> {
    if (!this.learningService) {
      throw new Error('Learning service not available');
    }
    await this.learningService.importKnowledge(agentId, documents);
  }

  /**
   * Get agent config (throws if not found)
   */
  private getAgentConfig(agentId: string): AgentRuntimeConfig {
    const config = this.agentConfigs.get(agentId);
    if (!config) {
      throw new Error(`Agent ${agentId} not initialized. Call initializeAgent first.`);
    }
    return config;
  }

  /**
   * Check if agent is initialized
   */
  isAgentActive(agentId: string): boolean {
    return this.activeAgents.has(agentId);
  }

  /**
   * Get all active agent IDs
   */
  getActiveAgents(): string[] {
    return Array.from(this.activeAgents);
  }

  /**
   * Shutdown agent and cleanup
   */
  async shutdownAgent(agentId: string): Promise<void> {
    const config = this.agentConfigs.get(agentId);
    if (!config) {
      return;
    }

    // Stop model if running
    try {
      await this.modelRuntime.stop(config.model);
    } catch (e) {
      // Ignore errors during shutdown
    }

    // Remove context window
    this.contextManager.removeWindow(agentId);

    // Cleanup
    this.agentConfigs.delete(agentId);
    this.activeAgents.delete(agentId);

    this.logger.log(`Agent ${agentId} shutdown complete`);
  }

  /**
   * Get runtime debug info
   */
  getDebugInfo(agentId: string): object | null {
    const config = this.agentConfigs.get(agentId);
    if (!config) return null;

    const window = this.contextManager.getWindow(agentId);
    const instance = this.modelRuntime.getInstance(config.model);

    return {
      agentId,
      config,
      contextWindow: window ? {
        id: window.id,
        windowNumber: window.windowNumber,
        messageCount: window.messages.length,
        totalTokens: window.totalTokens,
        hasSummary: !!window.previousSummary,
      } : null,
      modelInstance: instance,
      tokenUsage: this.contextManager.getTokenUsage(agentId),
    };
  }
}


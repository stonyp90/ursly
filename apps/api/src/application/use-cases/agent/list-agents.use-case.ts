import { Inject, Injectable } from '@nestjs/common';
import {
  QueryAgentDto,
  QueryAgentDtoSchema,
  AgentListResponse,
} from '@ursly/shared/types';
import {
  IAgentRepository,
  AGENT_REPOSITORY,
} from '../../ports/agent.repository.port';

export interface ListAgentsInput {
  query: QueryAgentDto;
}

export type ListAgentsOutput = AgentListResponse;

@Injectable()
export class ListAgentsUseCase {
  constructor(
    @Inject(AGENT_REPOSITORY)
    private readonly agentRepository: IAgentRepository,
  ) {}

  async execute(input: ListAgentsInput): Promise<ListAgentsOutput> {
    // Validate and apply defaults with Zod
    const validatedQuery = QueryAgentDtoSchema.parse(input.query);

    return this.agentRepository.findAll(validatedQuery);
  }
}

import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsUrl,
  Min,
  Max,
  validateSync,
} from 'class-validator';
import { plainToInstance } from 'class-transformer';

class EnvironmentVariables {
  // Keycloak
  @IsUrl({ require_tld: false })
  @IsNotEmpty()
  KEYCLOAK_URL: string;

  @IsString()
  @IsNotEmpty()
  KEYCLOAK_REALM: string;

  @IsString()
  @IsNotEmpty()
  KEYCLOAK_CLIENT_ID: string;

  @IsString()
  @IsNotEmpty()
  KEYCLOAK_CLIENT_SECRET: string;

  // MongoDB
  @IsString()
  @IsNotEmpty()
  MONGODB_URI: string;

  // Ollama
  @IsUrl({ require_tld: false })
  @IsNotEmpty()
  OLLAMA_URL: string;

  // Agent Tokens
  @IsString()
  @IsNotEmpty()
  AGENT_TOKEN_SECRET: string;

  @IsNumber()
  @Min(60)
  @Max(3600)
  AGENT_TOKEN_EXPIRY = 300;

  // gRPC
  @IsString()
  @IsNotEmpty()
  GRPC_SERVICE_URL: string;

  // API
  @IsNumber()
  @Min(1)
  @Max(65535)
  PORT = 3000;

  @IsString()
  @IsNotEmpty()
  NODE_ENV: string;
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(`Environment validation failed:\n${errors.toString()}`);
  }

  return validatedConfig;
}

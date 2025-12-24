import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import jwksRsa from 'jwks-rsa';

// Decorator to mark routes as public (no auth required)
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

// JWT Payload interface for Keycloak tokens
export interface JwtPayload {
  sub: string;
  email?: string;
  email_verified?: boolean;
  preferred_username?: string;
  given_name?: string;
  family_name?: string;
  name?: string;
  realm_access?: {
    roles: string[];
  };
  resource_access?: {
    [client: string]: {
      roles: string[];
    };
  };
  azp?: string;
  scope?: string;
  sid?: string;
  iat?: number;
  exp?: number;
  iss?: string;
  aud?: string | string[];
  organization?: string;
  org_id?: string;
  tenant_id?: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

// JWKS client cache
let jwksClient: jwksRsa.JwksClient | null = null;

function getJwksClient(keycloakUrl: string, realm: string): jwksRsa.JwksClient {
  if (!jwksClient) {
    jwksClient = jwksRsa({
      jwksUri: `${keycloakUrl}/realms/${realm}/protocol/openid-connect/certs`,
      cache: true,
      cacheMaxAge: 600000, // 10 minutes
      rateLimit: true,
      jwksRequestsPerMinute: 10,
    });
  }
  return jwksClient;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if route is marked as public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('No authentication token provided');
    }

    try {
      const payload = await this.validateToken(token);
      request.user = payload;
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid token';
      throw new UnauthorizedException(`Authentication failed: ${message}`);
    }
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const authHeader = request.headers.authorization;
    if (!authHeader) {
      return undefined;
    }

    const [type, token] = authHeader.split(' ');
    return type === 'Bearer' ? token : undefined;
  }

  private async validateToken(token: string): Promise<JwtPayload> {
    const keycloakUrl =
      this.configService.get<string>('KEYCLOAK_URL') || 'http://localhost:8080';
    const realm =
      this.configService.get<string>('KEYCLOAK_REALM') || 'agent-orchestrator';
    const issuer = `${keycloakUrl}/realms/${realm}`;

    // Decode the token to get the kid (key ID)
    const decoded = jwt.decode(token, { complete: true });

    if (!decoded || typeof decoded === 'string') {
      throw new Error('Invalid token format');
    }

    const kid = decoded.header.kid;

    if (!kid) {
      throw new Error('No kid in token header');
    }

    // Get the JWKS client
    const client = getJwksClient(keycloakUrl, realm);

    // Get the signing key from Keycloak JWKS endpoint
    const key = await client.getSigningKey(kid);
    const publicKey = key.getPublicKey();

    // Verify the token
    const payload = jwt.verify(token, publicKey, {
      algorithms: ['RS256'],
      issuer: issuer,
    }) as JwtPayload;

    return payload;
  }
}

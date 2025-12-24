import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { HealthService } from './health.service';
import { Public } from '../auth/jwt-auth.guard';
import { SkipEntitlementCheck } from '../entitlements/guards/entitlement.guard';

@ApiTags('Health')
@Controller('health')
@Public() // Health endpoints are public - no auth required
@SkipEntitlementCheck() // Skip entitlement check for health endpoints
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({ summary: 'Health check endpoint' })
  async check() {
    return this.healthService.check();
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness check endpoint' })
  async ready() {
    return this.healthService.ready();
  }
}

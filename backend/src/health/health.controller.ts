import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';

export class HealthRes {
  @ApiProperty({ example: 'ok', description: '服务状态' })
  status!: string;

  @ApiProperty({ example: 3600, description: '进程运行时长（秒）' })
  uptime!: number;

  @ApiProperty({ example: '2026-11-11T03:00:00.000Z', description: '当前服务器时间（ISO 8601）' })
  timestamp!: string;
}

@ApiTags('健康检查')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOperation({ summary: '健康检查', description: '无需鉴权，用于探活' })
  @ApiOkResponse({ type: HealthRes })
  health() {
    return {
      status: 'ok',
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }
}

import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

const PAGE_DEFAULT = 1;
const SIZE_DEFAULT = 20;
const SIZE_MAX = 100;

/**
 * 宽松归一化：不传 / 空串 / 非法值（非正整数）→ 默认值；
 * 越界（小于最小值或大于最大值）→ 默认值。
 * 兜底在 transform 层完成，后面的 @IsInt/@Min/@Max 仅作为标准校验声明（Swagger 与防御）。
 */
const toPageInt = (raw: unknown, fallback: number, max: number): number => {
  const n = Number(String(raw ?? '').trim());
  if (!Number.isInteger(n) || n < 1) return fallback;
  if (n > max) return fallback;
  return n;
};

/**
 * 分页查询参数（NestJS 标准做法：class-validator DTO + 全局 ValidationPipe）。
 */
export class PageDto {
  @ApiProperty({
    required: false,
    example: 1,
    description: `页码，默认 ${PAGE_DEFAULT}；不传/空串/非法/小于 1 一律取默认值`,
  })
  @Transform(({ value }) => toPageInt(value, PAGE_DEFAULT, Number.MAX_SAFE_INTEGER))
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = PAGE_DEFAULT;

  @ApiProperty({
    required: false,
    example: SIZE_DEFAULT,
    description: `每页条数，默认 ${SIZE_DEFAULT}，最大 ${SIZE_MAX}；不传/空串/非法/越界一律取默认值`,
  })
  @Transform(({ value }) => toPageInt(value, SIZE_DEFAULT, SIZE_MAX))
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(SIZE_MAX)
  size: number = SIZE_DEFAULT;

  get skip(): number {
    return (this.page - 1) * this.size;
  }
}

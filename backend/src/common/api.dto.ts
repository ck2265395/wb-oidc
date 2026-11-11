import { ApiProperty } from '@nestjs/swagger';

/** 通用成功响应 */
export class OkRes {
  @ApiProperty({ example: true })
  ok!: boolean;
}

/** 带提示信息的成功响应 */
export class MessageRes {
  @ApiProperty({ example: true })
  ok!: boolean;

  @ApiProperty({ example: '操作成功', description: '提示信息' })
  message!: string;
}

/**
 * 进程内滑动窗口限流（防撞库）。
 * 单实例部署够用；多实例部署时换 Redis 实现同接口即可。
 */
interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

/** 周期内超限返回 false 并计入；未超限返回 true */
export function hitRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  bucket.count += 1;
  return bucket.count <= limit;
}

/** 验证通过后清除计数（成功登录不累计失败） */
export function clearRateLimit(key: string): void {
  buckets.delete(key);
}

// 防止 Map 无限增长：周期结束后过期桶任由覆盖，这里定期清扫即可
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}, 10 * 60_000).unref();

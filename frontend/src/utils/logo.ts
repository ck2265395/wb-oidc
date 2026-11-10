/**
 * 应用图标工具：把上传的图片等比裁剪为 100×100 的正方形 JPEG data URL。
 * 直接以 base64 存库（oidc_clients.logo），避免引入文件存储基础设施；
 * 100×100 的 JPEG 经压缩后通常只有数 KB，体积可控。
 */
export function fileToLogo(file: File, size = 100): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('请上传图片文件'));
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      reject(new Error('图片不能超过 2MB'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('读取图片失败'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('解析图片失败'));
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('当前环境不支持图片处理'));
          return;
        }
        // 等比居中裁剪为正方形
        const side = Math.min(img.width, img.height);
        const sx = (img.width - side) / 2;
        const sy = (img.height - side) / 2;
        ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

// oidc-provider 官方包未随附 TypeScript 类型，这里给一个宽松声明。
// 运行时 API 以官方文档为准：https://github.com/panva/node-oidc-provider
declare module 'oidc-provider' {
  const Provider: any;
  export = Provider;
}

// The integration's virtual modules (index.ts), for TypeScript.
declare module 'virtual:focus-reader/config' {
  const config: import('./options').ReaderConfig;
  export default config;
}
declare module 'virtual:focus-reader/theme.css' {}

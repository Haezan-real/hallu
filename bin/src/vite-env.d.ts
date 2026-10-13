/// <reference types="vite/client" />

//src/vite-env.d.ts

import './shared/platform/electronApi';

declare module '*.vert?raw' {
  const content: string;
  export default content;
}

declare module '*.frag?raw' {
  const content: string;
  export default content;
}

declare module '*.glsl?raw' {
  const content: string;
  export default content;
}
declare module '*.vue' {
    const component: import('vue').DefineComponent<Record<string, never>, Record<string, never>, unknown>;
    export default component;
}

declare module '*.svg?raw' {
    const content: string;
    export default content;
}

declare module '*.vue' {
    const component: import('vue').DefineComponent<Record<string, never>, Record<string, never>, unknown>;
    export default component;
}

import type { Preview } from '@storybook/vue3-vite';

import '@fontsource/im-fell-english/400.css';
import '@fontsource/im-fell-english/400-italic.css';
import '@fontsource/cinzel/400.css';
import '../assets/css/main.css';

const preview: Preview = {
    decorators: [
        (story) => ({
            components: { Story: story() },
            template: '<div class="grimoire-ui grimoire-bg min-h-screen bg-grimoire-bg p-6 text-grimoire-text"><Story /></div>',
        }),
    ],
    parameters: {
        backgrounds: {
            default: 'Grimoire',
            values: [
                { name: 'Grimoire', value: '#1a1510' },
                { name: 'Raised', value: '#2a2318' },
            ],
        },
        controls: {
            matchers: {
                color: /(background|color)$/iu,
                date: /Date$/u,
            },
        },
    },
};

export default preview;

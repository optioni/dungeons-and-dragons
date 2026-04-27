import { type Meta, type StoryObj } from '@storybook/vue3-vite';

const meta = {
    title: 'Design/DarkGrimoire',
    tags: ['autodocs'],
    render: () => ({
        template: `
            <section class="max-w-4xl space-y-8">
                <div>
                    <p class="font-['Cinzel',serif] text-xs uppercase tracking-widest text-grimoire-muted">Dark Grimoire</p>
                    <h1 class="mt-2 font-['IM_Fell_English',serif] text-5xl text-grimoire-text">A page from the living campaign</h1>
                    <p class="mt-3 max-w-2xl font-['IM_Fell_English',serif] text-xl leading-relaxed text-grimoire-muted">
                        Typography, surfaces, borders, accents, and motion tokens loaded through the same global CSS as the app.
                    </p>
                </div>

                <div class="grid gap-3 sm:grid-cols-4">
                    <div class="h-24 rounded-sm border border-grimoire-accent-dim/30 bg-grimoire-bg p-3">
                        <span class="font-['Cinzel',serif] text-xs uppercase text-grimoire-muted">Background</span>
                    </div>
                    <div class="h-24 rounded-sm border border-grimoire-accent-dim/30 bg-grimoire-surface p-3">
                        <span class="font-['Cinzel',serif] text-xs uppercase text-grimoire-muted">Surface</span>
                    </div>
                    <div class="h-24 rounded-sm border border-grimoire-accent-dim/30 bg-grimoire-raised p-3">
                        <span class="font-['Cinzel',serif] text-xs uppercase text-grimoire-muted">Raised</span>
                    </div>
                    <div class="h-24 rounded-sm border border-grimoire-accent-dim/30 bg-grimoire-combat p-3">
                        <span class="font-['Cinzel',serif] text-xs uppercase text-grimoire-muted">Combat</span>
                    </div>
                </div>

                <div class="rounded-sm border border-grimoire-accent-dim/30 bg-grimoire-surface p-5">
                    <div class="flex items-center gap-3">
                        <span class="h-3 w-3 rounded-full bg-grimoire-accent grimoire-breathe" />
                        <span class="font-['Cinzel',serif] text-xs uppercase tracking-widest text-grimoire-accent">Active omen</span>
                    </div>
                    <div class="prose prose-grimoire mt-4 font-['IM_Fell_English',serif]">
                        <p>The candle gutters, but the ink keeps moving.</p>
                        <hr>
                        <ul>
                            <li>Quest text keeps its manuscript rhythm.</li>
                            <li>Mechanical detail remains readable at small sizes.</li>
                        </ul>
                    </div>
                </div>
            </section>
        `,
    }),
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const VisualReference: Story = {};

import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import MechanicalEventAnnotation from '../components/session/MechanicalEventAnnotation.vue';
import TranscriptView from '../components/session/TranscriptView.vue';

const globalComponents = {
    SessionMechanicalEventAnnotation: MechanicalEventAnnotation,
    SessionDiceRollCard: { template: '<div />', props: ['content'] },
    SessionOrnamentalDivider: { template: '<hr />' },
};

describe('TranscriptView mechanical events', () => {
    it('renders non-combat visible events as marginal annotations', () => {
        const wrapper = mount(TranscriptView, {
            props: {
                events: [
                    {
                        id: 'event-1',
                        sessionId: 'sess-1',
                        eventType: 'PLAYER_VISIBLE_EVENT',
                        createdAt: '2026-04-26T00:00:00.000Z',
                        content: {
                            category: 'QUEST',
                            kind: 'QUEST_OBJECTIVE_UPDATED',
                            title: 'Quest objective updated',
                            summary: 'Second clue discovered.',
                            values: { quantity: 2 },
                        },
                    },
                ],
            },
            global: { components: globalComponents },
        });

        expect(wrapper.find('[data-testid="mechanical-event-annotation"]').exists()).toBe(true);
        expect(wrapper.text()).toContain('QUEST QUEST OBJECTIVE UPDATED');
        expect(wrapper.text()).toContain('Quest objective updated');
        expect(wrapper.text()).toContain('Second clue discovered.');
        expect(wrapper.text()).toContain('2');
    });

    it('does not render raw or hidden payload fields from visible event content', () => {
        const wrapper = mount(TranscriptView, {
            props: {
                events: [
                    {
                        id: 'event-1',
                        sessionId: 'sess-1',
                        eventType: 'PLAYER_VISIBLE_EVENT',
                        createdAt: '2026-04-26T00:00:00.000Z',
                        content: {
                            category: 'DISCOVERY',
                            kind: 'LOCATION_DISCOVERED',
                            title: 'Location discovered',
                            toolInput: { location_id: 10 },
                            hiddenDc: 18,
                            values: { quantity: 1 },
                        },
                    },
                ],
            },
            global: { components: globalComponents },
        });

        expect(wrapper.find('[data-testid="mechanical-event-annotation"]').exists()).toBe(true);
        expect(wrapper.text()).toContain('Location discovered');
        expect(wrapper.text()).not.toContain('toolInput');
        expect(wrapper.text()).not.toContain('location_id');
        expect(wrapper.text()).not.toContain('hiddenDc');
    });

    it('keeps routine combat events out of the transcript', () => {
        const wrapper = mount(TranscriptView, {
            props: {
                events: [
                    {
                        id: 'event-1',
                        sessionId: 'sess-1',
                        eventType: 'PLAYER_VISIBLE_EVENT',
                        createdAt: '2026-04-26T00:00:00.000Z',
                        content: {
                            category: 'COMBAT',
                            kind: 'DAMAGE_APPLIED',
                            title: 'Damage applied',
                            values: { amount: 7 },
                        },
                    },
                ],
            },
            global: { components: globalComponents },
        });

        expect(wrapper.find('[data-testid="mechanical-event-annotation"]').exists()).toBe(false);
        expect(wrapper.text()).not.toContain('Damage applied');
    });
});

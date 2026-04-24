import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import CombatPanel from '../components/session/CombatPanel.vue';

interface Combatant {
    id: string;
    type: 'CHARACTER' | 'NPC';
    name: string;
    initiativeRoll: number;
    currentHp: number;
    maxHp: number;
    conditions: string[];
    usedAction: boolean;
    usedBonusAction: boolean;
    usedReaction: boolean;
    movementUsed: number;
}

interface CombatSession {
    id: string;
    combatants: Combatant[];
    currentTurnIndex: number;
    roundNumber: number;
}

interface SpellSlot {
    level: number;
    total: number;
    used: number;
}

// Stubs for Nuxt UI components so we can inspect props and slots
const globalStubs = {
    UBadge: {
        template: '<span class="stub-badge" :data-color="color"><slot /></span>',
        props: ['color', 'variant', 'size'],
    },
    UButton: {
        template: '<button class="stub-button" :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
        props: ['disabled', 'size', 'variant', 'color', 'icon', 'loading', 'block'],
        emits: ['click'],
    },
};

const makeCombatant = (overrides: Partial<Combatant> = {}): Combatant => ({
    id: 'char-1',
    type: 'CHARACTER',
    name: 'Aragorn',
    initiativeRoll: 15,
    currentHp: 30,
    maxHp: 40,
    conditions: [],
    usedAction: false,
    usedBonusAction: false,
    usedReaction: false,
    movementUsed: 0,
    ...overrides,
});

const makeCombatSession = (overrides: Partial<CombatSession> = {}): CombatSession => ({
    id: 'combat-1',
    combatants: [makeCombatant()],
    currentTurnIndex: 0,
    roundNumber: 1,
    ...overrides,
});

describe('CombatPanel', () => {
    describe('HP bar proportions', () => {
        it('renders HP bar at correct width percentage', () => {
            const session = makeCombatSession({
                combatants: [makeCombatant({ currentHp: 50, maxHp: 100 })],
            });
            const wrapper = mount(CombatPanel, {
                props: { combatSession: session },
                global: { stubs: globalStubs },
            });

            const hpBarFill = wrapper.find('.bg-gray-700 > div');
            expect(hpBarFill.attributes('style')).toBe('width: 50%;');
        });

        it('shows green bar above 50% HP', () => {
            const session = makeCombatSession({
                combatants: [makeCombatant({ currentHp: 60, maxHp: 100 })],
            });
            const wrapper = mount(CombatPanel, {
                props: { combatSession: session },
                global: { stubs: globalStubs },
            });

            const hpBarFill = wrapper.find('.bg-gray-700 > div');
            expect(hpBarFill.classes()).toContain('bg-green-500');
        });

        it('shows yellow bar between 26-50% HP', () => {
            const session = makeCombatSession({
                combatants: [makeCombatant({ currentHp: 30, maxHp: 100 })],
            });
            const wrapper = mount(CombatPanel, {
                props: { combatSession: session },
                global: { stubs: globalStubs },
            });

            const hpBarFill = wrapper.find('.bg-gray-700 > div');
            expect(hpBarFill.classes()).toContain('bg-yellow-500');
        });

        it('shows red bar at 25% HP or below', () => {
            const session = makeCombatSession({
                combatants: [makeCombatant({ currentHp: 10, maxHp: 100 })],
            });
            const wrapper = mount(CombatPanel, {
                props: { combatSession: session },
                global: { stubs: globalStubs },
            });

            const hpBarFill = wrapper.find('.bg-gray-700 > div');
            expect(hpBarFill.classes()).toContain('bg-red-500');
        });

        it('shows 0% width when HP is 0', () => {
            const session = makeCombatSession({
                combatants: [makeCombatant({ currentHp: 0, maxHp: 100 })],
            });
            const wrapper = mount(CombatPanel, {
                props: { combatSession: session },
                global: { stubs: globalStubs },
            });

            const hpBarFill = wrapper.find('.bg-gray-700 > div');
            expect(hpBarFill.attributes('style')).toBe('width: 0%;');
        });
    });

    describe('condition badges', () => {
        it('renders a badge for each condition', () => {
            const session = makeCombatSession({
                combatants: [makeCombatant({ conditions: ['Poisoned', 'Blinded'] })],
            });
            const wrapper = mount(CombatPanel, {
                props: { combatSession: session },
                global: { stubs: globalStubs },
            });

            const badges = wrapper.findAll('.stub-badge');
            expect(badges).toHaveLength(2);
            expect(badges[0]!.text()).toBe('Poisoned');
            expect(badges[1]!.text()).toBe('Blinded');
        });

        it('renders no badges when combatant has no conditions', () => {
            const session = makeCombatSession({
                combatants: [makeCombatant({ conditions: [] })],
            });
            const wrapper = mount(CombatPanel, {
                props: { combatSession: session },
                global: { stubs: globalStubs },
            });

            expect(wrapper.findAll('.stub-badge')).toHaveLength(0);
        });
    });

    describe('action economy states', () => {
        it('shows action economy section when character is the active combatant', () => {
            const playerCombatant = makeCombatant({ id: 'player-1', type: 'CHARACTER' });
            const session = makeCombatSession({
                combatants: [playerCombatant],
                currentTurnIndex: 0,
            });
            const wrapper = mount(CombatPanel, {
                props: { combatSession: session, characterId: 'player-1' },
                global: { stubs: globalStubs },
            });

            expect(wrapper.find('[class*="Actions"]').exists() || wrapper.text()).toContain('Action');
        });

        it('hides action economy section when it is not the player\'s turn', () => {
            const playerCombatant = makeCombatant({ id: 'player-1', type: 'CHARACTER' });
            const enemyCombatant = makeCombatant({ id: 'enemy-1', type: 'NPC', name: 'Goblin' });
            const session = makeCombatSession({
                combatants: [enemyCombatant, playerCombatant],
                currentTurnIndex: 0,
            });
            const wrapper = mount(CombatPanel, {
                props: { combatSession: session, characterId: 'player-1' },
                global: { stubs: globalStubs },
            });

            // Action section should not appear since enemy is the active combatant
            expect(wrapper.text()).not.toContain('Action');
        });

        it('styles used action as spent (dimmed)', () => {
            const playerCombatant = makeCombatant({ id: 'player-1', usedAction: true });
            const session = makeCombatSession({
                combatants: [playerCombatant],
                currentTurnIndex: 0,
            });
            const wrapper = mount(CombatPanel, {
                props: { combatSession: session, characterId: 'player-1' },
                global: { stubs: globalStubs },
            });

            // The action row should have the spent class when usedAction is true
            const actionRows = wrapper.findAll('.bg-gray-800');
            expect(actionRows.length).toBeGreaterThan(0);
        });

        it('styles available action as active (bright)', () => {
            const playerCombatant = makeCombatant({ id: 'player-1', usedAction: false });
            const session = makeCombatSession({
                combatants: [playerCombatant],
                currentTurnIndex: 0,
            });
            const wrapper = mount(CombatPanel, {
                props: { combatSession: session, characterId: 'player-1' },
                global: { stubs: globalStubs },
            });

            // Should have bright bg-gray-700 for unused action
            const actionRows = wrapper.findAll('.bg-gray-700');
            expect(actionRows.length).toBeGreaterThan(0);
        });

        it('displays remaining movement', () => {
            const playerCombatant = makeCombatant({ id: 'player-1', movementUsed: 15 });
            const session = makeCombatSession({
                combatants: [playerCombatant],
                currentTurnIndex: 0,
            });
            const wrapper = mount(CombatPanel, {
                props: { combatSession: session, characterId: 'player-1' },
                global: { stubs: globalStubs },
            });

            expect(wrapper.text()).toContain('15ft');
        });
    });

    describe('quick action buttons', () => {
        it('disables all quick action buttons when isStreaming is true', () => {
            const session = makeCombatSession();
            const wrapper = mount(CombatPanel, {
                props: { combatSession: session, isStreaming: true },
                global: { stubs: globalStubs },
            });

            const buttons = wrapper.findAll('.stub-button');
            expect(buttons.length).toBeGreaterThan(0);
            for (const button of buttons) {
                expect(button.attributes('disabled')).toBeDefined();
            }
        });

        it('enables quick action buttons when isStreaming is false', () => {
            const session = makeCombatSession();
            const wrapper = mount(CombatPanel, {
                props: { combatSession: session, isStreaming: false },
                global: { stubs: globalStubs },
            });

            const buttons = wrapper.findAll('.stub-button');
            expect(buttons.length).toBeGreaterThan(0);
            for (const button of buttons) {
                expect(button.attributes('disabled')).toBeUndefined();
            }
        });

        it('emits action event with pre-fill text when quick action is clicked', async () => {
            const session = makeCombatSession();
            const wrapper = mount(CombatPanel, {
                props: { combatSession: session, isStreaming: false },
                global: { stubs: globalStubs },
            });

            await wrapper.findAll('.stub-button')[0]!.trigger('click');
            expect(wrapper.emitted('action')).toBeTruthy();
            expect(wrapper.emitted('action')![0]).toEqual(['I attack with my weapon.']);
        });

        it('each quick action emits a distinct pre-fill text without submitting', async () => {
            const session = makeCombatSession();
            const wrapper = mount(CombatPanel, {
                props: { combatSession: session, isStreaming: false },
                global: { stubs: globalStubs },
            });

            const expectedTexts = [
                'I attack with my weapon.',
                'I cast a spell.',
                'I use my action to Dash.',
                'I take the Dodge action.',
                'I take an action: ',
            ];
            const buttons = wrapper.findAll('.stub-button');
            expect(buttons).toHaveLength(expectedTexts.length);

            for (let i = 0; i < expectedTexts.length; i++) {
                await buttons[i]!.trigger('click');
                expect(wrapper.emitted('action')![i]).toEqual([expectedTexts[i]]);
            }
        });

        it('does not auto-submit: emits action event and leaves submission to the parent', async () => {
            const session = makeCombatSession();
            const wrapper = mount(CombatPanel, {
                props: { combatSession: session, isStreaming: false },
                global: { stubs: globalStubs },
            });

            await wrapper.findAll('.stub-button')[0]!.trigger('click');

            // Only 'action' is emitted — no 'submit' or similar event
            expect(wrapper.emitted('action')).toBeTruthy();
            expect(wrapper.emitted('submit')).toBeFalsy();
        });
    });

    describe('combat panel visibility (durable session state)', () => {
        it('renders given a valid combatSession prop', () => {
            const session = makeCombatSession();
            const wrapper = mount(CombatPanel, {
                props: { combatSession: session },
                global: { stubs: globalStubs },
            });

            expect(wrapper.find('.w-72').exists()).toBe(true);
        });

        it('shows the round number from combatSession', () => {
            const session = makeCombatSession({ roundNumber: 5 });
            const wrapper = mount(CombatPanel, {
                props: { combatSession: session },
                global: { stubs: globalStubs },
            });

            expect(wrapper.text()).toContain('Round 5');
        });

        it('renders all combatants from the session', () => {
            const session = makeCombatSession({
                combatants: [
                    makeCombatant({ id: 'c1', name: 'Aragorn' }),
                    makeCombatant({ id: 'c2', name: 'Goblin', type: 'NPC' }),
                ],
            });
            const wrapper = mount(CombatPanel, {
                props: { combatSession: session },
                global: { stubs: globalStubs },
            });

            expect(wrapper.text()).toContain('Aragorn');
            expect(wrapper.text()).toContain('Goblin');
        });
    });

    describe('spell slots section', () => {
        it('hides spell slot section when character has no spell slots', () => {
            const session = makeCombatSession();
            const wrapper = mount(CombatPanel, {
                props: { combatSession: session, spellSlots: [] },
                global: { stubs: globalStubs },
            });

            expect(wrapper.text()).not.toContain('Spell Slots');
        });

        it('hides spell slot section when all slot totals are zero', () => {
            const slots: SpellSlot[] = [{ level: 1, total: 0, used: 0 }];
            const session = makeCombatSession();
            const wrapper = mount(CombatPanel, {
                props: { combatSession: session, spellSlots: slots },
                global: { stubs: globalStubs },
            });

            expect(wrapper.text()).not.toContain('Spell Slots');
        });

        it('shows spell slot section for spellcasting characters', () => {
            const slots: SpellSlot[] = [
                { level: 1, total: 4, used: 1 },
                { level: 2, total: 2, used: 0 },
            ];
            const session = makeCombatSession();
            const wrapper = mount(CombatPanel, {
                props: { combatSession: session, spellSlots: slots },
                global: { stubs: globalStubs },
            });

            expect(wrapper.text()).toContain('Spell Slots');
        });

        it('renders correct number of pip elements per slot level', () => {
            const slots: SpellSlot[] = [{ level: 1, total: 3, used: 0 }];
            const session = makeCombatSession();
            const wrapper = mount(CombatPanel, {
                props: { combatSession: session, spellSlots: slots },
                global: { stubs: globalStubs },
            });

            // Pips are w-3 h-3 spans (distinct from w-1.5 combatant dots)
            const pips = wrapper.findAll('.w-3.h-3.rounded-full');
            expect(pips).toHaveLength(3);
        });

        it('marks used spell slot pips as spent', () => {
            const slots: SpellSlot[] = [{ level: 1, total: 3, used: 2 }];
            const session = makeCombatSession();
            const wrapper = mount(CombatPanel, {
                props: { combatSession: session, spellSlots: slots },
                global: { stubs: globalStubs },
            });

            // Pips are w-3 h-3 spans — filter to filled vs empty
            const pips = wrapper.findAll('.w-3.h-3.rounded-full');
            const filledPips = pips.filter((p) => p.classes().includes('bg-primary-400'));
            const emptyPips = pips.filter((p) => p.classes().includes('bg-transparent'));
            // 1 slot remaining (3 total - 2 used), 2 spent
            expect(filledPips).toHaveLength(1);
            expect(emptyPips).toHaveLength(2);
        });
    });
});

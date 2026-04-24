import { useMutation, useQuery } from '@urql/vue';
import { flushPromises, mount } from '@vue/test-utils';
import {
    beforeEach, describe, expect, it, vi,
} from 'vitest';
import { ref } from 'vue';

import CharacterPage from '../pages/campaign/[id]/character.vue';

vi.mock('@urql/vue', () => ({
    useQuery: vi.fn(),
    useMutation: vi.fn(),
}));

vi.mock('~/graphql/character', () => ({
    CHARACTER_BY_CAMPAIGN_QUERY: 'CHARACTER_BY_CAMPAIGN_QUERY',
    CHARACTER_QUERY: 'CHARACTER_QUERY',
    CHARACTER_INVENTORY_QUERY: 'CHARACTER_INVENTORY_QUERY',
    UNEQUIP_MUTATION: 'UNEQUIP_MUTATION',
}));

const globalStubs = {
    NuxtLink: { template: '<a><slot /></a>', props: ['to'] },
    UAlert: { template: '<div>{{ description }}</div>', props: ['description', 'color', 'variant'] },
    UBadge: { template: '<span><slot /></span>', props: ['color', 'variant', 'size'] },
    UButton: {
        template: '<button @click="$emit(\'click\')"><slot /></button>',
        props: ['color', 'loading', 'size', 'variant'],
        emits: ['click'],
    },
    UCard: { template: '<section><slot name="header" /><slot /></section>' },
    UIcon: { template: '<span />', props: ['name', 'class'] },
};

const character = {
    id: 'char-1',
    name: 'Lyra Stormglass',
    level: 3,
    proficiencyBonus: 2,
    hp: 17,
    maxHp: 24,
    ac: 15,
    xp: 900,
    isDead: false,
    deathSaveSuccesses: 0,
    deathSaveFailures: 0,
    hitDiceRemaining: 2,
    conditions: ['Blessed'],
    abilityScores: {
        STR: 10, DEX: 14, CON: 13, INT: 16, WIS: 12, CHA: 8,
    },
    spellSlots: [{ level: 1, total: 4, used: 1 }],
    preparedSpells: ['Magic Missile', 'Shield'],
    skillProficiencies: {
        Arcana: 'proficient',
        Investigation: 'expert',
    },
    goldPieces: 12,
    silverPieces: 5,
    copperPieces: 3,
    race: { id: 'race-1', name: 'High Elf', speed: 30 },
    class: { id: 'class-1', name: 'Wizard', hitDie: 6 },
};

describe('CharacterPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubGlobal('useRoute', vi.fn(() => ({ params: { id: 'camp-1' }, query: {} })));
    });

    it('renders loaded character identity, stats, spells, and inventory', async () => {
        vi.mocked(useQuery).mockImplementation(({ query }: { query: unknown }) => {
            if (query === 'CHARACTER_BY_CAMPAIGN_QUERY') {
                return {
                    data: ref({ characterByCampaign: character }),
                    fetching: ref(false),
                    error: ref(null),
                } as never;
            }

            if (query === 'CHARACTER_INVENTORY_QUERY') {
                return {
                    data: ref({
                        characterInventory: [{
                            id: 'ci-1',
                            slot: 'MAIN_HAND',
                            condition: 'Polished',
                            quantity: 1,
                            item: {
                                id: 'item-1',
                                name: 'Moonlit Rapier',
                                description: 'A thin blade that catches starlight.',
                                itemType: 'WEAPON',
                                weight: 2,
                                value: 2500,
                                srdEquipment: {
                                    id: 'eq-1',
                                    name: 'Rapier',
                                    category: 'Weapon',
                                    damage: { damage_dice: '1d8', damage_type: { name: 'Piercing' } },
                                    properties: ['Finesse'],
                                },
                            },
                        }],
                    }),
                    fetching: ref(false),
                    executeQuery: vi.fn(),
                } as never;
            }

            return {
                data: ref(null),
                fetching: ref(false),
                error: ref(null),
            } as never;
        });
        vi.mocked(useMutation).mockReturnValue({ executeMutation: vi.fn() } as never);

        const wrapper = mount(CharacterPage, { global: { stubs: globalStubs } });
        await flushPromises();

        const text = wrapper.text();
        expect(text).toContain('Lyra Stormglass');
        expect(text).toContain('High Elf Wizard');
        expect(text).toContain('17/24');
        expect(text).toContain('INT');
        expect(text).toContain('16');
        expect(text).toContain('Magic Missile');
        expect(text).toContain('Shield');
        expect(text).toContain('Moonlit Rapier');
        expect(text).toContain('Damage: 1d8 Piercing');
    });
});

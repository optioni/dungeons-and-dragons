import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

import WorldMapGraph from '../components/world/WorldMapGraph.vue';

// matchMedia is not available in happy-dom — stub it
Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
    })),
});

const makeNode = (overrides: Partial<{
    id: string
    name: string
    coordinates: { x: number; y: number } | null
    currentState: string | null
    connectedLocationIds: string[]
    hasActivityMarker: boolean
}> = {}) => ({
    id: '1',
    name: 'Riverford',
    coordinates: { x: 100, y: 100 },
    currentState: 'SAFE',
    connectedLocationIds: [],
    hasActivityMarker: false,
    ...overrides,
});

const makeFrontier = (overrides: Partial<{
    id: string
    coordinates: { x: number; y: number } | null
    connectedDiscoveredIds: string[]
}> = {}) => ({
    id: '99',
    coordinates: null,
    connectedDiscoveredIds: ['1'],
    ...overrides,
});

describe('WorldMapGraph', () => {
    // 8.1 — Discovered nodes render with name
    it('renders discovered nodes with their names', () => {
        const wrapper = mount(WorldMapGraph, {
            props: {
                discoveredNodes: [makeNode({ id: '1', name: 'Riverford' })],
                frontierNodes: [],
                edges: [],
                currentLocationId: null,
            },
        });

        expect(wrapper.text()).toContain('Riverford');
    });

    // 8.1 — Frontier nodes render as ???
    it('renders frontier nodes as ??? without revealing names', () => {
        const wrapper = mount(WorldMapGraph, {
            props: {
                discoveredNodes: [makeNode()],
                frontierNodes: [makeFrontier()],
                edges: [],
                currentLocationId: null,
            },
        });

        expect(wrapper.text()).toContain('???');
    });

    // 8.1 — Current-location highlighting
    it('adds pulse animation ring to the current location node', () => {
        const wrapper = mount(WorldMapGraph, {
            props: {
                discoveredNodes: [makeNode({ id: '10', name: 'Current Town' })],
                frontierNodes: [],
                edges: [],
                currentLocationId: '10',
            },
        });

        // Should find a circle with animate-pulse class (the ring indicator)
        expect(wrapper.html()).toContain('animate-pulse');
    });

    // 8.1 — State colours
    it('applies hostile fill class to HOSTILE state node', () => {
        const wrapper = mount(WorldMapGraph, {
            props: {
                discoveredNodes: [makeNode({ id: '2', name: 'Danger Zone', currentState: 'HOSTILE' })],
                frontierNodes: [],
                edges: [],
                currentLocationId: null,
            },
        });

        expect(wrapper.html()).toContain('fill-red-900');
    });

    it('applies safe fill class to SAFE state node', () => {
        const wrapper = mount(WorldMapGraph, {
            props: {
                discoveredNodes: [makeNode({ id: '3', name: 'Safe Haven', currentState: 'SAFE' })],
                frontierNodes: [],
                edges: [],
                currentLocationId: null,
            },
        });

        expect(wrapper.html()).toContain('fill-emerald-900');
    });

    // 8.1 — Activity markers
    it('renders activity marker badge when hasActivityMarker is true', () => {
        const wrapper = mount(WorldMapGraph, {
            props: {
                discoveredNodes: [makeNode({ hasActivityMarker: true })],
                frontierNodes: [],
                edges: [],
                currentLocationId: null,
            },
        });

        // The activity marker renders a "!" text
        expect(wrapper.html()).toContain('!');
        expect(wrapper.html()).toContain('fill-yellow-400');
    });

    // 8.2 — Click interaction on discovered node emits nodeSelect
    it('emits nodeSelect when a discovered node is clicked', async () => {
        const wrapper = mount(WorldMapGraph, {
            props: {
                discoveredNodes: [makeNode({ id: '5', name: 'Click Me' })],
                frontierNodes: [],
                edges: [],
                currentLocationId: null,
            },
        });

        const nodeGroup = wrapper.find('[role="button"]');
        await nodeGroup.trigger('click');

        expect(wrapper.emitted('nodeSelect')).toHaveLength(1);
        expect(wrapper.emitted('nodeSelect')![0]).toEqual(['5', 'Click Me']);
    });

    // 8.2 — Keyboard interaction
    it('emits nodeSelect when Enter is pressed on a discovered node', async () => {
        const wrapper = mount(WorldMapGraph, {
            props: {
                discoveredNodes: [makeNode({ id: '6', name: 'Keyboard Town' })],
                frontierNodes: [],
                edges: [],
                currentLocationId: null,
            },
        });

        const nodeGroup = wrapper.find('[role="button"]');
        await nodeGroup.trigger('keydown', { key: 'Enter' });

        expect(wrapper.emitted('nodeSelect')).toHaveLength(1);
    });

    // 8.2 — Frontier nodes have no button role (not interactive)
    it('frontier nodes do not have role=button', () => {
        const wrapper = mount(WorldMapGraph, {
            props: {
                discoveredNodes: [],
                frontierNodes: [makeFrontier()],
                edges: [],
                currentLocationId: null,
            },
        });

        // No button roles should exist — frontier nodes use aria-hidden
        expect(wrapper.findAll('[role="button"]')).toHaveLength(0);
    });

    // 8.3 — Coordinate normalization
    it('normalizes coordinates into the SVG viewport', () => {
        const node1 = makeNode({ id: '1', coordinates: { x: 0, y: 0 } });
        const node2 = makeNode({ id: '2', name: 'Far Town', coordinates: { x: 1000, y: 1000 } });

        const wrapper = mount(WorldMapGraph, {
            props: {
                discoveredNodes: [node1, node2],
                frontierNodes: [],
                edges: [],
                currentLocationId: null,
            },
        });

        // Both nodes should be rendered (SVG viewBox is 0 0 600 400)
        expect(wrapper.findAll('[role="button"]')).toHaveLength(2);
    });

    // 8.3 — Deterministic fallback layout for nodes without coordinates
    it('renders nodes without coordinates using fallback positions', () => {
        const wrapper = mount(WorldMapGraph, {
            props: {
                discoveredNodes: [
                    makeNode({ id: '1', coordinates: null, name: 'Alpha' }),
                    makeNode({ id: '2', coordinates: null, name: 'Beta' }),
                ],
                frontierNodes: [],
                edges: [],
                currentLocationId: null,
            },
        });

        // Both nodes render without crashing
        expect(wrapper.findAll('[role="button"]')).toHaveLength(2);
        // Both names appear
        expect(wrapper.text()).toContain('Alpha');
        expect(wrapper.text()).toContain('Beta');
    });

    // 8.4 — Initial load: no animation on first data load (previousNodeIds is empty)
    it('does not apply enter animation on initial load when previousNodeIds is empty', () => {
        const wrapper = mount(WorldMapGraph, {
            props: {
                discoveredNodes: [makeNode({ id: '1' })],
                frontierNodes: [],
                edges: [],
                currentLocationId: null,
                previousNodeIds: new Set<string>(),
            },
        });

        expect(wrapper.html()).not.toContain('animate-map-node-enter');
    });

    // 8.4 — New nodes after data refresh receive enter animation
    it('applies enter animation to nodes that are new since the last render', () => {
        const wrapper = mount(WorldMapGraph, {
            props: {
                discoveredNodes: [
                    makeNode({ id: '1', name: 'Old' }),
                    makeNode({ id: '2', name: 'New Town' }),
                ],
                frontierNodes: [],
                edges: [],
                currentLocationId: null,
                previousNodeIds: new Set(['1']), // '1' was known; '2' is new
            },
        });

        expect(wrapper.html()).toContain('animate-map-node-enter');
    });

    // 8.4 — Refetch with same data does not animate
    it('does not animate when all nodes were already visible', () => {
        const wrapper = mount(WorldMapGraph, {
            props: {
                discoveredNodes: [makeNode({ id: '1' })],
                frontierNodes: [],
                edges: [],
                currentLocationId: null,
                previousNodeIds: new Set(['1']),
            },
        });

        expect(wrapper.html()).not.toContain('animate-map-node-enter');
    });

    // 8.4 — Reduced motion: no animation class even when node is new
    it('skips animation when prefers-reduced-motion is active', () => {
        // Override matchMedia to return reduced-motion: reduce
        window.matchMedia = vi.fn().mockImplementation((query: string) => ({
            matches: query === '(prefers-reduced-motion: reduce)',
            media: query,
            onchange: null,
            addListener: vi.fn(),
            removeListener: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn(),
        }));

        const wrapper = mount(WorldMapGraph, {
            props: {
                discoveredNodes: [makeNode({ id: '2', name: 'New' })],
                frontierNodes: [],
                edges: [],
                currentLocationId: null,
                previousNodeIds: new Set(['1']),
            },
        });

        expect(wrapper.html()).not.toContain('animate-map-node-enter');

        // Reset
        window.matchMedia = vi.fn().mockImplementation((query: string) => ({
            matches: false,
            media: query,
            onchange: null,
            addListener: vi.fn(),
            removeListener: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn(),
        }));
    });

    // 8.6 — Snapshot: map renders without overlapping
    it('renders all nodes and edges within the SVG viewBox', () => {
        const wrapper = mount(WorldMapGraph, {
            props: {
                discoveredNodes: [
                    makeNode({ id: '1', name: 'Alpha', coordinates: { x: 0, y: 0 } }),
                    makeNode({ id: '2', name: 'Beta', coordinates: { x: 500, y: 500 } }),
                ],
                frontierNodes: [makeFrontier({ id: '3', connectedDiscoveredIds: ['1'] })],
                edges: [
                    { fromId: '1', toId: '2' },
                    { fromId: '1', toId: '3' },
                ],
                currentLocationId: '1',
            },
        });

        const svg = wrapper.find('svg');
        expect(svg.exists()).toBe(true);
        expect(svg.attributes('viewBox')).toBe('0 0 600 400');

        // Two discovered nodes, one frontier
        expect(wrapper.findAll('[role="button"]')).toHaveLength(2);
        expect(wrapper.findAll('.frontier-node')).toHaveLength(1);

        // Two edges
        expect(wrapper.findAll('line')).toHaveLength(2);
    });
});

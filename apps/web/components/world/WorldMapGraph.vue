<template>
    <svg
        ref="svgRef"
        :viewBox="`0 0 ${VIEWPORT_W} ${VIEWPORT_H}`"
        :aria-label="ariaLabel"
        role="img"
        class="world-map-graph w-full h-full"
        xmlns="http://www.w3.org/2000/svg"
    >
        <!-- Edges rendered below nodes -->
        <g class="edges">
            <line
                v-for="edge in edges"
                :key="`edge-${edge.fromId}-${edge.toId}`"
                :x1="nodePos(edge.fromId).x"
                :y1="nodePos(edge.fromId).y"
                :x2="nodePos(edge.toId).x"
                :y2="nodePos(edge.toId).y"
                class="stroke-grimoire-accent/55 stroke-1"
                :class="[
                    newEdgeKeys.has(`${edge.fromId}-${edge.toId}`) && !prefersReducedMotion
                        ? 'animate-map-edge-enter'
                        : '',
                ]"
            />
        </g>

        <!-- Frontier nodes (muted ???, non-interactive) -->
        <g
            v-for="node in frontierNodes"
            :key="`frontier-${node.id}`"
            :transform="`translate(${nodePos(node.id).x}, ${nodePos(node.id).y})`"
            class="frontier-node"
            :class="[
                newNodeKeys.has(node.id) && !prefersReducedMotion ? 'animate-map-node-enter' : '',
            ]"
            aria-hidden="true"
        >
            <circle
                r="14"
                class="fill-grimoire-raised stroke-grimoire-text/60 stroke-1"
            />

            <text
                text-anchor="middle"
                dominant-baseline="middle"
                class="fill-grimoire-text select-none pointer-events-none"
                font-size="10"
            >
                ???
            </text>
        </g>

        <!-- Discovered nodes (interactive) -->
        <g
            v-for="node in discoveredNodes"
            :key="`node-${node.id}`"
            :transform="`translate(${nodePos(node.id).x}, ${nodePos(node.id).y})`"
            class="discovered-node cursor-pointer"
            :class="[
                newNodeKeys.has(node.id) && !prefersReducedMotion ? 'animate-map-node-enter' : '',
            ]"
            role="button"
            tabindex="0"
            :aria-label="nodeAriaLabel(node)"
            :aria-pressed="selectedNodeId === node.id"
            @click="onNodeClick(node)"
            @keydown.enter.prevent="onNodeClick(node)"
            @keydown.space.prevent="onNodeClick(node)"
        >
            <!-- Current-location ring -->
            <circle
                v-if="node.id === currentLocationId"
                r="20"
                class="fill-none stroke-grimoire-accent stroke-[3] animate-pulse"
            />

            <!-- State-coloured node circle -->
            <circle
                r="14"
                :class="nodeCircleClass(node)"
            />

            <!-- Activity marker badge -->
            <g v-if="node.hasActivityMarker">
                <circle
                    cx="10"
                    cy="-10"
                    r="5"
                    class="fill-grimoire-accent stroke-grimoire-bg stroke-1"
                />

                <text
                    x="10"
                    y="-10"
                    text-anchor="middle"
                    dominant-baseline="middle"
                    class="fill-grimoire-bg select-none pointer-events-none"
                    font-size="7"
                    font-weight="bold"
                >
                    !
                </text>
            </g>

            <!-- Node name label -->
            <title>{{ node.name }}</title>

            <text
                y="24"
                text-anchor="middle"
                dominant-baseline="hanging"
                class="select-none pointer-events-none fill-grimoire-bg stroke-grimoire-bg stroke-[4]"
                font-size="11"
                paint-order="stroke"
            >
                {{ nodeLabel(node) }}
            </text>

            <text
                y="24"
                text-anchor="middle"
                dominant-baseline="hanging"
                class="select-none pointer-events-none"
                :class="[
                    node.id === currentLocationId ? 'fill-grimoire-accent font-semibold' : 'fill-grimoire-text',
                ]"
                font-size="11"
            >
                {{ nodeLabel(node) }}
            </text>
        </g>
    </svg>
</template>

<script setup lang="ts">
export interface WorldMapCoords {
    x: number
    y: number
}

export interface WorldMapNode {
    id: string
    name: string
    coordinates: WorldMapCoords | null
    currentState: string | null
    connectedLocationIds: string[]
    hasActivityMarker: boolean
}

export interface WorldMapFrontierNode {
    id: string
    coordinates: WorldMapCoords | null
    connectedDiscoveredIds: string[]
}

export interface WorldMapEdge {
    fromId: string
    toId: string
}

interface Props {
    discoveredNodes: WorldMapNode[]
    frontierNodes: WorldMapFrontierNode[]
    edges: WorldMapEdge[]
    currentLocationId: string | null
    /** Node ids that were present on the previous data fetch — used for animation diffing. */
    previousNodeIds?: Set<string>
    ariaLabel?: string
}

const props = withDefaults(defineProps<Props>(), {
    previousNodeIds: () => new Set<string>(),
    ariaLabel: 'World map',
});

const emit = defineEmits<{
    (e: 'node-select', nodeId: string, name: string): void
}>();

const VIEWPORT_W = 600;
const VIEWPORT_H = 400;
const PADDING = 52;
const MAX_LABEL_LENGTH = 18;

const svgRef = ref<SVGSVGElement | null>(null);
const selectedNodeId = ref<string | null>(null);

const prefersReducedMotion = computed(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
});

/** All node ids (discovered + frontier) visible in this render. */
const allNodeIds = computed<Set<string>>(() => {
    const ids = new Set<string>();
    for (const n of props.discoveredNodes) ids.add(n.id);
    for (const n of props.frontierNodes) ids.add(n.id);
    return ids;
});

/** Node ids that are NEW compared to the previous snapshot (enter animation targets). */
const newNodeKeys = computed<Set<string>>(() => {
    if (props.previousNodeIds.size === 0) return new Set<string>();
    const result = new Set<string>();
    for (const id of allNodeIds.value) {
        if (!props.previousNodeIds.has(id)) result.add(id);
    }
    return result;
});

/** Edge keys that are new (both endpoints must be new). */
const newEdgeKeys = computed<Set<string>>(() => {
    const result = new Set<string>();
    for (const edge of props.edges) {
        if (newNodeKeys.value.has(edge.fromId) || newNodeKeys.value.has(edge.toId)) {
            result.add(`${edge.fromId}-${edge.toId}`);
        }
    }
    return result;
});

/** Collect all raw coordinates from nodes that have them. */
const rawCoords = computed(() => {
    const coords: Array<{ id: string; x: number; y: number }> = [];
    for (const n of props.discoveredNodes) {
        if (n.coordinates) coords.push({ id: n.id, x: n.coordinates.x, y: n.coordinates.y });
    }
    for (const n of props.frontierNodes) {
        if (n.coordinates) coords.push({ id: n.id, x: n.coordinates.x, y: n.coordinates.y });
    }
    return coords;
});

/** Coordinate ranges for normalization. */
const coordBounds = computed(() => {
    const xs = rawCoords.value.map((c) => c.x);
    const ys = rawCoords.value.map((c) => c.y);
    if (xs.length === 0) return null;
    return {
        minX: Math.min(...xs),
        maxX: Math.max(...xs),
        minY: Math.min(...ys),
        maxY: Math.max(...ys),
    };
});

/** Normalize a raw coordinate to the SVG viewport with padding. */
function normalizeCoord(x: number, y: number): { x: number; y: number } {
    const bounds = coordBounds.value;
    if (!bounds) return { x: VIEWPORT_W / 2, y: VIEWPORT_H / 2 };

    const rangeX = bounds.maxX - bounds.minX || 1;
    const rangeY = bounds.maxY - bounds.minY || 1;

    return {
        x: PADDING + ((x - bounds.minX) / rangeX) * (VIEWPORT_W - 2 * PADDING),
        y: PADDING + ((y - bounds.minY) / rangeY) * (VIEWPORT_H - 2 * PADDING),
    };
}

/**
 * Deterministic radial fallback for nodes without stored coordinates.
 * Places nodes evenly on a circle sorted by id.
 */
const fallbackPositions = computed<globalThis.Map<string, { x: number; y: number }>>(() => {
    const nodesWithoutCoords = [
        ...props.discoveredNodes.filter((n) => !n.coordinates),
        ...props.frontierNodes.filter((n) => !n.coordinates),
    ].map((n) => n.id).sort();

    const positions = new globalThis.Map<string, { x: number; y: number }>();
    const cx = VIEWPORT_W / 2;
    const cy = VIEWPORT_H / 2;
    const radius = Math.min(VIEWPORT_W, VIEWPORT_H) / 2 - PADDING;

    nodesWithoutCoords.forEach((id, index) => {
        const angle = (2 * Math.PI * index) / Math.max(nodesWithoutCoords.length, 1);
        positions.set(id, {
            x: cx + radius * Math.cos(angle),
            y: cy + radius * Math.sin(angle),
        });
    });

    return positions;
});

/** Get the final SVG position for any node id. */
function nodePos(id: string): { x: number; y: number } {
    const discovered = props.discoveredNodes.find((n) => n.id === id);
    if (discovered?.coordinates) {
        return normalizeCoord(discovered.coordinates.x, discovered.coordinates.y);
    }

    const frontier = props.frontierNodes.find((n) => n.id === id);
    if (frontier?.coordinates) {
        return normalizeCoord(frontier.coordinates.x, frontier.coordinates.y);
    }

    return fallbackPositions.value.get(id) ?? { x: VIEWPORT_W / 2, y: VIEWPORT_H / 2 };
}

/** Map location currentState to grimoire-toned Tailwind fill class. */
function nodeCircleClass(node: WorldMapNode): string {
    const base = 'stroke-1';
    const isCurrent = node.id === currentLocationId.value;
    const ring = isCurrent ? 'stroke-grimoire-accent' : 'stroke-grimoire-text/70';
    const state = (node.currentState ?? '').toUpperCase();

    if (state.includes('HOSTILE')) return `${base} ${ring} fill-red-900`;
    if (state.includes('TENSE')) return `${base} ${ring} fill-yellow-800`;
    if (state.includes('RUINED')) return `${base} ${ring} fill-stone-800`;
    if (state.includes('SAFE')) return `${base} ${ring} fill-emerald-900`;
    return `${base} ${ring} fill-grimoire-raised`;
}

function nodeLabel(node: WorldMapNode): string {
    if (node.name.length <= MAX_LABEL_LENGTH) return node.name;
    return `${node.name.slice(0, MAX_LABEL_LENGTH - 1)}…`;
}

function nodeAriaLabel(node: WorldMapNode): string {
    const isCurrent = node.id === props.currentLocationId;
    const parts = [node.name];
    if (isCurrent) parts.push('(current location)');
    if (node.hasActivityMarker) parts.push('(active quest)');
    if (node.currentState) parts.push(node.currentState);
    return parts.join(' ');
}

function onNodeClick(node: WorldMapNode): void {
    selectedNodeId.value = node.id;
    emit('node-select', node.id, node.name);
}

// Expose currentLocationId as a reactive computed for template use
const currentLocationId = computed(() => props.currentLocationId);
</script>

<style scoped>
@keyframes mapNodeEnter {
    from {
        opacity: 0;
        transform: scale(0.5);
    }
    to {
        opacity: 1;
        transform: scale(1);
    }
}

@keyframes mapEdgeEnter {
    from {
        opacity: 0;
    }
    to {
        opacity: 1;
    }
}

.animate-map-node-enter {
    animation: mapNodeEnter 0.4s ease-out forwards;
}

.animate-map-edge-enter {
    animation: mapEdgeEnter 0.4s ease-out forwards;
}
</style>

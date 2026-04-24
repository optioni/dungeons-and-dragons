import { Field, Float, ID, ObjectType } from '@nestjs/graphql';

import { MapScale } from '../world.enums.js';

/** x/y coordinates for rendering a map node in the SVG viewport. */
@ObjectType()
export class WorldMapCoordinates {
    @Field(() => Float)
    x!: number;

    @Field(() => Float)
    y!: number;
}

/** A discovered location node in the world map read model. */
@ObjectType()
export class WorldMapNode {
    @Field(() => ID)
    id!: string;

    @Field()
    name!: string;

    @Field(() => WorldMapCoordinates, { nullable: true })
    coordinates: WorldMapCoordinates | null = null;

    @Field(() => String, { nullable: true })
    currentState: string | null = null;

    @Field(() => [ID])
    connectedLocationIds!: string[];

    /** True when an active quest objective references this location. */
    @Field()
    hasActivityMarker!: boolean;
}

/**
 * An undiscovered location adjacent to a discovered location.
 * Only anonymous identity and adjacency data are exposed — no names, states, or events.
 */
@ObjectType()
export class WorldMapFrontierNode {
    /** Opaque id for edge reference only; does not correspond to a visible location id. */
    @Field(() => ID)
    id!: string;

    @Field(() => WorldMapCoordinates, { nullable: true })
    coordinates: WorldMapCoordinates | null = null;

    /** IDs of the discovered nodes that connect to this frontier node. */
    @Field(() => [ID])
    connectedDiscoveredIds!: string[];
}

/** A visible edge between two map nodes (discovered-to-discovered or discovered-to-frontier). */
@ObjectType()
export class WorldMapEdge {
    @Field(() => ID)
    fromId!: string;

    @Field(() => ID)
    toId!: string;
}

/** Complete world map read model for a campaign at a selected scale. */
@ObjectType()
export class WorldMapResponse {
    @Field(() => MapScale)
    selectedScale!: MapScale;

    @Field(() => [MapScale])
    availableScales!: MapScale[];

    /** The campaign's current location id, or null if not yet set. */
    @Field(() => ID, { nullable: true })
    currentLocationId: string | null = null;

    @Field(() => [WorldMapNode])
    discoveredNodes!: WorldMapNode[];

    @Field(() => [WorldMapFrontierNode])
    frontierNodes!: WorldMapFrontierNode[];

    @Field(() => [WorldMapEdge])
    edges!: WorldMapEdge[];
}

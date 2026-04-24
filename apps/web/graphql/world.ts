import { graphql } from './tada';

export const FACTIONS_QUERY = graphql(`
  query Factions($campaignId: ID!, $first: Int, $after: String) {
    factions(campaignId: $campaignId, first: $first, after: $after) {
      edges {
        cursor
        node {
          id
          name
          goals
          powerLevel
          playerDisposition
          territory
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`);

export const NPCS_QUERY = graphql(`
  query Npcs($campaignId: ID!, $first: Int, $after: String) {
    npcs(campaignId: $campaignId, first: $first, after: $after) {
      edges {
        cursor
        node {
          id
          name
          profession
          disposition
          currentLocationId
          partyStatus
          alive
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`);

export const NPC_PROFILE_QUERY = graphql(`
  query NpcProfile($id: ID!) {
    npc(id: $id) {
      id
      name
      description
      profession
      coreMotivation
      speechStyle
      disposition
      currentLocationId
      partyStatus
      alive
      relationships {
        id
        targetNpcId
        type
        description
        disposition
      }
    }
  }
`);

export const DIARY_ENTRIES_QUERY = graphql(`
  query DiaryEntries($campaignId: ID!, $first: Int, $after: String) {
    diaryEntries(campaignId: $campaignId, first: $first, after: $after) {
      edges {
        cursor
        node {
          id
          campaignId
          entryType
          inGameDate
          content
          createdAt
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`);

export const WORLD_EVENTS_QUERY = graphql(`
  query WorldEvents($campaignId: ID!, $status: WorldEventStatus, $first: Int, $after: String) {
    worldEvents(campaignId: $campaignId, status: $status, first: $first, after: $after) {
      edges {
        cursor
        node {
          id
          description
          status
          source
          locationId
          deadlineInGameDate
          outcome
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`);

export const LOCATION_QUERY = graphql(`
  query Location($id: ID!) {
    location(id: $id) {
      id
      name
    }
  }
`);

export const WORLD_MAP_QUERY = graphql(`
  query WorldMap($campaignId: ID!, $scale: MapScale) {
    worldMap(campaignId: $campaignId, scale: $scale) {
      selectedScale
      availableScales
      currentLocationId
      discoveredNodes {
        id
        name
        coordinates { x y }
        currentState
        connectedLocationIds
        hasActivityMarker
      }
      frontierNodes {
        id
        coordinates { x y }
        connectedDiscoveredIds
      }
      edges {
        fromId
        toId
      }
    }
  }
`);

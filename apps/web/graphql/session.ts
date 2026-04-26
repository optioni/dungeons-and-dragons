import { graphql } from './tada';

export const ACTIVE_SESSION_QUERY = graphql(`
  query ActiveSession($campaignId: ID!) {
    activeSession(campaignId: $campaignId) {
      id
      campaignId
      characterId
      sceneType
      levelUpPending
      lastInnerVoice
      startedAt
      endedAt
      combatSession {
        id
        combatants
        currentTurnIndex
        roundNumber
      }
    }
  }
`);

export const GAME_EVENTS_QUERY = graphql(`
  query GameEvents($sessionId: ID!, $last: Int = 60, $before: String) {
    gameEvents(sessionId: $sessionId, last: $last, before: $before) {
      edges {
        cursor
        node {
          id
          sessionId
          eventType
          content
          createdAt
        }
      }
      pageInfo {
        hasPreviousPage
        startCursor
      }
    }
  }
`);

export const START_SESSION_MUTATION = graphql(`
  mutation StartSession($campaignId: ID!) {
    startSession(campaignId: $campaignId) {
      id
      campaignId
      characterId
      sceneType
      levelUpPending
      startedAt
      endedAt
      combatSession {
        id
        combatants
        currentTurnIndex
        roundNumber
      }
    }
  }
`);

export const APPLY_LEVEL_UP_MUTATION = graphql(`
  mutation ApplyLevelUp($sessionId: ID!, $hitPointsRolled: Int!, $abilityScoreImprovements: AbilityScoreImprovementsInput, $feat: String) {
    applyLevelUp(sessionId: $sessionId, hitPointsRolled: $hitPointsRolled, abilityScoreImprovements: $abilityScoreImprovements, feat: $feat)
  }
`);

export const PREPARE_SPELLS_MUTATION = graphql(`
  mutation PrepareSpells($sessionId: ID!, $spells: [String!]!) {
    prepareSpells(sessionId: $sessionId, spells: $spells)
  }
`);

export const END_SESSION_MUTATION = graphql(`
  mutation EndSession($sessionId: ID!) {
    endSession(sessionId: $sessionId) {
      id
      endedAt
    }
  }
`);

export const SEND_PLAYER_INPUT_MUTATION = graphql(`
  mutation SendPlayerInput($sessionId: ID!, $text: String!) {
    sendPlayerInput(sessionId: $sessionId, text: $text)
  }
`);

export const DM_STREAM_SUBSCRIPTION = graphql(`
  subscription DmStream($sessionId: ID!) {
    dmStream(sessionId: $sessionId) {
      type
      sequence
      text
      toolName
      toolResult
      action
      pendingCheck
      status
      sceneType
      sessionId
    }
  }
`);

export const CHARACTER_QUERY_FOR_PLAY = graphql(`
  query CharacterForPlay($id: ID!) {
    character(id: $id) {
      id
      name
      level
      abilityScores
      hp
      maxHp
      ac
      conditions
      spellSlots
      preparedSpells
      deathSaveSuccesses
      deathSaveFailures
      isDead
      class {
        name
        index
        spellcastingAbility
      }
    }
  }
`);

export const SPELL_OPTIONS_QUERY = graphql(`
  query SpellOptionsForPlay($first: Int!) {
    srdSpells(first: $first) {
      edges {
        node {
          index
          name
          level
          classes
        }
      }
    }
  }
`);

export const CAMPAIGN_QUERY_FOR_PLAY = graphql(`
  query CampaignForPlay($id: ID!) {
    campaign(id: $id) {
      id
      name
      setupStatus
      hasCharacter
      status
      endedAt
      endReason
      inGameDate
      currentLocationName
    }
  }
`);

export const ACTIVE_SESSION_QUERY = `
  query ActiveSession($campaignId: ID!) {
    activeSession(campaignId: $campaignId) {
      id
      campaignId
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
`;

export const GAME_EVENTS_QUERY = `
  query GameEvents($sessionId: ID!) {
    gameEvents(sessionId: $sessionId) {
      id
      sessionId
      eventType
      content
      createdAt
    }
  }
`;

export const START_SESSION_MUTATION = `
  mutation StartSession($campaignId: ID!) {
    startSession(campaignId: $campaignId) {
      id
      campaignId
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
`;

export const APPLY_LEVEL_UP_MUTATION = `
  mutation ApplyLevelUp($sessionId: ID!, $hitPointsRolled: Int!, $abilityScoreImprovements: Object, $feat: String) {
    applyLevelUp(sessionId: $sessionId, hitPointsRolled: $hitPointsRolled, abilityScoreImprovements: $abilityScoreImprovements, feat: $feat)
  }
`;

export const END_SESSION_MUTATION = `
  mutation EndSession($sessionId: ID!) {
    endSession(sessionId: $sessionId) {
      id
      endedAt
    }
  }
`;

export const SEND_PLAYER_INPUT_MUTATION = `
  mutation SendPlayerInput($sessionId: ID!, $text: String!) {
    sendPlayerInput(sessionId: $sessionId, text: $text)
  }
`;

export const DM_STREAM_SUBSCRIPTION = `
  subscription DmStream($sessionId: ID!) {
    dmStream(sessionId: $sessionId) {
      type
      sequence
      text
      toolName
      toolResult
      action
      status
      sceneType
      sessionId
    }
  }
`;

export const CHARACTER_QUERY_FOR_PLAY = `
  query CharacterForPlay($id: ID!) {
    character(id: $id) {
      id
      name
      level
      hp
      maxHp
      ac
      conditions
      spellSlots
    }
  }
`;

export const CAMPAIGN_QUERY_FOR_PLAY = `
  query CampaignForPlay($id: ID!) {
    campaign(id: $id) {
      id
      name
      setupStatus
      hasCharacter
      status
      endedAt
      endReason
    }
  }
`;

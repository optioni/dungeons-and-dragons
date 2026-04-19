const QUEST_FIELDS = `
  id
  campaignId
  title
  description
  status
  agendaImpact
  rewardNarrative
  rewardXp
  rewardGold
  createdAt
  objectives {
    id
    description
    type
    status
    entityId
    order
  }
  entities {
    id
    entityType
    entityId
  }
`;

export const QUESTS_QUERY = `
  query Quests($campaignId: ID!, $status: QuestStatus, $first: Int, $after: String) {
    quests(campaignId: $campaignId, status: $status, first: $first, after: $after) {
      edges {
        cursor
        node {
          ${QUEST_FIELDS}
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

export const QUEST_QUERY = `
  query Quest($id: ID!) {
    quest(id: $id) {
      ${QUEST_FIELDS}
    }
  }
`;

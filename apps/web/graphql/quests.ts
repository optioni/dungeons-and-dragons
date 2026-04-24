import { graphql } from './tada';

export const QUESTS_QUERY = graphql(`
  query Quests($campaignId: ID!, $status: QuestStatus, $first: Int, $after: String) {
    quests(campaignId: $campaignId, status: $status, first: $first, after: $after) {
      edges {
        cursor
        node {
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
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`);

export const QUEST_QUERY = graphql(`
  query Quest($id: ID!) {
    quest(id: $id) {
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
    }
  }
`);

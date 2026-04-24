import { graphql } from './tada';

export const CHARACTER_BY_CAMPAIGN_QUERY = graphql(`
  query CharacterByCampaign($campaignId: ID!) {
    characterByCampaign(campaignId: $campaignId) {
      id
      name
      level
      proficiencyBonus
      hp
      maxHp
      ac
      xp
      isDead
      deathSaveSuccesses
      deathSaveFailures
      hitDiceRemaining
      conditions
      abilityScores
      spellSlots
      preparedSpells
      skillProficiencies
      goldPieces
      silverPieces
      copperPieces
      race {
        id
        name
        speed
      }
      class {
        id
        name
        hitDie
      }
    }
  }
`);

export const CHARACTER_QUERY = graphql(`
  query Character($id: ID!) {
    character(id: $id) {
      id
      name
      level
      proficiencyBonus
      hp
      maxHp
      ac
      xp
      isDead
      deathSaveSuccesses
      deathSaveFailures
      hitDiceRemaining
      conditions
      abilityScores
      spellSlots
      preparedSpells
      skillProficiencies
      goldPieces
      silverPieces
      copperPieces
      race {
        id
        name
        speed
      }
      class {
        id
        name
        hitDie
      }
    }
  }
`);

export const CHARACTER_INVENTORY_QUERY = graphql(`
  query CharacterInventory($characterId: ID!) {
    characterInventory(characterId: $characterId) {
      id
      slot
      condition
      quantity
      item {
        id
        name
        description
        itemType
        weight
        value
        srdEquipment {
          id
          name
          category
          damage
          properties
        }
      }
    }
  }
`);

export const UNEQUIP_MUTATION = graphql(`
  mutation UnequipItem($characterItemId: ID!) {
    unequipItem(characterItemId: $characterItemId) {
      id
      slot
    }
  }
`);

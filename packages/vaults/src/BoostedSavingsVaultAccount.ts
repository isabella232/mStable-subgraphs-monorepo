import { Address } from '@graphprotocol/graph-ts'
import { integer, metrics } from '@mstable/subgraph-utils'

import { BoostedSavingsVault as BoostedSavingsVaultContract } from '../generated/templates/BoostedSavingsVault/BoostedSavingsVault'

import {
  BoostedSavingsVault as BoostedSavingsVaultEntity,
  BoostedSavingsVaultAccount as BoostedSavingsVaultAccountEntity,
} from '../generated/schema'

import { BoostedSavingsVaultRewardEntry } from './BoostedSavingsVaultRewardEntry'

export namespace BoostedSavingsVaultAccount {
  export function getId(
    boostedSavingsVaultEntity: BoostedSavingsVaultEntity,
    account: Address,
  ): string {
    let accountId = account.toHexString()
    return boostedSavingsVaultEntity.id.concat('.').concat(accountId)
  }

  export function get(
    boostedSavingsVaultEntity: BoostedSavingsVaultEntity,
    account: Address,
  ): BoostedSavingsVaultAccountEntity | null {
    let id = getId(boostedSavingsVaultEntity, account)
    return BoostedSavingsVaultAccountEntity.load(id)
  }

  export function getOrCreate(
    boostedSavingsVaultEntity: BoostedSavingsVaultEntity,
    account: Address,
  ): BoostedSavingsVaultAccountEntity {
    let entity = get(boostedSavingsVaultEntity, account)
    if (entity != null) {
      return entity as BoostedSavingsVaultAccountEntity
    }

    let cumulativeClaimed = metrics.getOrCreateById(
      boostedSavingsVaultEntity.id
        .concat('.')
        .concat(account.toHexString())
        .concat('.')
        .concat('cumulativeClaimed'),
    )

    let id = getId(boostedSavingsVaultEntity, account)
    entity = new BoostedSavingsVaultAccountEntity(id)
    entity.rawBalance = integer.ZERO
    entity.boostedBalance = integer.ZERO
    entity.boostedSavingsVault = boostedSavingsVaultEntity.id
    entity.rewardPerTokenPaid = integer.ZERO
    entity.rewards = integer.ZERO
    entity.lastAction = 0
    entity.lastClaim = 0
    entity.rewardCount = 0
    entity.cumulativeClaimed = cumulativeClaimed.id

    return entity as BoostedSavingsVaultAccountEntity
  }

  export function update(
    entity: BoostedSavingsVaultAccountEntity,
    boostedSavingsVaultEntity: BoostedSavingsVaultEntity,
    contract: BoostedSavingsVaultContract,
  ): BoostedSavingsVaultAccountEntity {
    let account = entity.account

    let userData = contract.userData(account)
    let lastClaim = contract.userClaim(account)

    entity.rawBalance = contract.rawBalanceOf(account)
    entity.boostedBalance = contract.balanceOf(account)
    entity.rewardPerTokenPaid = userData.value0
    entity.rewards = userData.value1
    entity.lastAction = userData.value2.toI32()
    entity.lastClaim = lastClaim.toI32()
    entity.rewardCount = userData.value3.toI32()

    let index = 0
    while (entity.rewardCount > 0 && index <= entity.rewardCount - 1) {
      BoostedSavingsVaultRewardEntry.update(entity.id, index, account, contract)
      index++
    }

    return entity as BoostedSavingsVaultAccountEntity
  }
}

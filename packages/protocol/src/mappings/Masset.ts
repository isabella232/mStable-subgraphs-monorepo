import { Address } from '@graphprotocol/graph-ts'
import { transaction, counters, metrics, integer, token } from '@mstable/subgraph-utils'
import { Transfer as ERC20Transfer } from '@mstable/subgraph-utils/generated/Empty/ERC20Detailed'

import {
  AmpData as AmpDataEntity,
  Basset as BassetEntity,
  MintMultiTransaction as MintMultiTransactionEntity,
  MintSingleTransaction as MintSingleTransactionEntity,
  RedeemTransaction as RedeemTransactionEntity,
  SwapTransaction as SwapTransactionEntity,
} from '../../generated/schema'

import {
  CacheSizeChanged,
  FeesChanged,
  ForgeValidatorChanged,
  Minted,
  MintedMulti,
  Redeemed,
  RedeemedMulti,
  Swapped,
  Transfer,
  WeightLimitsChanged,
} from '../../generated/Masset_mUSD/Masset'
import {
  BassetAdded as Manager_BassetAdded,
  BassetStatusChanged as Manager_BassetStatusChanged,
  StartRampA as Manager_StartRampA,
  StopRampA as Manager_StopRampA,
} from '../../generated/Masset_mUSD/MassetManager'

import { mapBassetStatus, updateBasket } from '../Basket'
import { getOrCreateMasset } from '../Masset'

export function handleTransfer(event: Transfer): void {
  token.handleTransfer(event as ERC20Transfer)
}

export function handleMinted(event: Minted): void {
  let masset = event.address

  getOrCreateMasset(masset)
  updateBasket(masset)

  let massetUnits = event.params.mAssetQuantity
  let bassetUnits = event.params.inputQuantity
  let basset = event.params.input

  counters.increment(masset, 'totalMints')
  counters.increment(basset, 'totalMints')
  metrics.increment(masset, 'cumulativeMinted', massetUnits)
  metrics.increment(basset, 'cumulativeMinted', bassetUnits)

  let baseTx = transaction.fromEvent(event)
  let txEntity = new MintSingleTransactionEntity(baseTx.id)
  txEntity.timestamp = baseTx.timestamp
  txEntity.block = baseTx.block
  txEntity.hash = baseTx.hash

  txEntity.recipient = event.params.recipient
  txEntity.sender = event.params.minter
  txEntity.masset = masset.toHexString()
  txEntity.massetUnits = massetUnits
  txEntity.basset = basset.toHexString()
  txEntity.bassetUnits = bassetUnits

  txEntity.save()
}

export function handleMintedMulti(event: MintedMulti): void {
  let masset = event.address

  getOrCreateMasset(masset)
  updateBasket(masset)

  let massetUnits = event.params.mAssetQuantity
  let bassetsUnits = event.params.inputQuantities
  let bassets = event.params.inputs

  for (let i = 0; i < bassets.length; i++) {
    let basset = bassets[i]
    let bassetUnits = bassetsUnits[i]
    counters.increment(basset, 'totalMints')
    metrics.increment(basset, 'cumulativeMinted', bassetUnits)
  }

  counters.increment(masset, 'totalMints')
  metrics.increment(masset, 'cumulativeMinted', massetUnits)

  let baseTx = transaction.fromEvent(event)
  let txEntity = new MintMultiTransactionEntity(baseTx.id)
  txEntity.timestamp = baseTx.timestamp
  txEntity.block = baseTx.block
  txEntity.hash = baseTx.hash

  txEntity.recipient = event.params.recipient
  txEntity.sender = event.params.minter
  txEntity.masset = masset.toHexString()
  txEntity.massetUnits = massetUnits
  txEntity.bassets = event.params.inputs.map<string>(b => b.toHexString())
  txEntity.bassetsUnits = bassetsUnits

  txEntity.save()
}

export function handleSwapped(event: Swapped): void {
  let masset = event.address

  getOrCreateMasset(masset)
  updateBasket(masset)

  let inputBasset = BassetEntity.load(event.params.input.toHexString()) as BassetEntity
  let outputBasset = BassetEntity.load(event.params.output.toHexString()) as BassetEntity

  let outputAmountInBassetUnits = event.params.outputAmount
  let massetUnits = integer.toRatio(outputAmountInBassetUnits, outputBasset.ratio)

  counters.increment(masset, 'totalSwaps')
  metrics.increment(masset, 'cumulativeSwapped', massetUnits)
  metrics.increment(masset, 'cumulativeFeesPaid', event.params.scaledFee)

  counters.incrementById(inputBasset.totalSwapsAsInput)
  counters.incrementById(outputBasset.totalSwapsAsOutput)
  metrics.incrementById(outputBasset.cumulativeSwappedAsOutput, outputAmountInBassetUnits)

  let baseTx = transaction.fromEvent(event)
  let txEntity = new SwapTransactionEntity(baseTx.id)
  txEntity.timestamp = baseTx.timestamp
  txEntity.block = baseTx.block
  txEntity.hash = baseTx.hash

  txEntity.recipient = event.params.recipient
  txEntity.sender = event.params.swapper
  txEntity.masset = masset.toHexString()
  txEntity.massetUnits = massetUnits
  txEntity.outputBasset = outputBasset.id
  txEntity.inputBasset = inputBasset.id

  txEntity.save()
}

export function handleRedeemedMulti(event: RedeemedMulti): void {
  let masset = event.address

  getOrCreateMasset(masset)
  updateBasket(masset)

  let massetUnits = event.params.mAssetQuantity
  let bassets = event.params.outputs
  let bassetsUnits = event.params.outputQuantity
  let scaledFee = event.params.scaledFee

  for (let i = 0; i < bassets.length; i++) {
    let basset = bassets[i]
    let bassetUnits = bassetsUnits[i]
    counters.increment(basset, 'totalRedemptions')
    metrics.increment(basset, 'cumulativeRedeemed', bassetUnits)
  }

  counters.increment(masset, 'totalRedemptions')
  metrics.increment(masset, 'cumulativeRedeemed', massetUnits)
  metrics.increment(masset, 'cumulativeFeesPaid', scaledFee)

  let baseTx = transaction.fromEvent(event)
  let txEntity = new RedeemTransactionEntity(baseTx.id)
  txEntity.timestamp = baseTx.timestamp
  txEntity.block = baseTx.block
  txEntity.hash = baseTx.hash

  txEntity.recipient = event.params.recipient
  txEntity.sender = event.params.redeemer
  txEntity.masset = masset.toHexString()
  txEntity.massetUnits = massetUnits
  txEntity.bassets = bassets.map<string>(b => b.toHexString())
  txEntity.bassetsUnits = bassetsUnits

  txEntity.save()
}

export function handleRedeemed(event: Redeemed): void {
  let masset = event.address

  getOrCreateMasset(masset)
  updateBasket(masset)

  let massetUnits = event.params.mAssetQuantity
  let scaledFee = event.params.scaledFee

  let basset = event.params.output
  let bassetUnits = event.params.outputQuantity
  let bassetEntity = BassetEntity.load(basset.toHexString()) as BassetEntity
  let rawFee = integer.fromRatio(scaledFee, bassetEntity.ratio)

  counters.incrementById(bassetEntity.totalRedemptions)
  metrics.incrementById(bassetEntity.cumulativeFeesPaid, rawFee)
  metrics.incrementById(bassetEntity.cumulativeRedeemed, bassetUnits)

  counters.increment(masset, 'totalRedemptions')
  metrics.increment(masset, 'cumulativeFeesPaid', scaledFee)
  metrics.increment(masset, 'cumulativeRedeemed', massetUnits)

  let baseTx = transaction.fromEvent(event)
  let txEntity = new RedeemTransactionEntity(baseTx.id)
  txEntity.timestamp = baseTx.timestamp
  txEntity.block = baseTx.block
  txEntity.hash = baseTx.hash

  txEntity.recipient = event.params.recipient
  txEntity.sender = event.params.redeemer
  txEntity.masset = masset.toHexString()
  txEntity.massetUnits = massetUnits
  txEntity.bassets = [basset.toHexString()]
  txEntity.bassetsUnits = [bassetUnits]

  txEntity.save()
}

export function handleManager_StartRampA(event: Manager_StartRampA): void {
  getOrCreateMasset(event.address)

  let ampDataEntity = new AmpDataEntity(event.address.toHexString())
  ampDataEntity.currentA = event.params.currentA
  ampDataEntity.startTime = event.params.startTime
  ampDataEntity.targetA = event.params.targetA
  ampDataEntity.rampEndTime = event.params.rampEndTime
  ampDataEntity.save()
}

export function handleManager_StopRampA(event: Manager_StopRampA): void {
  getOrCreateMasset(event.address)

  let ampDataEntity = new AmpDataEntity(event.address.toHexString())
  ampDataEntity.currentA = event.params.currentA
  ampDataEntity.startTime = event.params.time
  ampDataEntity.targetA = event.params.currentA
  ampDataEntity.rampEndTime = event.params.time
  ampDataEntity.save()
}

export function handleCacheSizeChanged(event: CacheSizeChanged): void {
  let massetEntity = getOrCreateMasset(event.address)
  massetEntity.cacheSize = event.params.cacheSize
  massetEntity.save()
}

export function handleFeesChanged(event: FeesChanged): void {
  let massetEntity = getOrCreateMasset(event.address)
  massetEntity.feeRate = event.params.swapFee
  massetEntity.redemptionFeeRate = event.params.redemptionFee
  massetEntity.save()
}

export function handleWeightLimitsChanged(event: WeightLimitsChanged): void {
  let massetEntity = getOrCreateMasset(event.address)
  massetEntity.hardMin = event.params.min
  massetEntity.hardMax = event.params.max
  massetEntity.save()
}

export function handleForgeValidatorChanged(event: ForgeValidatorChanged): void {
  let massetEntity = getOrCreateMasset(event.address)
  massetEntity.forgeValidator = event.params.forgeValidator
  massetEntity.save()
}

export function handleManager_BassetAdded(event: Manager_BassetAdded): void {
  getOrCreateMasset(event.address)
  updateBasket(event.address)

  let bassetEntity = new BassetEntity(event.params.bAsset.toHexString())
  bassetEntity.removed = false
  bassetEntity.save()
}

export function handleManager_BassetStatusChanged(event: Manager_BassetStatusChanged): void {
  getOrCreateMasset(event.address)

  let bassetEntity = new BassetEntity(event.params.bAsset.toHexString())
  bassetEntity.status = mapBassetStatus(event.params.status)
  bassetEntity.save()
}

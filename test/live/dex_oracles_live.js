const {
  BN,           // Big Number support
  time,
  constants,    // Common constants, like the zero address and largest integers
  expectEvent,  // Assertions for emitted events
  expectRevert, // Assertions for transactions that should fail
} = require('@openzeppelin/test-helpers');

const fs = require("fs");
const path = require("path");

const chai = require('chai');
const expect = require('chai').expect;

const approveValue = constants.MAX_UINT256;

const debug = 0;


const PredictionCollateralization = artifacts.require('PredictionCollateralization');
const PredictionPool = artifacts.require('PredictionPool');
const EventLifeCycle = artifacts.require('EventLifeCycle');
const TokenTemplate = artifacts.require('TokenTemplate');
const OracleSwapEventManager = artifacts.require('OracleSwapEventManager');

const IPancakeRouter01 = artifacts.require("IPancakeRouter01");
const IPancakePair = artifacts.require("IPancakePair");

const network = process.env.NETWORK ? process.env.NETWORK : "development"

if (network !== "development") {

const deployDirectory = `${__dirname}/../../deployed`;
const deployTestTokensFileName = path.join(deployDirectory, `1_${network}_test_tokens_addresses.json`);
const deployMainContractsFileName = path.join(deployDirectory, `2_${network}_main_contracts_addresses.json`);

const UtilConstants = require(`${__dirname}/../../UtilConstants.json`)

let tokens;

(async () => {
  try {
    tokens = require(deployTestTokensFileName);

    if (!tokens.collateralToken) throw 'CollateralUndefined';
    if (!tokens.stUsd) throw 'stUsdUndefined';
    if (!tokens.stBNB) throw 'stBNBUndefined';
    if (await web3.eth.getCode(tokens.collateralToken) === "0x") throw 'CollateralNotContract';
    if (await web3.eth.getCode(tokens.stUsd) === "0x") throw 'stUsdNotContract';
    if (await web3.eth.getCode(tokens.stBNB) === "0x") throw 'stBNBNotContract';

  } catch(e) {
    console.log('\x1b[33m%s\x1b[33m\x1b[0m',
        `\n\nRUN TOKEN MIGRATIONS FIRST OR REPLACE TOKEN ADDRESSES`);
    console.log(e);
    process.exit();
  }
})();

let contractsAddresses;
(async () => {
  try {
    contractsAddresses = require(deployMainContractsFileName);

    // if (!tokens.collateralToken) throw 'CollateralUndefined';
    // if (!tokens.stUsd) throw 'stUsdUndefined';
    // if (!tokens.stBNB) throw 'stBNBUndefined';
    // if (await web3.eth.getCode(tokens.collateralToken) === "0x") throw 'CollateralNotContract';
    // if (await web3.eth.getCode(tokens.stUsd) === "0x") throw 'stUsdNotContract';
    // if (await web3.eth.getCode(tokens.stBNB) === "0x") throw 'stBNBNotContract';

    if (!contractsAddresses.predictionPool || (await web3.eth.getCode(contractsAddresses.predictionPool) === "0x")) throw 'PredictionContractsError';
    if (!contractsAddresses.eventLifeCycle || (await web3.eth.getCode(contractsAddresses.eventLifeCycle) === "0x")) throw 'ElcContractsError';
    if (!contractsAddresses.predictionCollateralization || (await web3.eth.getCode(contractsAddresses.predictionCollateralization) === "0x")) throw 'PredictionCollateralizationContractsError';
  } catch(e) {
    console.log('\x1b[33m%s\x1b[33m\x1b[0m',
        `\n\nRUN TOKEN MIGRATIONS FIRST OR REPLACE TOKEN ADDRESSES`);
    console.log(e);
    process.exit();
  }
})();

contract("LIVE: Run dex tests on testnet fork", (accounts) => {
  "use strict";

  let deployedCollateralToken;
  let deployedPredictionCollateralization;
  let deployedPredictionPool;
  let deployedEventLifeCycle;
  let deployedOracleSwapEventManager;

  let pancakePairContract;
  let dexRouter;
  let aTokenContract;
  let bTokenContract;

  let _primaryToken;

  const [ deployerAddress, eventRunnerAccount ] = accounts;

  before(async () => {
    deployedOracleSwapEventManager = await OracleSwapEventManager.at(contractsAddresses.oracleSwapEventManager);
    deployedCollateralToken = await TokenTemplate.at(tokens.collateralToken)
    deployedPredictionPool = await PredictionPool.at(contractsAddresses.predictionPool);
    deployedEventLifeCycle = await EventLifeCycle.at(contractsAddresses.eventLifeCycle);
    deployedPredictionCollateralization = await PredictionCollateralization.at(contractsAddresses.predictionCollateralization)

    pancakePairContract = await IPancakePair.at(await deployedOracleSwapEventManager._pair());

    dexRouter = await IPancakeRouter01.at(UtilConstants[network].dexRouter);

    const token0 = await pancakePairContract.token0();
    const token1 = await pancakePairContract.token1();

    _primaryToken = await deployedOracleSwapEventManager._primaryToken();

    aTokenContract = await TokenTemplate.at(token0);
    bTokenContract = await TokenTemplate.at(token1);
  });

  const swap = async (path, amountInMax, account) => {
    const amountsOutput = await dexRouter.getAmountsOut(amountInMax, path);

    const deadline = (await time.latest()).add(new BN("300"));

    return (await dexRouter.swapTokensForExactTokens(
      amountsOutput[1], // uint256 amountOut,
      amountsOutput[0], // uint256 amountInMax,
      path,             // address[] path,
      account,          // address to,
      deadline          // uint256 deadline
    ))
  }

  it('it end event normally with result (0)', async () => {
    await deployedEventLifeCycle.addOracleAddress(
      deployedOracleSwapEventManager.address
    );

    await deployedOracleSwapEventManager.prepareEvent(
      { from: eventRunnerAccount }
    );

    const timestampBefore = await time.latest();

    const duration = time.duration.minutes(30);
    await time.increase(duration);

    await deployedOracleSwapEventManager.startEvent(
      { from: eventRunnerAccount }
    );

    await time.increase(duration);

    const roundData = await deployedOracleSwapEventManager._startRoundData.call();

    await deployedOracleSwapEventManager.finalizeEvent(
      { from: eventRunnerAccount }
    );

    await time.increase(time.duration.seconds(5));

    const timestamp = await time.latest();

    const { logs } = await deployedOracleSwapEventManager.finalizeEvent(
      { from: eventRunnerAccount }
    );

    const eventCount = 2;
    assert.equal(logs.length, eventCount, `triggers must be ${eventCount} event`);

    expectEvent.inLogs(logs, 'AppEnded', {
      // nowTime: timestamp,
      eventEndTimeExpected: timestampBefore.add(duration).add(duration),
      result: new BN("0")
    });
  });

  it('it end event normally with result (1) or (-1)', async () => {
    await deployedEventLifeCycle.addOracleAddress(
      deployedOracleSwapEventManager.address
    );

    await deployedOracleSwapEventManager.prepareEvent(
      { from: eventRunnerAccount }
    );

    const timestampBefore = await time.latest();

    const duration = time.duration.minutes(30);
    await time.increase(duration);

    await deployedOracleSwapEventManager.startEvent(
      { from: eventRunnerAccount }
    );

    await time.increase(duration);

    const eventId = (await deployedOracleSwapEventManager._lastEventId())
    if (debug) console.log("eventId:                ", eventId.toNumber())

    const reserves = await pancakePairContract.getReserves()
    if (debug) console.log("reserve0:                ", reserves.reserve0.toString())
    if (debug) console.log("reserve1:                ", reserves.reserve1.toString())
    if (debug) console.log("blockTimestampLast:      ", reserves.blockTimestampLast.toString())


    if (_primaryToken) {
      if (debug) console.log("price:                   ", reserves.reserve0.div(reserves.reserve1).toString());
    } else {
      if (debug) console.log("price:                   ", reserves.reserve1.div(reserves.reserve0).toString())
    }

    const path = [aTokenContract.address, bTokenContract.address];

    const amountInBUSD = new BN(web3.utils.toWei('40000'));
    await swap(
      path,
      amountInBUSD, // amountInMax
      deployerAddress
    )

    const reserves2 = await pancakePairContract.getReserves()
    if (debug) console.log("reserve0:                ", reserves2.reserve0.toString())
    if (debug) console.log("reserve1:                ", reserves2.reserve1.toString())
    if (debug) console.log("blockTimestampLast:      ", reserves2.blockTimestampLast.toString())

    if (_primaryToken) {
      if (debug) console.log("price:                   ", reserves2.reserve0.div(reserves2.reserve1).toString())
    } else {
      if (debug) console.log("price:                   ", reserves2.reserve1.div(reserves2.reserve0).toString())
    }

    const roundData = await deployedOracleSwapEventManager._startRoundData();

    await deployedOracleSwapEventManager.finalizeEvent(
      { from: eventRunnerAccount }
    );

    await time.increase(time.duration.seconds(5));

    const timestamp = await time.latest();

    const { logs } = await deployedOracleSwapEventManager.finalizeEvent(
      { from: eventRunnerAccount }
    );

    const eventCount = 2;
    assert.equal(logs.length, eventCount, `triggers must be ${eventCount} event`);

    expectEvent.inLogs(logs, 'AppEnded', {
      // nowTime: timestamp,
      eventEndTimeExpected: timestampBefore.add(duration).add(duration),
      result: eventId % 2 ? new BN("1") : new BN("-1")
    });
  });

  it('it end event normally with result (-1) or (1)', async () => {
    await deployedEventLifeCycle.addOracleAddress(
      deployedOracleSwapEventManager.address
    );

    await deployedOracleSwapEventManager.prepareEvent(
      { from: eventRunnerAccount }
    );

    const timestampBefore = await time.latest();

    const duration = time.duration.minutes(30);
    await time.increase(duration);

    await deployedOracleSwapEventManager.startEvent(
      { from: eventRunnerAccount }
    );

    await time.increase(duration);

    const eventId = (await deployedOracleSwapEventManager._lastEventId())
    if (debug) console.log("eventId:                ", eventId.toNumber())

    const reserves = await pancakePairContract.getReserves()
    if (debug) console.log("reserve0:                ", reserves.reserve0.toString())
    if (debug) console.log("reserve1:                ", reserves.reserve1.toString())
    if (debug) console.log("blockTimestampLast:      ", reserves.blockTimestampLast.toString())


    if (_primaryToken) {
      if (debug) console.log("price:                   ", reserves.reserve0.div(reserves.reserve1).toString())
    } else {
      if (debug) console.log("price:                   ", reserves.reserve1.div(reserves.reserve0).toString())
    }

    const path = [bTokenContract.address, aTokenContract.address];

    const amountInBUSD = new BN(web3.utils.toWei('40'));
    await swap(
      path,
      amountInBUSD, // amountInMax
      deployerAddress
    )

    const reserves2 = await pancakePairContract.getReserves()
    if (debug) console.log("reserve0:                ", reserves2.reserve0.toString())
    if (debug) console.log("reserve1:                ", reserves2.reserve1.toString())
    if (debug) console.log("blockTimestampLast:      ", reserves2.blockTimestampLast.toString())

    if (_primaryToken) {
      if (debug) console.log("price:                   ", reserves2.reserve0.div(reserves2.reserve1).toString())
    } else {
      if (debug) console.log("price:                   ", reserves2.reserve1.div(reserves2.reserve0).toString())
    }

    const roundData = await deployedOracleSwapEventManager._startRoundData();

    await deployedOracleSwapEventManager.finalizeEvent(
      { from: eventRunnerAccount }
    );

    await time.increase(time.duration.seconds(5));

    const timestamp = await time.latest();

    const { logs } = await deployedOracleSwapEventManager.finalizeEvent(
      { from: eventRunnerAccount }
    );

    const eventCount = 2;
    assert.equal(logs.length, eventCount, `triggers must be ${eventCount} event`);

    expectEvent.inLogs(logs, 'AppEnded', {
      // nowTime: timestamp,
      eventEndTimeExpected: timestampBefore.add(duration).add(duration),
      result: eventId % 2 ? new BN("-1") : new BN("1")
    });
  });

});

}

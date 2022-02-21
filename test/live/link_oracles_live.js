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
const OraclePayableChainLinkEventManager = artifacts.require("OraclePayableChainLinkEventManager");

const ChainlinkAPIConsumer = artifacts.require("ChainlinkAPIConsumer");

const network = process.env.NETWORK ? process.env.NETWORK : "development"

if (network !== "development") {

const deployDirectory = `${__dirname}/../../deployed`;
const deployTestTokensFileName = path.join(deployDirectory, `1_${network}_test_tokens_addresses.json`);
const deployMainContractsFileName = path.join(deployDirectory, `2_${network}_main_contracts_addresses.json`);

const UtilConstants = require(`${__dirname}/../../UtilConstants.json`)

let contractsAddresses;
(async () => {
  try {
    contractsAddresses = require(deployMainContractsFileName);

    if (await web3.eth.getCode(UtilConstants[network].linkToken) === "0x") throw 'LinkTokenNotContract';

    if (!contractsAddresses.predictionPool || (await web3.eth.getCode(contractsAddresses.predictionPool) === "0x")) throw 'PredictionContractsError';
    if (!contractsAddresses.eventLifeCycle || (await web3.eth.getCode(contractsAddresses.eventLifeCycle) === "0x")) throw 'ElcContractsError';
    if (!contractsAddresses.predictionCollateralization || (await web3.eth.getCode(contractsAddresses.predictionCollateralization) === "0x")) throw 'PredictionCollateralizationContractsError';
    if (!contractsAddresses.chainlinkAPIConsumer || (await web3.eth.getCode(contractsAddresses.chainlinkAPIConsumer) === "0x")) throw 'ChainlinkAPIConsumerContractsError';
  } catch(e) {
    console.log('\x1b[33m%s\x1b[33m\x1b[0m',
        `\n\nRUN TOKEN MIGRATIONS FIRST OR REPLACE TOKEN ADDRESSES`);
    console.log(e);
    process.exit();
  }
})();

contract("LIVE: Run link tests on testnet fork", (accounts) => {
  "use strict";

  let deployedLinkToken;
  let deployedPredictionCollateralization;
  let deployedPredictionPool;
  let deployedEventLifeCycle;
  let deployedChainlinkAPIConsumer;
  let deployedOraclePayableChainLinkEventManager;

  const [ deployerAddress, eventRunnerAccount ] = accounts;

  before(async () => {
    deployedLinkToken = await TokenTemplate.at(UtilConstants[network].linkToken)
    deployedPredictionPool = await PredictionPool.at(contractsAddresses.predictionPool);
    deployedEventLifeCycle = await EventLifeCycle.at(contractsAddresses.eventLifeCycle);

    deployedChainlinkAPIConsumer = await ChainlinkAPIConsumer.at(contractsAddresses.chainlinkAPIConsumer);
    deployedOraclePayableChainLinkEventManager = await OraclePayableChainLinkEventManager.at(contractsAddresses.oraclePayableChainLinkEventManager);

    if (debug) console.log("contract link balance:", (await deployedLinkToken.balanceOf(deployedChainlinkAPIConsumer.address)).toString())

    const lastPrice = (await deployedChainlinkAPIConsumer.lastPrice())
    if (debug) console.log("lastPrice:", lastPrice.toString())
    if (debug) console.log("lastPrice:", web3.utils.fromWei(lastPrice))

    if (debug) console.log("contract link balance:", (await deployedLinkToken.balanceOf(deployedChainlinkAPIConsumer.address)).toString())

    await deployedOraclePayableChainLinkEventManager.addPriceConsumer(
      deployedChainlinkAPIConsumer.address,   // address priceConsumerAddress,
      "BNB",                                  // string memory token0,
      "USDT",                                 // string memory token1
    )
  });

  it('it should send link to contract', async () => {
    if (debug) console.log("contract link balance:", (await deployedLinkToken.balanceOf(deployedChainlinkAPIConsumer.address)).toString())

    const sendAmount = new BN(web3.utils.toWei("10"));

    const balanceDeployerBefore = (await deployedLinkToken.balanceOf(deployerAddress));
    const balanceContractBefore = (await deployedLinkToken.balanceOf(deployedChainlinkAPIConsumer.address));

    await deployedLinkToken.transfer(deployedChainlinkAPIConsumer.address, sendAmount, { from: deployerAddress });

    const balanceDeployerAfter = (await deployedLinkToken.balanceOf(deployerAddress));
    const balanceContractAfter = (await deployedLinkToken.balanceOf(deployedChainlinkAPIConsumer.address));
    expect(balanceDeployerAfter).to.be.bignumber.equal(balanceDeployerBefore.sub(sendAmount));
    expect(balanceContractAfter).to.be.bignumber.equal(balanceContractBefore.add(sendAmount));
    if (debug) console.log("contract link balance:", (await deployedLinkToken.balanceOf(deployedChainlinkAPIConsumer.address)).toString())
  });

  it('it should revert requestPriceData if executor not in Oracle list', async () => {
    await expectRevert(
      deployedChainlinkAPIConsumer.requestPriceData(
        "BNBUSDT",
        { from: accounts[2] }
      ), "Caller should be Oracle"
    );
  });

  it('it end event normally with result (0)', async () => {
    await deployedEventLifeCycle.addOracleAddress(
      deployedOraclePayableChainLinkEventManager.address
    );

    await deployedOraclePayableChainLinkEventManager.prepareEvent(
      { from: eventRunnerAccount }
    );

    const timestampBefore = await time.latest();

    const duration = time.duration.minutes(30);
    await time.increase(duration);

    await deployedOraclePayableChainLinkEventManager.startEvent(
      { from: eventRunnerAccount }
    );

    await time.increase(duration);

    const roundData = await deployedOraclePayableChainLinkEventManager._startRoundData.call();

    const timestamp = await time.latest();

    const { logs } = await deployedOraclePayableChainLinkEventManager.finalizeEvent(
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

  it('it should withdraw link from contract', async () => {
    if (debug) console.log("contract link balance:", (await deployedLinkToken.balanceOf(deployedChainlinkAPIConsumer.address)).toString())
    const balanceBefore = (await deployedLinkToken.balanceOf(deployedChainlinkAPIConsumer.address));
    const balanceDeployerBefore = (await deployedLinkToken.balanceOf(deployerAddress));

    await deployedChainlinkAPIConsumer.withdrawLink();

    expect(await deployedLinkToken.balanceOf(deployedChainlinkAPIConsumer.address)).to.be.bignumber.equal(new BN("0"));
    const balanceDeployerAfter = (await deployedLinkToken.balanceOf(deployerAddress));
    expect(balanceDeployerAfter).to.be.bignumber.equal(balanceDeployerBefore.add(balanceBefore));
    if (debug) console.log("contract link balance:", (await deployedLinkToken.balanceOf(deployedChainlinkAPIConsumer.address)).toString())
  });

  it('it should revert withdraw if executor not owner', async () => {
    await expectRevert(
      deployedChainlinkAPIConsumer.withdrawLink(
        { from: accounts[3] }
      ), "Revert or exceptional halt"
    );
  });

  it('it should revert withdraw if no link in contract', async () => {
    await expectRevert(
      deployedChainlinkAPIConsumer.withdrawLink(
        { from: deployerAddress }
      ), "No link tokens on this contract"
    );
  });
});

}

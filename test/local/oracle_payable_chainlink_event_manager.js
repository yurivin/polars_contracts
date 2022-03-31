const {
  BN,           // Big Number support
  time,
  constants,    // Common constants, like the zero address and largest integers
  expectEvent,  // Assertions for emitted events
  expectRevert, // Assertions for transactions that should fail
  snapshot
} = require('@openzeppelin/test-helpers');

const bigDecimal = require('js-big-decimal');

const MockContract = artifacts.require("./MockContract.sol");
const ChainlinkAPIConsumer = artifacts.require("./ChainlinkAPIConsumer.sol");

const LinkToken = artifacts.require("./LinkTokenInterface.sol")

const chai = require('chai');
const expect = require('chai').expect;

const { deployContracts, ntob, BONE } = require('./../utils.js');

const priceChangePart = ntob(0.05);

const debug = 0;

contract("DEV: OraclePayableChainLinkEventManager", function (accounts) {
  "use strict";

  let deployedPredictionPool;
  let deployedEventLifeCycle;
  let deployedPendingOrders;
  let deployedCollateralToken;
  let deployedWhiteToken;
  let deployedBlackToken;
  let deployedPredictionCollateralization;
  let deployedOraclePayableChainLinkEventManager;
  let deployedChainlinkAPIConsumer;

  let priceFeedContract;
  let nodeContract;
  let linkContract;

  let linkToken;

  let snapshotA;

  const deployerAddress = accounts[0];
  const eventRunnerAccount = accounts[1];

  const _primaryToken = 0;

  const tokenPairSymA = "BNB";
  const tokenPairSymB = "USDT";
  const tokenPairNameA = "Binance Native Token";
  const tokenPairNameB = "USD Peg Token";

  const lastEventIdInEventLC = new BN("0");

  const instanceConfig = {
    priceChangePart: new BN("50000000000000000"),    // 5%
    eventName: `${tokenPairSymA}-${tokenPairSymB}`,
    downTeam: `${tokenPairSymA}-DOWN`,
    upTeam: `${tokenPairSymA}-UP`,
    eventType: "Crypto",
    eventSeries: `${tokenPairSymA}-${tokenPairSymB}`,
    eventStartTimeOutExpected: new BN("1800"),       // 30 minutes - 1800 sec
    eventEndTimeOutExpected: new BN("1800"),         // 30 minutes - 1800 sec
  }

  before(async () => {

  });

  beforeEach(async () => {
    const deployedContracts = await deployContracts(deployerAddress);

    deployedPredictionPool = deployedContracts.deployedPredictionPool;
    deployedPredictionCollateralization = deployedContracts.deployedPredictionCollateralization;
    deployedEventLifeCycle = deployedContracts.deployedEventLifeCycle;
    deployedPendingOrders = deployedContracts.deployedPendingOrders;
    deployedCollateralToken = deployedContracts.deployedCollateralToken;
    deployedWhiteToken = deployedContracts.deployedWhiteToken;
    deployedBlackToken = deployedContracts.deployedBlackToken;
    deployedOraclePayableChainLinkEventManager = deployedContracts.deployedOraclePayableChainLinkEventManager;

    priceFeedContract = await MockContract.new()
    linkContract = await MockContract.new()
    nodeContract = accounts[6]

    const jobId = "a8a8c6207aef4891bc7c619b010305a9"
    const fee = "0.1"

    deployedChainlinkAPIConsumer = await ChainlinkAPIConsumer.new(
      nodeContract,                                   // address _oracle
      web3.utils.asciiToHex(jobId),                   // bytes32 _jobId
      web3.utils.toWei(fee),                          // uint256 _fee
      linkContract.address                            // address _link
    );
    if (debug) console.log("linkContract                :", (await linkContract.address));
    if (debug) console.log("ChainlinkAPIConsumer        :", (await deployedChainlinkAPIConsumer.address));

    const timestamp = await time.latest();

    const retSwap = web3.eth.abi.encodeParameters(['uint80','int256','int256','int256','uint80'], ['32', '42000', timestamp, timestamp, '32']);
    const retSwap2 = web3.eth.abi.encodeParameters(['uint80','int256','int256','int256','uint80'], ['32', '42000', timestamp, timestamp, '32']);
    const retDescription = web3.eth.abi.encodeParameters(['string'], ['BNB / USDT']);

    const latestRoundData = web3.eth.abi.encodeFunctionSignature('latestRoundData()')
    const getRoundData = web3.eth.abi.encodeFunctionSignature('getRoundData(uint80)')
    const description = web3.eth.abi.encodeFunctionSignature('description()')
    await priceFeedContract.givenMethodReturn(latestRoundData, retSwap)
    await priceFeedContract.givenMethodReturn(getRoundData, retSwap2)
    await priceFeedContract.givenMethodReturn(description, retDescription)

    await deployedOraclePayableChainLinkEventManager.addPriceConsumer(
      deployedChainlinkAPIConsumer.address,   // address priceConsumerAddress,
      "BNB",                                  // string memory token0,
      "USDT",                                 // string memory token1
    )
  });

  afterEach(async () => {

  });

  describe("Constructor", () => {
    it('must return values equal given parameters', async () => {
      const config = await deployedOraclePayableChainLinkEventManager._config.call();
      expect(config._whiteTeam).to.be.equals(instanceConfig.whiteTeam);
      expect(config._blackTeam).to.be.equals(instanceConfig.blackTeam);
      expect(config._eventType).to.be.equals(instanceConfig.eventType);
      expect(config._eventSeries).to.be.equals(instanceConfig.eventSeries);
      expect(config._eventStartTimeOutExpected).to.be.bignumber.equal(instanceConfig.eventStartTimeOutExpected);
      expect(config._eventEndTimeOutExpected).to.be.bignumber.equal(instanceConfig.eventEndTimeOutExpected);
      expect(config._eventName).to.be.equals(instanceConfig.eventName);
      expect(config._priceChangePart).to.be.bignumber.equal(instanceConfig.priceChangePart);
    });
  });

  describe("SetUp", () => {
    it('revert on Caller not Oracle', async () => {
      await expectRevert(
        deployedOraclePayableChainLinkEventManager.prepareEvent(
          { from: eventRunnerAccount }
        ), "Caller should be Oracle"
      );
    });

    it('don`t revert in ELC "Caller not Oracle"', async () => {
      await deployedEventLifeCycle.addOracleAddress(
        deployedOraclePayableChainLinkEventManager.address
      );

      const result = await deployedOraclePayableChainLinkEventManager.prepareEvent(
        { from: eventRunnerAccount }
      );

      const timestamp = await time.latest();

      const { logs: prepareLog } = result;

      const eventCount = 1;
      assert.equal(prepareLog.length, eventCount, `triggers must be ${eventCount} event`);

      expectEvent.inLogs(prepareLog, 'PrepareEvent', {
        createdAt: timestamp,
        priceChangePercent: instanceConfig.priceChangePart,
        eventStartTimeExpected: instanceConfig.eventStartTimeOutExpected.add(timestamp),
        eventEndTimeExpected: instanceConfig.eventEndTimeOutExpected.add(
          instanceConfig.eventStartTimeOutExpected).add(timestamp),
        blackTeam: instanceConfig.downTeam,
        whiteTeam: instanceConfig.upTeam,
        eventType: instanceConfig.eventType,
        eventSeries: instanceConfig.eventSeries,
        eventName: instanceConfig.eventName,
        eventId: new BN("1")
      });
    });
  });

  describe("prepareEvent", () => {

    describe("REVERT CASES:", () => {
      it('revert on already prepared event', async () => {
        await deployedEventLifeCycle.addOracleAddress(
          deployedOraclePayableChainLinkEventManager.address
        );

        await deployedOraclePayableChainLinkEventManager.prepareEvent(
          { from: eventRunnerAccount }
        );

        await expectRevert(
          deployedOraclePayableChainLinkEventManager.prepareEvent(
            { from: eventRunnerAccount }
          ), "Already prepared event"
        );
      });
    });

    it('it must normally prepare event with 1 log', async () => {
      await deployedEventLifeCycle.addOracleAddress(
        deployedOraclePayableChainLinkEventManager.address
      );

      const result = await deployedOraclePayableChainLinkEventManager.prepareEvent(
        { from: eventRunnerAccount }
      );

      const timestamp = await time.latest();

      const { logs } = result;

      const eventCount = 1;
      assert.equal(logs.length, eventCount, `triggers must be ${eventCount} event`);

      expectEvent.inLogs(logs, 'PrepareEvent', {
        createdAt: timestamp,
        priceChangePercent: instanceConfig.priceChangePart,
        eventStartTimeExpected: instanceConfig.eventStartTimeOutExpected.add(timestamp),
        eventEndTimeExpected: instanceConfig.eventEndTimeOutExpected.add(
          instanceConfig.eventStartTimeOutExpected).add(timestamp),
        blackTeam: instanceConfig.downTeam,
        whiteTeam: instanceConfig.upTeam,
        eventType: instanceConfig.eventType,
        eventSeries: instanceConfig.eventSeries,
        eventName: instanceConfig.eventName,
        eventId: lastEventIdInEventLC.add(new BN("1"))
      });
    });

    it('it must normally prepare event with 1 log after finalazed previous event', async () => {
      await deployedEventLifeCycle.addOracleAddress(
        deployedOraclePayableChainLinkEventManager.address
      );

      await deployedOraclePayableChainLinkEventManager.prepareEvent(
        { from: eventRunnerAccount }
      );

      const duration = time.duration.minutes(30);
      await time.increase(duration);

      await deployedOraclePayableChainLinkEventManager.startEvent(
        { from: eventRunnerAccount }
      );

      await time.increase(duration);

      const prevTimestamp = await time.latest();

      const retSwap = web3.eth.abi.encodeParameters(
        ['uint80','int256','int256','int256','uint80'], ['32', '42000', prevTimestamp, prevTimestamp, '32']);
      const retSwap2 = web3.eth.abi.encodeParameters(
        ['uint80','int256','int256','int256','uint80'], ['32', '42000', prevTimestamp, prevTimestamp, '32']);

      const latestRoundData = web3.eth.abi.encodeFunctionSignature('latestRoundData()')
      const getRoundData = web3.eth.abi.encodeFunctionSignature('getRoundData(uint80)')
      await priceFeedContract.givenMethodReturn(latestRoundData, retSwap)
      await priceFeedContract.givenMethodReturn(getRoundData, retSwap2)

      await deployedOraclePayableChainLinkEventManager.finalizeEvent(
        { from: eventRunnerAccount }
      );

      const result = await deployedOraclePayableChainLinkEventManager.prepareEvent(
        { from: eventRunnerAccount }
      );

      const timestamp = await time.latest();

      const { logs } = result;

      const eventCount = 1;
      assert.equal(logs.length, eventCount, `triggers must be ${eventCount} event`);

      expectEvent.inLogs(logs, 'PrepareEvent', {
        createdAt: timestamp,
        priceChangePercent: instanceConfig.priceChangePart,
        eventStartTimeExpected: instanceConfig.eventStartTimeOutExpected.add(timestamp),
        eventEndTimeExpected: instanceConfig.eventEndTimeOutExpected.add(
          instanceConfig.eventStartTimeOutExpected).add(timestamp),
        blackTeam: instanceConfig.upTeam,
        whiteTeam: instanceConfig.downTeam,
        eventType: instanceConfig.eventType,
        eventSeries: instanceConfig.eventSeries,
        eventName: instanceConfig.eventName,
        eventId: lastEventIdInEventLC.add(new BN("2"))
      });
    });

    it('it must normally prepare event with 1 log after delete event on too late start', async () => {
      await deployedEventLifeCycle.addOracleAddress(
        deployedOraclePayableChainLinkEventManager.address
      );

      await deployedOraclePayableChainLinkEventManager.prepareEvent(
        { from: eventRunnerAccount }
      );

      const duration = time.duration.minutes(30).add(new BN("30"));
      await time.increase(duration);

      await expectRevert(
        deployedOraclePayableChainLinkEventManager.startEvent({ from: eventRunnerAccount }), "Too late to start"
      );

      await time.increase(time.duration.seconds(10));

      const result = await deployedOraclePayableChainLinkEventManager.prepareEvent(
        { from: eventRunnerAccount }
      );

      const timestamp = await time.latest();

      const { logs } = result;

      const eventCount = 1;
      assert.equal(logs.length, eventCount, `triggers must be ${eventCount} event`);

      expectEvent.inLogs(logs, 'PrepareEvent', {
        createdAt: timestamp,
        priceChangePercent: instanceConfig.priceChangePart,
        eventStartTimeExpected: instanceConfig.eventStartTimeOutExpected.add(timestamp),
        eventEndTimeExpected: instanceConfig.eventEndTimeOutExpected.add(
          instanceConfig.eventStartTimeOutExpected).add(timestamp),
        blackTeam: instanceConfig.upTeam,
        whiteTeam: instanceConfig.downTeam,
        eventType: instanceConfig.eventType,
        eventSeries: instanceConfig.eventSeries,
        eventName: instanceConfig.eventName,
        eventId: lastEventIdInEventLC.add(new BN("2"))
      });
    });

    it('it must normally prepare event with 1 log after delete event on too late start after some good iterations', async () => {
      await deployedEventLifeCycle.addOracleAddress(
        deployedOraclePayableChainLinkEventManager.address
      );

      await deployedOraclePayableChainLinkEventManager.prepareEvent(
        { from: eventRunnerAccount }
      );

      const durationFirstIteration = time.duration.minutes(30);
      await time.increase(durationFirstIteration);

      await deployedOraclePayableChainLinkEventManager.startEvent(
        { from: eventRunnerAccount }
      );

      await time.increase(durationFirstIteration);

      const prevTimestamp = await time.latest();

      await deployedOraclePayableChainLinkEventManager.finalizeEvent(
        { from: eventRunnerAccount }
      );

      await time.increase(time.duration.seconds(10));

      await deployedOraclePayableChainLinkEventManager.prepareEvent(
        { from: eventRunnerAccount }
      );

      const duration = time.duration.minutes(30).add(new BN("30"));
      await time.increase(duration);

      await expectRevert(
        deployedOraclePayableChainLinkEventManager.startEvent({ from: eventRunnerAccount }), "Too late to start"
      );

      const result = await deployedOraclePayableChainLinkEventManager.prepareEvent(
        { from: eventRunnerAccount }
      );

      const timestamp = await time.latest();

      const { logs } = result;

      const eventCount = 1;
      assert.equal(logs.length, eventCount, `triggers must be ${eventCount} event`);

      expectEvent.inLogs(logs, 'PrepareEvent', {
        createdAt: timestamp,
        priceChangePercent: instanceConfig.priceChangePart,
        eventStartTimeExpected: instanceConfig.eventStartTimeOutExpected.add(timestamp),
        eventEndTimeExpected: instanceConfig.eventEndTimeOutExpected.add(
          instanceConfig.eventStartTimeOutExpected).add(timestamp),
        blackTeam: instanceConfig.downTeam,
        whiteTeam: instanceConfig.upTeam,
        eventType: instanceConfig.eventType,
        eventSeries: instanceConfig.eventSeries,
        eventName: instanceConfig.eventName,
        eventId: lastEventIdInEventLC.add(new BN("3"))
      });
    });
  });

  describe("startEvent", () => {
    describe("REVERT CASES:", () => {
      it('revert on not prepared event', async () => {
        await expectRevert(
          deployedOraclePayableChainLinkEventManager.startEvent({ from: eventRunnerAccount }), "Not prepared event"
        );
      });

      it('revert on not prepared event', async () => {
        await time.increase(time.duration.seconds(10));

        await expectRevert(
          deployedOraclePayableChainLinkEventManager.startEvent({ from: eventRunnerAccount }), "Not prepared event"
        );
      });

      it('revert on not prepared event', async () => {
        await time.increase(time.duration.minutes(30));

        await expectRevert(
          deployedOraclePayableChainLinkEventManager.startEvent({ from: eventRunnerAccount }), "Not prepared event"
        );
      });

      it('revert on event already started', async () => {
        await deployedEventLifeCycle.addOracleAddress(
          deployedOraclePayableChainLinkEventManager.address
        );

        await deployedOraclePayableChainLinkEventManager.prepareEvent(
          { from: eventRunnerAccount }
        );

        const duration = time.duration.minutes(30);
        await time.increase(duration);

        await deployedOraclePayableChainLinkEventManager.startEvent({ from: eventRunnerAccount });

        await expectRevert(
          deployedOraclePayableChainLinkEventManager.startEvent({ from: eventRunnerAccount }), "Event already started"
        );
      });

      it('revert on early start', async () => {
        await deployedEventLifeCycle.addOracleAddress(
          deployedOraclePayableChainLinkEventManager.address
        );

        const result = await deployedOraclePayableChainLinkEventManager.prepareEvent(
          { from: eventRunnerAccount }
        );

        await time.increase(time.duration.minutes(28));
        await expectRevert(
          deployedOraclePayableChainLinkEventManager.startEvent({ from: eventRunnerAccount }), 'Too early start',
        );
      });

      it('revert on too late', async () => {
        await deployedEventLifeCycle.addOracleAddress(
          deployedOraclePayableChainLinkEventManager.address
        );

        await deployedOraclePayableChainLinkEventManager.prepareEvent(
          { from: eventRunnerAccount }
        );

        const duration = time.duration.minutes(30).add(new BN("30"));
        await time.increase(duration);

        await expectRevert(
          deployedOraclePayableChainLinkEventManager.startEvent({ from: eventRunnerAccount }), "Too late to start",
        );
      });

      it('revert on too late', async () => {
        await deployedEventLifeCycle.addOracleAddress(
          deployedOraclePayableChainLinkEventManager.address
        );

        await deployedOraclePayableChainLinkEventManager.prepareEvent(
          { from: eventRunnerAccount }
        );

        const duration = time.duration.minutes(30).add(new BN("31"));
        await time.increase(duration);

        await expectRevert(
          deployedOraclePayableChainLinkEventManager.startEvent({ from: eventRunnerAccount }), "Too late to start",
        );
      });
    });

    it('it start event normally', async () => {
      await deployedEventLifeCycle.addOracleAddress(
        deployedOraclePayableChainLinkEventManager.address
      );

      await deployedOraclePayableChainLinkEventManager.prepareEvent(
        { from: eventRunnerAccount }
      );

      const timestampBefore = await time.latest();

      const duration = time.duration.minutes(30);
      await time.increase(duration);

      const { logs } = await deployedOraclePayableChainLinkEventManager.startEvent(
        { from: eventRunnerAccount }
      );

      const startRoundData = await deployedOraclePayableChainLinkEventManager._startRoundData.call();

      /* Need getter ?
      const _gameEvent = await deployedOraclePayableChainLinkEventManager._gameEvent.call();
      expect(_gameEvent.eventName).to.equal(instanceConfig.eventName + " " + startRoundData.price.toString());
      */

      const eventCount = 2;
      assert.equal(logs.length, eventCount, `triggers must be ${eventCount} event`);

      const roundData = await deployedOraclePayableChainLinkEventManager._startRoundData.call();

      const timestamp = await time.latest();

      expectEvent.inLogs(logs, 'AppStarted', {
        nowTime: timestamp,
        eventStartTimeExpected: timestampBefore.add(duration),
        startedAt: timestamp,
        eventName: instanceConfig.eventName + " " + startRoundData.price.toString()
      });
    });

    it('it add event data and start event normally', async () => {
      await deployedEventLifeCycle.addOracleAddress(
        deployedOraclePayableChainLinkEventManager.address
      );

      await deployedOraclePayableChainLinkEventManager.prepareEvent(
        { from: eventRunnerAccount }
      );

      const timestampBefore = await time.latest();

      const duration = time.duration.minutes(30);
      await time.increase(duration);

      const { logs } = await deployedOraclePayableChainLinkEventManager.addAndStartEvent(
        { from: eventRunnerAccount }
      );

      const startRoundData = await deployedOraclePayableChainLinkEventManager._startRoundData.call();

      /* Need getter ?
      const _gameEvent = await deployedOraclePayableChainLinkEventManager._gameEvent.call();
      expect(_gameEvent.eventName).to.equal(instanceConfig.eventName + " " + startRoundData.price.toString());
      */

      const eventCount = 2;
      assert.equal(logs.length, eventCount, `triggers must be ${eventCount} event`);

      const roundData = await deployedOraclePayableChainLinkEventManager._startRoundData.call();

      const timestamp = await time.latest();

      expectEvent.inLogs(logs, 'AppStarted', {
        nowTime: timestamp,
        eventStartTimeExpected: timestampBefore.add(duration),
        startedAt: timestamp,
        eventName: instanceConfig.eventName + " " + startRoundData.price.toString()
      });
    });
  });

  describe("finalizeEvent", () => {
    describe("REVERT CASES:", () => {
      it('revert on not prepared event, PredictionPool now opened', async () => {
        await expectRevert(
          deployedOraclePayableChainLinkEventManager.finalizeEvent({ from: eventRunnerAccount }), "Event not started"
        );
      });

      it('revert on event not started, PredictionPool now opened', async () => {
        await deployedEventLifeCycle.addOracleAddress(
          deployedOraclePayableChainLinkEventManager.address
        );

        await deployedOraclePayableChainLinkEventManager.prepareEvent(
          { from: eventRunnerAccount }
        );

        await expectRevert(
          deployedOraclePayableChainLinkEventManager.finalizeEvent({ from: eventRunnerAccount }), "Event not started"
        );
      });

      it('revert on early end', async () => {
        await deployedEventLifeCycle.addOracleAddress(
          deployedOraclePayableChainLinkEventManager.address
        );

        const duration = time.duration.minutes(30);

        await deployedOraclePayableChainLinkEventManager.prepareEvent(
          { from: eventRunnerAccount }
        );

        await time.increase(duration);

        await deployedOraclePayableChainLinkEventManager.startEvent(
          { from: eventRunnerAccount }
        )

        await time.increase(time.duration.minutes(28));
        await expectRevert(
          deployedOraclePayableChainLinkEventManager.finalizeEvent({ from: eventRunnerAccount }), 'Too early end',
        );
      });

      it('revert on already finalazed', async () => {
        await deployedEventLifeCycle.addOracleAddress(
          deployedOraclePayableChainLinkEventManager.address
        );

        await deployedOraclePayableChainLinkEventManager.prepareEvent(
          { from: eventRunnerAccount }
        );

        const duration = time.duration.minutes(30);
        await time.increase(duration);

        await deployedOraclePayableChainLinkEventManager.startEvent(
          { from: eventRunnerAccount }
        );

        await time.increase(duration);

        const prevTimestamp = await time.latest();

        const retSwap = web3.eth.abi.encodeParameters(
          ['uint80','int256','int256','int256','uint80'], ['32', '42000', prevTimestamp, prevTimestamp, '32']);
        const retSwap2 = web3.eth.abi.encodeParameters(
          ['uint80','int256','int256','int256','uint80'], ['32', '42000', prevTimestamp, prevTimestamp, '32']);
        const latestRoundData = web3.eth.abi.encodeFunctionSignature('latestRoundData()')
        const getRoundData = web3.eth.abi.encodeFunctionSignature('getRoundData(uint80)')
        await priceFeedContract.givenMethodReturn(latestRoundData, retSwap)
        await priceFeedContract.givenMethodReturn(getRoundData, retSwap2)

        await deployedOraclePayableChainLinkEventManager.finalizeEvent(
          { from: eventRunnerAccount }
        );

        await expectRevert(
          deployedOraclePayableChainLinkEventManager.finalizeEvent({ from: eventRunnerAccount }), 'Event not started',
        );
      });
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

      const retSwap = web3.eth.abi.encodeParameters(['uint80','int256','int256','int256','uint80'], ['32', '42000', timestamp, timestamp, '32']);
      const retSwap2 = web3.eth.abi.encodeParameters(['uint80','int256','int256','int256','uint80'], ['32', '42000', timestamp, timestamp, '32']);
      const latestRoundData = web3.eth.abi.encodeFunctionSignature('latestRoundData()')
      const getRoundData = web3.eth.abi.encodeFunctionSignature('getRoundData(uint80)')
      await priceFeedContract.givenMethodReturn(latestRoundData, retSwap)
      await priceFeedContract.givenMethodReturn(getRoundData, retSwap2)

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

    const requestOracle = async (price) => {

      const requestPriceFromConsumer = await deployedOraclePayableChainLinkEventManager.requestPriceFromConsumer(
        { from: accounts[5] }
      );

      const { logs: requestPriceFromConsumerLog } = requestPriceFromConsumer;

      expectEvent.inLogs(requestPriceFromConsumerLog, 'ChainlinkRequested', {});

      const priceBD = ntob(price)

      const duration = time.duration.seconds(15);
      await time.increase(duration);

      return await deployedChainlinkAPIConsumer.fulfill(
        requestPriceFromConsumer.logs[0].args.id, // bytes32 _requestId,
        new BN(priceBD),                          // uint256 _lastPrice
        { from: nodeContract }
      )
    }

    [
      28,
      29,
      30
    ].forEach((minutes) => {
      describe.skip(`Scenarios for ${minutes} minutes:`, function() {
        it('it end event normally with result (1)', async () => {
          await deployedEventLifeCycle.addOracleAddress(
            deployedOraclePayableChainLinkEventManager.address
          );

          await deployedChainlinkAPIConsumer.addRunnerAddress(
            deployedOraclePayableChainLinkEventManager.address
          );

          await deployedOraclePayableChainLinkEventManager.prepareEvent(
            { from: eventRunnerAccount }
          );

          const timestampBefore = await time.latest();

          console.log("timestampBefore             :", timestampBefore.toString());

          await time.increase(time.duration.seconds(minutes*60+31));
          const timestampAfter = await time.latest();
          console.log("timestampAfter              :", timestampAfter.toString());

          // await time.increase(time.duration.min0utes(minutes));

          /*
          if (debug) console.log("LinkTokenAddress            :", await deployedChainlinkAPIConsumer.getlinkTokenAddress());

          await linkContract.givenAnyReturnBool(true)

          const requestOracleResult = await requestOracle(500)

          await deployedOraclePayableChainLinkEventManager.startEvent(
            { from: eventRunnerAccount }
          );

          const duration = time.duration.minutes(30);
          await time.increase(duration);

          const roundData = await deployedOraclePayableChainLinkEventManager._startRoundData.call();

          const timestamp = await time.latest();

          const requestOracleResult2 = await requestOracle(501)

          const { logs } = await deployedOraclePayableChainLinkEventManager.finalizeEvent(
            { from: eventRunnerAccount }
          );

          const eventCount = 2;
          assert.equal(logs.length, eventCount, `triggers must be ${eventCount} event`);

          expectEvent.inLogs(logs, 'AppEnded', {
            // nowTime: timestamp,
            eventEndTimeExpected: timestampBefore.add(duration).add(duration),
            result: new BN("1")
          });
          */
        });
      });
    });

    it.skip('it end event normally with result (-1)', async () => {
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

      const retSwap = web3.eth.abi.encodeParameters(['uint80','int256','int256','int256','uint80'], ['32', '39000', timestamp, timestamp, '32']);
      const retSwap2 = web3.eth.abi.encodeParameters(['uint80','int256','int256','int256','uint80'], ['32', '39000', timestamp, timestamp, '32']);
      const latestRoundData = web3.eth.abi.encodeFunctionSignature('latestRoundData()')
      const getRoundData = web3.eth.abi.encodeFunctionSignature('getRoundData(uint80)')
      await priceFeedContract.givenMethodReturn(latestRoundData, retSwap)
      await priceFeedContract.givenMethodReturn(getRoundData, retSwap2)

      const { logs } = await deployedOraclePayableChainLinkEventManager.finalizeEvent(
        { from: eventRunnerAccount }
      );

      const eventCount = 2;
      assert.equal(logs.length, eventCount, `triggers must be ${eventCount} event`);

      expectEvent.inLogs(logs, 'AppEnded', {
        // nowTime: timestamp,
        eventEndTimeExpected: timestampBefore.add(duration).add(duration),
        result: new BN("-1")
      });
    });
  });

  it.skip("should assert OracleSwapEventManager._eventLifeCycle() equal EventLifeCycle address", async () => {
    return assert.equal(await deployedOraclePayableChainLinkEventManager._eventLifeCycle(), deployedEventLifeCycle.address);
  });

  it.skip("should assert OracleSwapEventManager._predictionPool() equal PredictionPool address", async () => {
    return assert.equal(await deployedOraclePayableChainLinkEventManager._predictionPool(), deployedPredictionPool.address);
  });

});

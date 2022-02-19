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

const chai = require('chai');
const expect = require('chai').expect;

const { deployContracts, ntob, BONE } = require('./../utils.js');

const priceChangePart = ntob(0.05);

contract("DEV: OracleChainlinkEventManager", function (accounts) {
  "use strict";

  let deployedPredictionPool;
  let deployedEventLifeCycle;
  let deployedPendingOrders;
  let deployedCollateralToken;
  let deployedWhiteToken;
  let deployedBlackToken;
  let deployedPredictionCollateralization;
  let deployedOracleChainlinkEventManager;

  let priceFeedContract;

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
    deployedOracleChainlinkEventManager = deployedContracts.deployedOracleChainlinkEventManager;

    priceFeedContract = await MockContract.new()

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

    await deployedOracleChainlinkEventManager.addPriceFeed(
      priceFeedContract.address, "BNB", "USDT"
    )
  });

  afterEach(async () => {

  });

  describe("Constructor", () => {
    it('must return values equal given parameters', async () => {
      const config = await deployedOracleChainlinkEventManager._config.call();
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
        deployedOracleChainlinkEventManager.prepareEvent(
          { from: eventRunnerAccount }
        ), "Caller should be Oracle"
      );
    });

    it('don`t revert in ELC "Caller not Oracle"', async () => {
      await deployedEventLifeCycle.addOracleAddress(
        deployedOracleChainlinkEventManager.address
      );

      const result = await deployedOracleChainlinkEventManager.prepareEvent(
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
          deployedOracleChainlinkEventManager.address
        );

        await deployedOracleChainlinkEventManager.prepareEvent(
          { from: eventRunnerAccount }
        );

        await expectRevert(
          deployedOracleChainlinkEventManager.prepareEvent(
            { from: eventRunnerAccount }
          ), "Already prepared event"
        );
      });
    });

    it('it must normally prepare event with 1 log', async () => {
      await deployedEventLifeCycle.addOracleAddress(
        deployedOracleChainlinkEventManager.address
      );

      const result = await deployedOracleChainlinkEventManager.prepareEvent(
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
        deployedOracleChainlinkEventManager.address
      );

      await deployedOracleChainlinkEventManager.prepareEvent(
        { from: eventRunnerAccount }
      );

      const duration = time.duration.minutes(30);
      await time.increase(duration);

      await deployedOracleChainlinkEventManager.startEvent(
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

      await deployedOracleChainlinkEventManager.finalizeEvent(
        { from: eventRunnerAccount }
      );

      const result = await deployedOracleChainlinkEventManager.prepareEvent(
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
        deployedOracleChainlinkEventManager.address
      );

      await deployedOracleChainlinkEventManager.prepareEvent(
        { from: eventRunnerAccount }
      );

      const duration = time.duration.minutes(30).add(new BN("30"));
      await time.increase(duration);

      await expectRevert(
        deployedOracleChainlinkEventManager.startEvent({ from: eventRunnerAccount }), "Too late to start"
      );

      await time.increase(time.duration.seconds(10));

      const result = await deployedOracleChainlinkEventManager.prepareEvent(
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
        deployedOracleChainlinkEventManager.address
      );

      await deployedOracleChainlinkEventManager.prepareEvent(
        { from: eventRunnerAccount }
      );

      const durationFirstIteration = time.duration.minutes(30);
      await time.increase(durationFirstIteration);

      await deployedOracleChainlinkEventManager.startEvent(
        { from: eventRunnerAccount }
      );

      await time.increase(durationFirstIteration);

      const prevTimestamp = await time.latest();

      await deployedOracleChainlinkEventManager.finalizeEvent(
        { from: eventRunnerAccount }
      );

      await time.increase(time.duration.seconds(10));

      await deployedOracleChainlinkEventManager.prepareEvent(
        { from: eventRunnerAccount }
      );

      const duration = time.duration.minutes(30).add(new BN("30"));
      await time.increase(duration);

      await expectRevert(
        deployedOracleChainlinkEventManager.startEvent({ from: eventRunnerAccount }), "Too late to start"
      );

      const result = await deployedOracleChainlinkEventManager.prepareEvent(
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
          deployedOracleChainlinkEventManager.startEvent({ from: eventRunnerAccount }), "Not prepared event"
        );
      });

      it('revert on not prepared event', async () => {
        await time.increase(time.duration.seconds(10));

        await expectRevert(
          deployedOracleChainlinkEventManager.startEvent({ from: eventRunnerAccount }), "Not prepared event"
        );
      });

      it('revert on not prepared event', async () => {
        await time.increase(time.duration.minutes(30));

        await expectRevert(
          deployedOracleChainlinkEventManager.startEvent({ from: eventRunnerAccount }), "Not prepared event"
        );
      });

      it('revert on event already started', async () => {
        await deployedEventLifeCycle.addOracleAddress(
          deployedOracleChainlinkEventManager.address
        );

        await deployedOracleChainlinkEventManager.prepareEvent(
          { from: eventRunnerAccount }
        );

        const duration = time.duration.minutes(30);
        await time.increase(duration);

        await deployedOracleChainlinkEventManager.startEvent({ from: eventRunnerAccount });

        await expectRevert(
          deployedOracleChainlinkEventManager.startEvent({ from: eventRunnerAccount }), "Event already started"
        );
      });

      it('revert on early start', async () => {
        await deployedEventLifeCycle.addOracleAddress(
          deployedOracleChainlinkEventManager.address
        );

        const result = await deployedOracleChainlinkEventManager.prepareEvent(
          { from: eventRunnerAccount }
        );

        await time.increase(time.duration.minutes(28));
        await expectRevert(
          deployedOracleChainlinkEventManager.startEvent({ from: eventRunnerAccount }), 'Too early start',
        );
      });

      it('revert on too late', async () => {
        await deployedEventLifeCycle.addOracleAddress(
          deployedOracleChainlinkEventManager.address
        );

        await deployedOracleChainlinkEventManager.prepareEvent(
          { from: eventRunnerAccount }
        );

        const duration = time.duration.minutes(30).add(new BN("30"));
        await time.increase(duration);

        await expectRevert(
          deployedOracleChainlinkEventManager.startEvent({ from: eventRunnerAccount }), "Too late to start",
        );
      });

      it('revert on too late', async () => {
        await deployedEventLifeCycle.addOracleAddress(
          deployedOracleChainlinkEventManager.address
        );

        await deployedOracleChainlinkEventManager.prepareEvent(
          { from: eventRunnerAccount }
        );

        const duration = time.duration.minutes(30).add(new BN("31"));
        await time.increase(duration);

        await expectRevert(
          deployedOracleChainlinkEventManager.startEvent({ from: eventRunnerAccount }), "Too late to start",
        );
      });
    });

    it('it start event normally', async () => {
      await deployedEventLifeCycle.addOracleAddress(
        deployedOracleChainlinkEventManager.address
      );

      await deployedOracleChainlinkEventManager.prepareEvent(
        { from: eventRunnerAccount }
      );

      const timestampBefore = await time.latest();

      const duration = time.duration.minutes(30);
      await time.increase(duration);

      const { logs } = await deployedOracleChainlinkEventManager.startEvent(
        { from: eventRunnerAccount }
      );

      const startRoundData = await deployedOracleChainlinkEventManager._startRoundData.call();

      /* Need getter ?
      const _gameEvent = await deployedOracleChainlinkEventManager._gameEvent.call();
      expect(_gameEvent.eventName).to.equal(instanceConfig.eventName + " " + startRoundData.price.toString());
      */

      const eventCount = 2;
      assert.equal(logs.length, eventCount, `triggers must be ${eventCount} event`);

      const roundData = await deployedOracleChainlinkEventManager._startRoundData.call();

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
        deployedOracleChainlinkEventManager.address
      );

      await deployedOracleChainlinkEventManager.prepareEvent(
        { from: eventRunnerAccount }
      );

      const timestampBefore = await time.latest();

      const duration = time.duration.minutes(30);
      await time.increase(duration);

      const { logs } = await deployedOracleChainlinkEventManager.addAndStartEvent(
        { from: eventRunnerAccount }
      );

      const startRoundData = await deployedOracleChainlinkEventManager._startRoundData.call();

      /* Need getter ?
      const _gameEvent = await deployedOracleChainlinkEventManager._gameEvent.call();
      expect(_gameEvent.eventName).to.equal(instanceConfig.eventName + " " + startRoundData.price.toString());
      */

      const eventCount = 2;
      assert.equal(logs.length, eventCount, `triggers must be ${eventCount} event`);

      const roundData = await deployedOracleChainlinkEventManager._startRoundData.call();

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
          deployedOracleChainlinkEventManager.finalizeEvent({ from: eventRunnerAccount }), "Event not started"
        );
      });

      it('revert on event not started, PredictionPool now opened', async () => {
        await deployedEventLifeCycle.addOracleAddress(
          deployedOracleChainlinkEventManager.address
        );

        await deployedOracleChainlinkEventManager.prepareEvent(
          { from: eventRunnerAccount }
        );

        await expectRevert(
          deployedOracleChainlinkEventManager.finalizeEvent({ from: eventRunnerAccount }), "Event not started"
        );
      });

      it('revert on early end', async () => {
        await deployedEventLifeCycle.addOracleAddress(
          deployedOracleChainlinkEventManager.address
        );

        const duration = time.duration.minutes(30);

        await deployedOracleChainlinkEventManager.prepareEvent(
          { from: eventRunnerAccount }
        );

        await time.increase(duration);

        await deployedOracleChainlinkEventManager.startEvent(
          { from: eventRunnerAccount }
        )

        await time.increase(time.duration.minutes(28));
        await expectRevert(
          deployedOracleChainlinkEventManager.finalizeEvent({ from: eventRunnerAccount }), 'Too early end',
        );
      });

      it('revert on already finalazed', async () => {
        await deployedEventLifeCycle.addOracleAddress(
          deployedOracleChainlinkEventManager.address
        );

        await deployedOracleChainlinkEventManager.prepareEvent(
          { from: eventRunnerAccount }
        );

        const duration = time.duration.minutes(30);
        await time.increase(duration);

        await deployedOracleChainlinkEventManager.startEvent(
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

        await deployedOracleChainlinkEventManager.finalizeEvent(
          { from: eventRunnerAccount }
        );

        await expectRevert(
          deployedOracleChainlinkEventManager.finalizeEvent({ from: eventRunnerAccount }), 'Event not started',
        );
      });
    });

    it('it end event normally with result (0)', async () => {
      await deployedEventLifeCycle.addOracleAddress(
        deployedOracleChainlinkEventManager.address
      );

      await deployedOracleChainlinkEventManager.prepareEvent(
        { from: eventRunnerAccount }
      );

      const timestampBefore = await time.latest();

      const duration = time.duration.minutes(30);
      await time.increase(duration);

      await deployedOracleChainlinkEventManager.startEvent(
        { from: eventRunnerAccount }
      );

      await time.increase(duration);

      const roundData = await deployedOracleChainlinkEventManager._startRoundData.call();

      const timestamp = await time.latest();

      const retSwap = web3.eth.abi.encodeParameters(['uint80','int256','int256','int256','uint80'], ['32', '42000', timestamp, timestamp, '32']);
      const retSwap2 = web3.eth.abi.encodeParameters(['uint80','int256','int256','int256','uint80'], ['32', '42000', timestamp, timestamp, '32']);
      const latestRoundData = web3.eth.abi.encodeFunctionSignature('latestRoundData()')
      const getRoundData = web3.eth.abi.encodeFunctionSignature('getRoundData(uint80)')
      await priceFeedContract.givenMethodReturn(latestRoundData, retSwap)
      await priceFeedContract.givenMethodReturn(getRoundData, retSwap2)

      const { logs } = await deployedOracleChainlinkEventManager.finalizeEvent(
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

    it('it end event normally with result (1)', async () => {
      await deployedEventLifeCycle.addOracleAddress(
        deployedOracleChainlinkEventManager.address
      );

      await deployedOracleChainlinkEventManager.prepareEvent(
        { from: eventRunnerAccount }
      );

      const timestampBefore = await time.latest();

      const duration = time.duration.minutes(30);
      await time.increase(duration);

      await deployedOracleChainlinkEventManager.startEvent(
        { from: eventRunnerAccount }
      );

      await time.increase(duration);

      const roundData = await deployedOracleChainlinkEventManager._startRoundData.call();

      const timestamp = await time.latest();

      const retSwap = web3.eth.abi.encodeParameters(['uint80','int256','int256','int256','uint80'], ['32', '42500', timestamp, timestamp, '32']);
      const retSwap2 = web3.eth.abi.encodeParameters(['uint80','int256','int256','int256','uint80'], ['32', '42500', timestamp, timestamp, '32']);
      const latestRoundData = web3.eth.abi.encodeFunctionSignature('latestRoundData()')
      const getRoundData = web3.eth.abi.encodeFunctionSignature('getRoundData(uint80)')
      await priceFeedContract.givenMethodReturn(latestRoundData, retSwap)
      await priceFeedContract.givenMethodReturn(getRoundData, retSwap2)

      const { logs } = await deployedOracleChainlinkEventManager.finalizeEvent(
        { from: eventRunnerAccount }
      );

      const eventCount = 2;
      assert.equal(logs.length, eventCount, `triggers must be ${eventCount} event`);

      expectEvent.inLogs(logs, 'AppEnded', {
        // nowTime: timestamp,
        eventEndTimeExpected: timestampBefore.add(duration).add(duration),
        result: new BN("1")
      });
    });

    it('it end event normally with result (-1)', async () => {
      await deployedEventLifeCycle.addOracleAddress(
        deployedOracleChainlinkEventManager.address
      );

      await deployedOracleChainlinkEventManager.prepareEvent(
        { from: eventRunnerAccount }
      );

      const timestampBefore = await time.latest();

      const duration = time.duration.minutes(30);
      await time.increase(duration);

      await deployedOracleChainlinkEventManager.startEvent(
        { from: eventRunnerAccount }
      );

      await time.increase(duration);

      const roundData = await deployedOracleChainlinkEventManager._startRoundData.call();

      const timestamp = await time.latest();

      const retSwap = web3.eth.abi.encodeParameters(['uint80','int256','int256','int256','uint80'], ['32', '39000', timestamp, timestamp, '32']);
      const retSwap2 = web3.eth.abi.encodeParameters(['uint80','int256','int256','int256','uint80'], ['32', '39000', timestamp, timestamp, '32']);
      const latestRoundData = web3.eth.abi.encodeFunctionSignature('latestRoundData()')
      const getRoundData = web3.eth.abi.encodeFunctionSignature('getRoundData(uint80)')
      await priceFeedContract.givenMethodReturn(latestRoundData, retSwap)
      await priceFeedContract.givenMethodReturn(getRoundData, retSwap2)

      const { logs } = await deployedOracleChainlinkEventManager.finalizeEvent(
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

  it("should assert OracleSwapEventManager._eventLifeCycle() equal EventLifeCycle address", async () => {
    return assert.equal(await deployedOracleChainlinkEventManager._eventLifeCycle(), deployedEventLifeCycle.address);
  });

  it("should assert OracleSwapEventManager._predictionPool() equal PredictionPool address", async () => {
    return assert.equal(await deployedOracleChainlinkEventManager._predictionPool(), deployedPredictionPool.address);
  });

});

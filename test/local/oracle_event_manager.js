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

contract("DEV: OracleSwapEventManager", function (accounts) {
  "use strict";

  let deployedPredictionPool;
  let deployedEventLifeCycle;
  let deployedPendingOrders;
  let deployedCollateralToken;
  let deployedWhiteToken;
  let deployedBlackToken;
  let deployedPredictionCollateralization;
  let deployedOracleSwapEventManager;

  let pancakePairContract;
  let aTokenContract;
  let bTokenContract;

  let snapshotA;

  const deployerAddress = accounts[0];
  const eventRunnerAccount = accounts[1];

  const _primaryToken = 0;

  const tokenPairSymA = "BNB";
  const tokenPairSymB = "USDT";
  const tokenPairNameA = "Binance Native Token";
  const tokenPairNameB = "USD Peg Token";

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
    deployedOracleSwapEventManager = deployedContracts.deployedOracleSwapEventManager;

    pancakePairContract = await MockContract.new()
    aTokenContract = await MockContract.new()
    bTokenContract = await MockContract.new()

    const aReserve = new BN('1');
    const bReserve = new BN('500');

    const timestamp = await time.latest();

    const getReserves = web3.eth.abi.encodeFunctionSignature('getReserves()')
    const erc20name = web3.eth.abi.encodeFunctionSignature('name()')
    const erc20sym = web3.eth.abi.encodeFunctionSignature('symbol()')
    const token0 = web3.eth.abi.encodeFunctionSignature('token0()')
    const token1 = web3.eth.abi.encodeFunctionSignature('token1()')
    const retSwap3 = web3.eth.abi.encodeParameters(['uint112','uint112','uint32'], [aReserve, bReserve, timestamp]);
    await pancakePairContract.givenMethodReturn(getReserves, retSwap3)
    await pancakePairContract.givenMethodReturnAddress(token0, aTokenContract.address)
    await pancakePairContract.givenMethodReturnAddress(token1, bTokenContract.address)

    const aTokenNameRet = web3.eth.abi.encodeParameters(['string'], [tokenPairNameA]);
    const bTokenNameRet = web3.eth.abi.encodeParameters(['string'], [tokenPairNameB]);
    const aTokenSymRet = web3.eth.abi.encodeParameters(['string'], [tokenPairSymA]);
    const bTokenSymRet = web3.eth.abi.encodeParameters(['string'], [tokenPairSymB]);
    await aTokenContract.givenMethodReturn(erc20name, aTokenNameRet)
    await bTokenContract.givenMethodReturn(erc20name, bTokenNameRet)
    await aTokenContract.givenMethodReturn(erc20sym, aTokenSymRet)
    await bTokenContract.givenMethodReturn(erc20sym, bTokenSymRet)

    await deployedOracleSwapEventManager.addDex(
        pancakePairContract.address, _primaryToken
    )
  });

  afterEach(async () => {

  });

  describe("Constructor", () => {
    it('must return values equal given parameters', async () => {
      const config = await deployedOracleSwapEventManager._config.call();
      expect(config._upTeam).to.be.equals(instanceConfig.upTeam);
      expect(config._downTeam).to.be.equals(instanceConfig.downTeam);
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
        deployedOracleSwapEventManager.prepareEvent(
          { from: eventRunnerAccount }
        ), "Caller should be Oracle"
      );
    });

    it('don`t revert in ELC "Caller not Oracle"', async () => {
      await deployedEventLifeCycle.addOracleAddress(
        deployedOracleSwapEventManager.address
      );

      const result = await deployedOracleSwapEventManager.prepareEvent(
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

      // it.only('revert on PredictionPool now closed', async () => {
      //   // const _eventStarted = web3.eth.abi.encodeFunctionSignature('_eventStarted()')
      //   // await predictionPoolContract.givenMethodReturnBool(_eventStarted, true)

      //   await expectRevert(
      //     deployedOracleSwapEventManager.prepareEvent(
      //       { from: eventRunnerAccount }
      //     ), "PP closed"
      //   );
      // });

      it('revert on already prepared event', async () => {
        await deployedEventLifeCycle.addOracleAddress(
          deployedOracleSwapEventManager.address
        );

        await deployedOracleSwapEventManager.prepareEvent(
          { from: eventRunnerAccount }
        );

        await expectRevert(
          deployedOracleSwapEventManager.prepareEvent(
            { from: eventRunnerAccount }
          ), "Already prepared event"
        );
      });
    });

    it('it must normally prepare event with 1 log', async () => {
      await deployedEventLifeCycle.addOracleAddress(
        deployedOracleSwapEventManager.address
      );

      const result = await deployedOracleSwapEventManager.prepareEvent(
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
        eventId: new BN("1")
      });
    });

    it('it must normally prepare event with 1 log after finalazed previous event', async () => {
      await deployedEventLifeCycle.addOracleAddress(
        deployedOracleSwapEventManager.address
      );

      await deployedOracleSwapEventManager.prepareEvent(
        { from: eventRunnerAccount }
      );

      const duration = time.duration.minutes(30);
      await time.increase(duration);

      await deployedOracleSwapEventManager.startEvent(
        { from: eventRunnerAccount }
      );

      // const _eventStarted = web3.eth.abi.encodeFunctionSignature('_eventStarted()')
      // await predictionPoolContract.givenMethodReturnBool(_eventStarted, true)

      await time.increase(duration);

      await deployedOracleSwapEventManager.finalizeEvent(
        { from: eventRunnerAccount }
      );
      await time.increase(time.duration.seconds(5));

      // const prevTimestamp = await time.latest();

      await deployedOracleSwapEventManager.finalizeEvent(
        { from: eventRunnerAccount }
      );

      // await predictionPoolContract.givenMethodReturnBool(_eventStarted, false)

      const result = await deployedOracleSwapEventManager.prepareEvent(
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
        eventId: new BN("2")
      });
    });

    it('it must normally prepare event with 1 log after delete event on too late start', async () => {
      await deployedEventLifeCycle.addOracleAddress(
        deployedOracleSwapEventManager.address
      );

      await deployedOracleSwapEventManager.prepareEvent(
        { from: eventRunnerAccount }
      );

      const duration = time.duration.minutes(30).add(new BN("30"));
      await time.increase(duration);

      await expectRevert(
        deployedOracleSwapEventManager.startEvent({ from: eventRunnerAccount }), "Too late to start"
      );

      await time.increase(time.duration.seconds(10));

      const result = await deployedOracleSwapEventManager.prepareEvent(
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
        eventId: new BN("2")
      });
    });

    it('it must normally prepare event with 1 log after delete event on too late start after some good iterations', async () => {
      await deployedEventLifeCycle.addOracleAddress(
        deployedOracleSwapEventManager.address
      );

      await deployedOracleSwapEventManager.prepareEvent(
        { from: eventRunnerAccount }
      );

      const durationFirstIteration = time.duration.minutes(30);
      await time.increase(durationFirstIteration);

      await deployedOracleSwapEventManager.startEvent(
        { from: eventRunnerAccount }
      );

      // const _eventStarted = web3.eth.abi.encodeFunctionSignature('_eventStarted()')
      // await predictionPoolContract.givenMethodReturnBool(_eventStarted, true)

      await time.increase(durationFirstIteration);

      await deployedOracleSwapEventManager.finalizeEvent(
        { from: eventRunnerAccount }
      );
      await time.increase(time.duration.seconds(5));

      // const prevTimestamp = await time.latest();

      await deployedOracleSwapEventManager.finalizeEvent(
        { from: eventRunnerAccount }
      );

      // await predictionPoolContract.givenMethodReturnBool(_eventStarted, false)

      await time.increase(time.duration.seconds(10));

      await deployedOracleSwapEventManager.prepareEvent(
        { from: eventRunnerAccount }
      );

      const duration = time.duration.minutes(30).add(new BN("30"));
      await time.increase(duration);

      await expectRevert(
        deployedOracleSwapEventManager.startEvent({ from: eventRunnerAccount }), "Too late to start"
      );

      const result = await deployedOracleSwapEventManager.prepareEvent(
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
        eventId: new BN("3")
      });
    });
  });

  describe("startEvent", () => {
    describe("REVERT CASES:", () => {
      it('revert on not prepared event', async () => {

        // await time.increase(time.duration.seconds(10));

        await expectRevert(
          deployedOracleSwapEventManager.startEvent(
            { from: eventRunnerAccount }
          ), "Not prepared event"
        );
      });

      it('revert on not prepared event (10 seconds)', async () => { // ???
        await time.increase(time.duration.seconds(10));

        await expectRevert(
          deployedOracleSwapEventManager.startEvent(
            { from: eventRunnerAccount }
          ), "Not prepared event"
        );
      });

      it('revert on not prepared event (30 minutes)', async () => { // ???
        await time.increase(time.duration.minutes(30));

        await expectRevert(
          deployedOracleSwapEventManager.startEvent(
            { from: eventRunnerAccount }
          ), "Not prepared event"
        );
      });

      it('revert on event already started', async () => {
        await deployedEventLifeCycle.addOracleAddress(
          deployedOracleSwapEventManager.address
        );

        await deployedOracleSwapEventManager.prepareEvent(
          { from: eventRunnerAccount }
        );

        const duration = time.duration.minutes(30);
        await time.increase(duration);

        await deployedOracleSwapEventManager.startEvent(
          { from: eventRunnerAccount }
        );

        // const _eventStarted = web3.eth.abi.encodeFunctionSignature('_eventStarted()')
        // await predictionPoolContract.givenMethodReturnBool(_eventStarted, true)

        await expectRevert(
          deployedOracleSwapEventManager.startEvent(
            { from: eventRunnerAccount }
          ), "Event already started"
        );
      });

      it('revert on early start', async () => {
        await deployedEventLifeCycle.addOracleAddress(
          deployedOracleSwapEventManager.address
        );

        const result = await deployedOracleSwapEventManager.prepareEvent(
          { from: eventRunnerAccount }
        );

        await time.increase(time.duration.minutes(28));
        await expectRevert(
          deployedOracleSwapEventManager.startEvent(
            { from: eventRunnerAccount }
          ), 'Too early start',
        );
      });

      it('revert on too late', async () => {
        await deployedEventLifeCycle.addOracleAddress(
          deployedOracleSwapEventManager.address
        );

        await deployedOracleSwapEventManager.prepareEvent(
          { from: eventRunnerAccount }
        );

        const duration = time.duration.minutes(30).add(new BN("30"));
        await time.increase(duration);

        await expectRevert(
          deployedOracleSwapEventManager.startEvent(
            { from: eventRunnerAccount }
          ), "Too late to start",
        );
      });

      it('revert on too late', async () => {
        await deployedEventLifeCycle.addOracleAddress(
          deployedOracleSwapEventManager.address
        );

        await deployedOracleSwapEventManager.prepareEvent(
          { from: eventRunnerAccount }
        );

        const duration = time.duration.minutes(30).add(new BN("31"));
        await time.increase(duration);

        await expectRevert(
          deployedOracleSwapEventManager.startEvent(
            { from: eventRunnerAccount }
          ), "Too late to start",
        );
      });
    });

    it('it start event normally', async () => {
      await deployedEventLifeCycle.addOracleAddress(
        deployedOracleSwapEventManager.address
      );

      await deployedOracleSwapEventManager.prepareEvent(
        { from: eventRunnerAccount }
      );

      const timestampBefore = await time.latest();

      const duration = time.duration.minutes(30);
      await time.increase(duration);

      const { logs } = await deployedOracleSwapEventManager.startEvent(
        { from: eventRunnerAccount }
      );

      const startRoundData = await deployedOracleSwapEventManager._startRoundData.call();

      /* Need getter ?
      const _gameEvent = await deployedOracleSwapEventManager._gameEvent.call();
      expect(_gameEvent.eventName).to.equal(instanceConfig.eventName + " " + startRoundData.price.toString());
      */

      const eventCount = 2;
      assert.equal(logs.length, eventCount, `triggers must be ${eventCount} event`);

      const roundData = await deployedOracleSwapEventManager._startRoundData.call();

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
        deployedOracleSwapEventManager.address
      );

      await deployedEventLifeCycle.addOracleAddress(
        deployedOracleSwapEventManager.address
      );

      await deployedOracleSwapEventManager.prepareEvent(
        { from: eventRunnerAccount }
      );

      const timestampBefore = await time.latest();

      const duration = time.duration.minutes(30);
      await time.increase(duration);

      const { logs } = await deployedOracleSwapEventManager.addAndStartEvent(
        { from: eventRunnerAccount }
      );

      const startRoundData = await deployedOracleSwapEventManager._startRoundData.call();
      /* Need getter ?
      const _gameEvent = await deployedOracleSwapEventManager._gameEvent.call();
      expect(_gameEvent.eventName).to.equal(instanceConfig.eventName + " " + startRoundData.price.toString());
      */

      const eventCount = 2;
      assert.equal(logs.length, eventCount, `triggers must be ${eventCount} event`);

      const roundData = await deployedOracleSwapEventManager._startRoundData.call();

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
          deployedOracleSwapEventManager.finalizeEvent(
            { from: eventRunnerAccount }
          ), "Event not started"
        );
      });

      it('revert on not prepared event, PredictionPool now closed', async () => {
        await deployedEventLifeCycle.addOracleAddress(
          deployedOracleSwapEventManager.address
        );

        await expectRevert(
          deployedOracleSwapEventManager.finalizeEvent(
            { from: eventRunnerAccount }
          ), "Event not started"
        );
      });

      it('revert on event not started, PredictionPool now opened', async () => {
        await deployedEventLifeCycle.addOracleAddress(
          deployedOracleSwapEventManager.address
        );

        await deployedOracleSwapEventManager.prepareEvent(
          { from: eventRunnerAccount }
        );

        await expectRevert(
            deployedOracleSwapEventManager.finalizeEvent({ from: eventRunnerAccount }), "Event not started"
        );
      });

      it('revert on event not started, PredictionPool now closed', async () => {
        await deployedEventLifeCycle.addOracleAddress(
          deployedOracleSwapEventManager.address
        );

        await deployedOracleSwapEventManager.prepareEvent(
          { from: eventRunnerAccount }
        );

        await expectRevert(
          deployedOracleSwapEventManager.finalizeEvent({ from: eventRunnerAccount }), "Event not started"
        );
      });

      it('revert on early end', async () => {
        await deployedEventLifeCycle.addOracleAddress(
          deployedOracleSwapEventManager.address
        );

        const duration = time.duration.minutes(30);

        await deployedOracleSwapEventManager.prepareEvent(
          { from: eventRunnerAccount }
        );

        await time.increase(duration);

        await deployedOracleSwapEventManager.startEvent(
          { from: eventRunnerAccount }
        )

        await time.increase(time.duration.minutes(28));
        await expectRevert(
          deployedOracleSwapEventManager.finalizeEvent({ from: eventRunnerAccount }), 'Too early end',
        );
      });

      it('revert on already finalazed', async () => {
        await deployedEventLifeCycle.addOracleAddress(
          deployedOracleSwapEventManager.address
        );

        await deployedOracleSwapEventManager.prepareEvent(
          { from: eventRunnerAccount }
        );

        const duration = time.duration.minutes(30);
        await time.increase(duration);

        await deployedOracleSwapEventManager.startEvent(
          { from: eventRunnerAccount }
        );
        await time.increase(duration);

        const prevTimestamp = await time.latest();

        await deployedOracleSwapEventManager.finalizeEvent(
          { from: eventRunnerAccount }
        );

        await deployedOracleSwapEventManager.finalizeEvent(
          { from: eventRunnerAccount }
        );

        await expectRevert(
          deployedOracleSwapEventManager.finalizeEvent({ from: eventRunnerAccount }), 'Event not started',
          // deployedOracleSwapEventManager.finalizeEvent({ from: eventRunnerAccount }), 'Event already finalized',
        );
      });
    });

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
        nowTime: timestamp,
        eventEndTimeExpected: timestampBefore.add(duration).add(duration),
        result: new BN("0")
      });
    });

    it('it end event normally with result (1)', async () => {
      await deployedEventLifeCycle.addOracleAddress(
        deployedOracleSwapEventManager.address
      );

      const getReserves = web3.eth.abi.encodeFunctionSignature('getReserves()')

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

      const aReserve = new BN('1');
      const bReserve = new BN('550');

      const retSwap3 = web3.eth.abi.encodeParameters(['uint112','uint112','uint32'], [aReserve, bReserve, await time.latest()]);
      await pancakePairContract.givenMethodReturn(getReserves, retSwap3);

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
        nowTime: timestamp,
        eventEndTimeExpected: timestampBefore.add(duration).add(duration),
        result: new BN("1")
      });
    });

    it('it end event normally with result (-1)', async () => {
      await deployedEventLifeCycle.addOracleAddress(
        deployedOracleSwapEventManager.address
      );

      const getReserves = web3.eth.abi.encodeFunctionSignature('getReserves()')

      await deployedOracleSwapEventManager.prepareEvent(
        { from: eventRunnerAccount }
      );

      const timestampBefore = await time.latest();

      const aReserve = new BN('1');
      const bReserve = new BN('500');
      const retSwap3 = web3.eth.abi.encodeParameters(['uint112','uint112','uint32'], [aReserve, bReserve, timestampBefore]);
      await pancakePairContract.givenMethodReturn(getReserves, retSwap3)

      const duration = time.duration.minutes(30);
      await time.increase(duration);

      await deployedOracleSwapEventManager.startEvent(
        { from: eventRunnerAccount }
      );

      await time.increase(duration);

      const roundData = await deployedOracleSwapEventManager._startRoundData.call();

      const aReserveAfretSellBTC = new BN('1');
      const bReserveAfretSellBTC = new BN('450');
      const retSwapAfterSellBTC = web3.eth.abi.encodeParameters(
        ['uint112','uint112','uint32'], [aReserveAfretSellBTC, bReserveAfretSellBTC, await time.latest()]
      );
      await pancakePairContract.givenMethodReturn(getReserves, retSwapAfterSellBTC)

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
        nowTime: timestamp,
        eventEndTimeExpected: timestampBefore.add(duration).add(duration),
        result: new BN("-1")
      });
    });

    it('it end event normally with result (-1) and result (-1)', async () => {
      await deployedEventLifeCycle.addOracleAddress(
        deployedOracleSwapEventManager.address
      );

      const getReserves = web3.eth.abi.encodeFunctionSignature('getReserves()')

      await deployedOracleSwapEventManager.prepareEvent(
        { from: eventRunnerAccount }
      );

      const timestampBefore = await time.latest();

      const aReserve = new BN('1');
      const bReserve = new BN('500');
      const retSwap3 = web3.eth.abi.encodeParameters(['uint112','uint112','uint32'], [aReserve, bReserve, timestampBefore]);
      await pancakePairContract.givenMethodReturn(getReserves, retSwap3)

      const duration = time.duration.minutes(30);
      await time.increase(duration);

      await deployedOracleSwapEventManager.startEvent(
        { from: eventRunnerAccount }
      );

      await time.increase(duration);

      const roundData = await deployedOracleSwapEventManager._startRoundData.call();

      const aReserveAfretSellBTC = new BN('1');
      const bReserveAfretSellBTC = new BN('490');
      const retSwapAfterSellBTC = web3.eth.abi.encodeParameters(
        ['uint112','uint112','uint32'], [aReserveAfretSellBTC, bReserveAfretSellBTC, await time.latest()]
      );
      await pancakePairContract.givenMethodReturn(getReserves, retSwapAfterSellBTC)

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
        nowTime: timestamp,
        eventEndTimeExpected: timestampBefore.add(duration).add(duration),
        result: new BN("-1")
      });

      const { logs: secondEventPrepareLog } = await deployedOracleSwapEventManager.prepareEvent(
        { from: eventRunnerAccount }
      );

      const timestampBeforeSecondEvent = await time.latest();

      const eventCountSecondEvent = 1;
      assert.equal(
        secondEventPrepareLog.length,
        eventCountSecondEvent,
        `triggers must be ${eventCountSecondEvent} event`
      );

      expectEvent.inLogs(secondEventPrepareLog, 'PrepareEvent', {
        createdAt: timestampBeforeSecondEvent,
        priceChangePercent: instanceConfig.priceChangePart,
        eventStartTimeExpected: instanceConfig.eventStartTimeOutExpected.add(timestamp),
        eventEndTimeExpected: instanceConfig.eventEndTimeOutExpected.add(
          instanceConfig.eventStartTimeOutExpected).add(timestamp),
        blackTeam: instanceConfig.upTeam,
        whiteTeam: instanceConfig.downTeam,
        eventType: instanceConfig.eventType,
        eventSeries: instanceConfig.eventSeries,
        eventName: instanceConfig.eventName,
        eventId: new BN("2")
      });


      await time.increase(duration);

      await deployedOracleSwapEventManager.startEvent(
        { from: eventRunnerAccount }
      );

      await time.increase(duration);

      const aReserveAfretSellBTCSecondEvent = new BN('1');
      const bReserveAfretSellBTCSecondEvent = new BN('520');
      const retSwapAfterSellBTCSecondEvent = web3.eth.abi.encodeParameters(
        ['uint112','uint112','uint32'], [aReserveAfretSellBTCSecondEvent, bReserveAfretSellBTCSecondEvent, await time.latest()]
      );
      await pancakePairContract.givenMethodReturn(getReserves, retSwapAfterSellBTCSecondEvent)

      await deployedOracleSwapEventManager.finalizeEvent(
        { from: eventRunnerAccount }
      );
      await time.increase(time.duration.seconds(5));

      const timestampSecondEvent = await time.latest();

      const { logs: logsFinalizeSecondEvent } = await deployedOracleSwapEventManager.finalizeEvent(
        { from: eventRunnerAccount }
      );

      assert.equal(logsFinalizeSecondEvent.length, eventCount, `triggers must be ${eventCount} event`);

      expectEvent.inLogs(logsFinalizeSecondEvent, 'AppEnded', {
        // nowTime: timestampSecondEvent,
        // eventEndTimeExpected: timestampBefore.add(duration).add(duration),
        result: new BN("-1")
      });
    });

    it('it end event normally with result (1) and result (1)', async () => {
      await deployedEventLifeCycle.addOracleAddress(
        deployedOracleSwapEventManager.address
      );

      const getReserves = web3.eth.abi.encodeFunctionSignature('getReserves()')

      await deployedOracleSwapEventManager.prepareEvent(
        { from: eventRunnerAccount }
      );

      const timestampBefore = await time.latest();

      const aReserve = new BN('1');
      const bReserve = new BN('500');
      const retSwap3 = web3.eth.abi.encodeParameters(['uint112','uint112','uint32'], [aReserve, bReserve, await time.latest()]);
      await pancakePairContract.givenMethodReturn(getReserves, retSwap3)

      const duration = time.duration.minutes(30);
      await time.increase(duration);

      await deployedOracleSwapEventManager.startEvent(
        { from: eventRunnerAccount }
      );

      await time.increase(duration);

      const roundData = await deployedOracleSwapEventManager._startRoundData.call();

      const aReserveAfretSellBTC = new BN('1');
      const bReserveAfretSellBTC = new BN('490');
      const retSwapAfterSellBTC = web3.eth.abi.encodeParameters(
        ['uint112','uint112','uint32'], [aReserveAfretSellBTC, bReserveAfretSellBTC, await time.latest()]
      );
      await pancakePairContract.givenMethodReturn(getReserves, retSwapAfterSellBTC)

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
        nowTime: timestamp,
        eventEndTimeExpected: timestampBefore.add(duration).add(duration),
        result: new BN("-1")
      });

      const { logs: secondEventPrepareLog } = await deployedOracleSwapEventManager.prepareEvent(
        { from: eventRunnerAccount }
      );

      const timestampBeforeSecondEvent = await time.latest();

      const eventCountSecondEvent = 1;

      assert.equal(
        secondEventPrepareLog.length,
        eventCountSecondEvent,
        `triggers must be ${eventCountSecondEvent} event`
      );

      expectEvent.inLogs(secondEventPrepareLog, 'PrepareEvent', {
        createdAt: timestampBeforeSecondEvent,
        priceChangePercent: instanceConfig.priceChangePart,
        eventStartTimeExpected: instanceConfig.eventStartTimeOutExpected.add(timestamp),
        eventEndTimeExpected: instanceConfig.eventEndTimeOutExpected.add(
            instanceConfig.eventStartTimeOutExpected).add(timestamp),
        blackTeam: instanceConfig.upTeam,
        whiteTeam: instanceConfig.downTeam,
        eventType: instanceConfig.eventType,
        eventSeries: instanceConfig.eventSeries,
        eventName: instanceConfig.eventName,
        eventId: new BN("2")
      });

      await time.increase(duration);

      await deployedOracleSwapEventManager.startEvent(
        { from: eventRunnerAccount }
      );

      await time.increase(duration);


      const aReserveAfretSellBTCSecondEvent = new BN('1');
      const bReserveAfretSellBTCSecondEvent = new BN('450');
      const retSwapAfterSellBTCSecondEvent = web3.eth.abi.encodeParameters(
        ['uint112','uint112','uint32'], [aReserveAfretSellBTCSecondEvent, bReserveAfretSellBTCSecondEvent, await time.latest()]
      );
      await pancakePairContract.givenMethodReturn(getReserves, retSwapAfterSellBTCSecondEvent)

      await deployedOracleSwapEventManager.finalizeEvent(
        { from: eventRunnerAccount }
      );
      await time.increase(time.duration.seconds(5));

      const timestampSecondEvent = await time.latest();

      const { logs: logsFinalizeSecondEvent } = await deployedOracleSwapEventManager.finalizeEvent(
        { from: eventRunnerAccount }
      );

      assert.equal(logsFinalizeSecondEvent.length, eventCount, `triggers must be ${eventCount} event`);

      expectEvent.inLogs(logsFinalizeSecondEvent, 'AppEnded', {
        // nowTime: timestampSecondEvent,
        // eventEndTimeExpected: timestampBefore.add(duration).add(duration),
        result: new BN("1")
      });
    });

    it('it end event normally with result (0) on try flash loan attack', async () => {
      await deployedEventLifeCycle.addOracleAddress(
        deployedOracleSwapEventManager.address
      );

      const getReserves = web3.eth.abi.encodeFunctionSignature('getReserves()')

      await deployedOracleSwapEventManager.prepareEvent(
        { from: eventRunnerAccount }
      );

      const timestampBefore = await time.latest();

      const aReserve = new BN('1');
      const bReserve = new BN('500');
      const retSwap3 = web3.eth.abi.encodeParameters(['uint112','uint112','uint32'], [aReserve, bReserve, timestampBefore]);
      await pancakePairContract.givenMethodReturn(getReserves, retSwap3)

      const duration = time.duration.minutes(30);
      await time.increase(duration);

      await deployedOracleSwapEventManager.startEvent(
        { from: eventRunnerAccount }
      );

      await time.increase(duration);

      const roundData = await deployedOracleSwapEventManager._startRoundData.call();

      const aReserveAfretSellBTC = new BN('1');
      const bReserveAfretSellBTC = new BN('500');
      const retSwapAfterSellBTC = web3.eth.abi.encodeParameters(
        ['uint112','uint112','uint32'], [aReserveAfretSellBTC, bReserveAfretSellBTC, await time.latest()]
      );
      await pancakePairContract.givenMethodReturn(getReserves, retSwapAfterSellBTC)

      await deployedOracleSwapEventManager.finalizeEvent(
        { from: eventRunnerAccount }
      );
      await time.increase(time.duration.seconds(5));

      const aReserveAfretSellBTC2 = new BN('1');
      const bReserveAfretSellBTC2 = new BN('500');
      const retSwapAfterSellBTC2 = web3.eth.abi.encodeParameters(
        ['uint112','uint112','uint32'], [aReserveAfretSellBTC2, bReserveAfretSellBTC2, await time.latest()]
      );
      await pancakePairContract.givenMethodReturn(getReserves, retSwapAfterSellBTC2)

      const timestamp = await time.latest();

      const { logs } = await deployedOracleSwapEventManager.finalizeEvent(
        { from: eventRunnerAccount }
      );

      const eventCount = 2;
      assert.equal(logs.length, eventCount, `triggers must be ${eventCount} event`);

      expectEvent.inLogs(logs, 'AppEnded', {
        nowTime: timestamp,
        eventEndTimeExpected: timestampBefore.add(duration).add(duration),
        result: new BN("0")
      });
    });
  });

  it("should assert OracleSwapEventManager._eventLifeCycle() equal EventLifeCycle address", async () => {
    return assert.equal(await deployedOracleSwapEventManager._eventLifeCycle(), deployedEventLifeCycle.address);
  });

  it("should assert OracleSwapEventManager._predictionPool() equal PredictionPool address", async () => {
    return assert.equal(await deployedOracleSwapEventManager._predictionPool(), deployedPredictionPool.address);
  });

  it("should assert OracleSwapEventManager._predictionPool() equal PredictionPool address", async () => {
    assert.equal(await deployedOracleSwapEventManager._primaryToken(), _primaryToken);
    return assert.equal(await deployedOracleSwapEventManager._pair(), pancakePairContract.address);
  });

});

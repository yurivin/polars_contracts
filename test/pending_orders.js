const {
  BN,           // Big Number support
  time,
  constants,    // Common constants, like the zero address and largest integers
  expectEvent,  // Assertions for emitted events
  expectRevert, // Assertions for transactions that should fail
  snapshot
} = require('@openzeppelin/test-helpers');

const chai = require('chai');
const expect = require('chai').expect;

const PendingOrders = artifacts.require("PendingOrders");
const EventLifeCycle = artifacts.require("EventLifeCycle");
const PredictionPool = artifacts.require("PredictionPool");
const PredictionCollateralization = artifacts.require("PredictionCollateralization");
const TokenTemplate = artifacts.require("TokenTemplate");

const priceChangePart = new BN("50000000000000000");

contract("PendingOrders", function (accounts) {
  let deployedPredictionPool;
  let deployedEventLifeCycle;
  let deployedPendingOrders;
  let deployedCollateralToken;
  let deployedWhiteToken;
  let deployedBlackToken;
  let deployedPredictionCollateralization;

  let snapshotA;

  const deployerAddress = accounts[0];

  before(async () => {
    deployedPredictionPool = await PredictionPool.deployed();
    deployedPredictionCollateralization = await PredictionCollateralization.deployed();
    deployedEventLifeCycle = await EventLifeCycle.deployed();
    // deployedEventLifeCycle = await EventLifeCycle.deployed();
    deployedPendingOrders = await PendingOrders.deployed();
    deployedCollateralToken = await TokenTemplate.deployed();
    // deployedWhiteToken = await TokenTemplate.deployed();
    console.log("CollateralToken:        ", deployedCollateralToken.address);
    // console.log("WhiteToken:     ", deployedWhiteToken.address);
    // console.log("WhiteToken:     ", await deployedPredictionCollateralization._whiteToken());
    deployedWhiteToken = await TokenTemplate.at(await deployedPredictionCollateralization._whiteToken());
    deployedBlackToken = await TokenTemplate.at(await deployedPredictionCollateralization._blackToken());
    console.log("WhiteToken:             ", deployedWhiteToken.address);
    console.log("BlackToken:             ", deployedBlackToken.address);
    snapshotA = await snapshot();
  });

  afterEach(async () => {
      await snapshotA.restore()
  });

  it("should assert PendingOrders._eventContractAddress() equal EventLifeCycle address", async () => {
    return assert.equal(await deployedPendingOrders._eventContractAddress(), deployedEventLifeCycle.address);
  });

  it("should assert PendingOrders._PredictionPool() equal PredictionPool address", async () => {
    return assert.equal(await deployedPendingOrders._predictionPool(), deployedPredictionPool.address);
  });

  it("should assert PendingOrders._collateralToken() equal CollateralToken address", async () => {
    return assert.equal(await deployedPendingOrders._collateralToken(), deployedCollateralToken.address);
  });

  it("should assert PendingOrders._feeWithdrawAddress() equal deployer address", async () => {
    return assert.equal(await deployedPendingOrders._feeWithdrawAddress(), deployerAddress);
  });

  it("should assert PendingOrders address equal EventLifeCycle._pendingOrders()", async () => {
    return assert.equal(deployedPendingOrders.address, await deployedEventLifeCycle._pendingOrders());
  });

  it("should assert EventLifeCycle._usePendingOrders() true", async () => {
    return assert.equal(await deployedEventLifeCycle._usePendingOrders(), true);
  });

  // it('revert on BettingPool now closed', async () => {
  //   const _eventStarted = web3.eth.abi.encodeFunctionSignature('_eventStarted()')
  //   await bettingPoolContract.givenMethodReturnBool(_eventStarted, true)

  //   await expectRevert(
  //     instance.prepareEvent(
  //       { from: eventRunnerAccount }
  //     ), "BP closed"
  //   );
  // });

  it.skip("should REVERT on 'Cannot buyback more than sold from the pool'", async () => {
    const amount = new BN("10");
    const expectedWhiteBuy = new BN("20"); // If whitePrice == 0.5
    const isWhite = true;
    const eventId = new BN("101");

    const eventStartExpected = await time.latest();
    const eventEndExpected = eventStartExpected.add(time.duration.seconds(5));
    const eventResult = new BN("1");

    const createOrder = await deployedPendingOrders.createOrder(
      amount,
      isWhite,
      eventId
    );

    const { logs: createOrderLog } = createOrder;
    const eventCount = 1;
    assert.equal(createOrderLog.length, eventCount, `triggers must be ${eventCount} event`);

    expectEvent.inLogs(createOrderLog, 'OrderCreated', {
      id: new BN("1")
    });

    const ordersCount = await deployedPendingOrders._ordersCount();
    expect(ordersCount).to.be.bignumber.equal(new BN("1"));

    const whitePrice = await deployedPredictionPool._whitePrice();
    console.log("whitePrice:         ", whitePrice.toString());
    // TODO: Check price, assertEquals(new BigInteger("525078986960882648"),bettingPool._whitePrice().send());
    expect(whitePrice).to.be.bignumber.equal(new BN("500000000000000000"));

    const whiteBoughtBefore = await deployedPredictionPool._whiteBought();
    console.log("whiteBoughtBefore:  ", whiteBoughtBefore.toString());

    const eventTx = await deployedEventLifeCycle.addAndStartEvent(
      priceChangePart,
      eventStartExpected,
      eventEndExpected,
      "Test Black team",
      "Test White team",
      "Test event type",
      "Test event series",
      "test event name ",
      eventId
    );

    const ongoingEvent = await deployedEventLifeCycle._ongoingEvent();
    expect(ongoingEvent.eventId).to.be.bignumber.equal(eventId);

    const whiteBoughtDuringEvent = await deployedPredictionPool._whiteBought();
    console.log("whiteBoughtDuringEvent:", whiteBoughtDuringEvent.toString());
    console.log("expectedWhiteBuy:", expectedWhiteBuy.toString());
    expect(whiteBoughtBefore.add(expectedWhiteBuy)).to.be.bignumber.equal(whiteBoughtDuringEvent);

    return await expectRevert(
      deployedEventLifeCycle.endEvent(
        eventResult
      ), "Cannot buyback more than sold from the pool"
    );
  });

  const buyToken = async (color, initialBlackOrWhitePrice, buyPayment) => {
    let buyColor;
    const eventCount = 1;
    if (color === "white") {
      buyColor = await deployedPredictionPool.buyWhite(
        initialBlackOrWhitePrice,
        buyPayment,
        { from: deployerAddress }
      );

    } else if (color === "black") {
      buyColor = await deployedPredictionPool.buyBlack(
        initialBlackOrWhitePrice,
        buyPayment,
        { from: deployerAddress }
      );
    } else {
      throw new Error(`${color} not defined`)
    }
    const { logs: buyColorLog } = buyColor;

    assert.equal(buyColorLog.length, eventCount, `triggers must be ${eventCount} event`);
    return buyColorLog;
  }

  const addLiquidityToPrediction = async () => {
    const collateralAmountToBuy = new BN("100000000000000000000000");
    const buyPayment = new BN("5000000000000000000");

    const initialBlackOrWhitePrice = new BN("500000000000000000");

    const collateralTokenDeployerBalance = await deployedCollateralToken.balanceOf(deployerAddress);

    expect(collateralTokenDeployerBalance).to.be.bignumber.at.least(collateralAmountToBuy);

    const eventCount = 1;
    const buyWhiteLog = await buyToken("white", initialBlackOrWhitePrice, buyPayment);

    const whiteBought = new BN("9970000000000000000");

    expectEvent.inLogs(buyWhiteLog, 'BuyWhite', {
      user: deployerAddress,
      amount: whiteBought,
      price: initialBlackOrWhitePrice
    });

    expect(
      await deployedWhiteToken.balanceOf(deployerAddress)
    ).to.be.bignumber.equal(whiteBought);

    const buyBlackLog = await buyToken("black", initialBlackOrWhitePrice, buyPayment);

    const blackBought = new BN("9970000000000000000");

    expectEvent.inLogs(buyBlackLog, 'BuyBlack', {
      user: deployerAddress,
      amount: blackBought,
      price: initialBlackOrWhitePrice
    });

    expect(
      await deployedBlackToken.balanceOf(deployerAddress)
    ).to.be.bignumber.equal(blackBought);
  }

  const cretePendingOrder = async (isWhite, amount, eventId) => {
    const createOrder = await deployedPendingOrders.createOrder(
      amount,
      isWhite,
      // isWhite = color === "white" ? 1 : color === "black" ? 0 : -1,
      eventId,
      { from: deployerAddress }
    );

    const { logs: createOrderLog } = createOrder;
    const eventCount = 1;
    assert.equal(createOrderLog.length, eventCount, `triggers must be ${eventCount} event`);

    return createOrderLog;

    // expectEvent.inLogs(createOrderLog, 'OrderCreated', {
    //   id: new BN("1")
    // });
  }

  it.skip("should assert PredictionPool whiteBoughtBefore equal whiteBoughtAfter after work pending order", async () => {

    await addLiquidityToPrediction();

    const amount = new BN("10");
    const expectedWhiteBuy = new BN("20"); // If whitePrice == 0.5
    const isWhite = true;
    const eventId = new BN("101");

    const eventStartExpected = await time.latest();
    const eventEndExpected = eventStartExpected.add(time.duration.seconds(5));
    // const eventResult = new BN("0");
    const eventResult = new BN("1");
    // const eventResult = new BN("-1");
    const eventCount = 1;

    const createOrderLog = await cretePendingOrder(isWhite, amount, eventId);
    expectEvent.inLogs(createOrderLog, 'OrderCreated', {
      id: new BN("1")
    });

    const ordersCount = await deployedPendingOrders._ordersCount();
    expect(ordersCount).to.be.bignumber.equal(new BN("1"));

    const whitePrice = await deployedPredictionPool._whitePrice();
    console.log("whitePrice:             ", whitePrice.toString());
    // TODO: Check price, assertEquals(new BigInteger("525078986960882648"),bettingPool._whitePrice().send());
    expect(whitePrice).to.be.bignumber.equal(new BN("500000000000000000"));

    const whiteBoughtBefore = await deployedPredictionPool._whiteBought();
    console.log("whiteBoughtBefore:      ", whiteBoughtBefore.toString());

    const eventTx = await deployedEventLifeCycle.addAndStartEvent(
      priceChangePart,
      eventStartExpected,
      eventEndExpected,
      "Test Black team",
      "Test White team",
      "Test event type",
      "Test event series",
      "test event name ",
      eventId
    );

    console.log("White balanceOf PendOr: ", (await deployedWhiteToken.balanceOf(deployedPendingOrders.address)).toString());

    const ongoingEvent = await deployedEventLifeCycle._ongoingEvent();
    expect(ongoingEvent.eventId).to.be.bignumber.equal(eventId);

    const whiteBoughtDuringEvent = await deployedPredictionPool._whiteBought();
    console.log("whiteBoughtDuringEvent: ", whiteBoughtDuringEvent.toString());

    console.log("MIN_HOLD:               ", (await deployedPredictionPool.MIN_HOLD()).toString());

    console.log("WT balanceOf PredPool:  ", (await deployedWhiteToken.balanceOf(deployedPredictionPool.address)).toString());
    console.log("WT balanceOf WhiteTok:  ", (await deployedWhiteToken.balanceOf(deployedWhiteToken.address)).toString());
    console.log("WT balanceOf PredColl:  ", (await deployedWhiteToken.balanceOf(deployedPredictionCollateralization.address)).toString());
    console.log("WT balanceOf deployer:  ", (await deployedWhiteToken.balanceOf(deployerAddress)).toString());

    console.log("BT balanceOf PredPool:  ", (await deployedBlackToken.balanceOf(deployedPredictionPool.address)).toString());
    console.log("BT balanceOf WhiteTok:  ", (await deployedBlackToken.balanceOf(deployedBlackToken.address)).toString());
    console.log("BT balanceOf PredColl:  ", (await deployedBlackToken.balanceOf(deployedPredictionCollateralization.address)).toString());
    console.log("BT balanceOf deployer:  ", (await deployedBlackToken.balanceOf(deployerAddress)).toString());

    console.log("expectedWhiteBuy:       ", expectedWhiteBuy.toString());
    expect(whiteBoughtBefore.add(expectedWhiteBuy)).to.be.bignumber.equal(whiteBoughtDuringEvent);

    const endEvent = await deployedEventLifeCycle.endEvent(
      eventResult
    );
    console.log("whitePrice:             ", (await deployedPredictionPool._whitePrice()).toString());
    const { logs: endEventLog } = endEvent;
    assert.equal(endEventLog.length, eventCount, `triggers must be ${eventCount} event`);

    const whiteBoughtAfter = await deployedPredictionPool._whiteBought();
    console.log("whiteBoughtAfter:       ", whiteBoughtAfter.toString());
    return expect(whiteBoughtBefore).to.be.bignumber.equal(whiteBoughtAfter);
  });

  it.only("should assert PredictionPool whiteBoughtBefore equal whiteBoughtAfter after work pending order", async () => {

    await addLiquidityToPrediction();

    const amountBN = new BN("1000000");
    // const amount = 10;  // withdrew amount: 10
    // const amount = 100; // withdrew amount: 104
    const amount = 200; // withdrew amount: 398
    // const amount = 1000000;
    const price = 0.5;
    const fee = 0.003;
    // const expectedWhiteBuyBN = new BN("2000000"); // If whitePrice == 0.5
    // let expectedWhiteBuy = 2000000;               // If whitePrice == 0.5
    const expectedWhiteBuy = new BN(amount / price).sub(new BN((amount / price) * fee));
    const isWhite = true;
    const eventId = new BN("101");

    const eventStartExpected = await time.latest();
    const eventEndExpected = eventStartExpected.add(time.duration.seconds(5));
    // const eventResult = new BN("0");
    const eventResult = new BN("1");
    // const eventResult = new BN("-1");
    const eventCount = 1;

    const createOrderLog = await cretePendingOrder(isWhite, new BN(amount), eventId);
    expectEvent.inLogs(createOrderLog, 'OrderCreated', {
      id: new BN("1"),
      amount: new BN(amount)
    });

    const ordersCount = await deployedPendingOrders._ordersCount();
    expect(ordersCount).to.be.bignumber.equal(new BN("1"));

    const whitePrice = await deployedPredictionPool._whitePrice();
    console.log("whitePrice:             ", whitePrice.toString());
    // TODO: Check price, assertEquals(new BigInteger("525078986960882648"),bettingPool._whitePrice().send());
    expect(whitePrice).to.be.bignumber.equal(new BN("500000000000000000"));

    const whiteBoughtBefore = await deployedPredictionPool._whiteBought();
    console.log("whiteBoughtBefore:      ", whiteBoughtBefore.toString());

    const eventTx = await deployedEventLifeCycle.addAndStartEvent(
      priceChangePart,
      eventStartExpected,
      eventEndExpected,
      "Test Black team",
      "Test White team",
      "Test event type",
      "Test event series",
      "test event name ",
      eventId
    );

    console.log("White balanceOf PendOr: ", (await deployedWhiteToken.balanceOf(deployedPendingOrders.address)).toString());

    const ongoingEvent = await deployedEventLifeCycle._ongoingEvent();
    expect(ongoingEvent.eventId).to.be.bignumber.equal(eventId);

    const whiteBoughtDuringEvent = await deployedPredictionPool._whiteBought();
    console.log("whiteBoughtDuringEvent: ", whiteBoughtDuringEvent.toString());

    console.log("MIN_HOLD:               ", (await deployedPredictionPool.MIN_HOLD()).toString());

    console.log("WT balanceOf PredPool:  ", (await deployedWhiteToken.balanceOf(deployedPredictionPool.address)).toString());
    console.log("WT balanceOf WhiteTok:  ", (await deployedWhiteToken.balanceOf(deployedWhiteToken.address)).toString());
    console.log("WT balanceOf PredColl:  ", (await deployedWhiteToken.balanceOf(deployedPredictionCollateralization.address)).toString());
    console.log("WT balanceOf deployer:  ", (await deployedWhiteToken.balanceOf(deployerAddress)).toString());

    console.log("BT balanceOf PredPool:  ", (await deployedBlackToken.balanceOf(deployedPredictionPool.address)).toString());
    console.log("BT balanceOf WhiteTok:  ", (await deployedBlackToken.balanceOf(deployedBlackToken.address)).toString());
    console.log("BT balanceOf PredColl:  ", (await deployedBlackToken.balanceOf(deployedPredictionCollateralization.address)).toString());
    console.log("BT balanceOf deployer:  ", (await deployedBlackToken.balanceOf(deployerAddress)).toString());

    console.log("expectedWhiteBuy:       ", expectedWhiteBuy.toString());

    // expect(whiteBoughtBefore.add(expectedWhiteBuy)).to.be.bignumber.equal(whiteBoughtDuringEvent);

    const endEvent = await deployedEventLifeCycle.endEvent(
      eventResult
    );
    console.log("whitePrice:             ", (await deployedPredictionPool._whitePrice()).toString());
    const { logs: endEventLog } = endEvent;
    assert.equal(endEventLog.length, eventCount, `triggers must be ${eventCount} event`);

    const whiteBoughtAfter = await deployedPredictionPool._whiteBought();
    console.log("whiteBoughtAfter:       ", whiteBoughtAfter.toString());
    // return expect(whiteBoughtBefore).to.be.bignumber.equal(whiteBoughtAfter);


    const withdrawCollateral = await deployedPendingOrders.withdrawCollateral();
    const { logs: withdrawCollateralLog } = withdrawCollateral;
    expectEvent.inLogs(withdrawCollateralLog, 'CollateralWithdrew', {
      amount: new BN((amount / price)*0.525078986960882647*0.997)

    });
  });

  it.skip("should assert PredictionPool whiteBoughtBefore equal whiteBoughtAfter after work pending order", async () => {

    await addLiquidityToPrediction();

    const amount = new BN("10");
    const expectedWhiteBuy = new BN("20"); // If whitePrice == 0.5
    const isWhite = true;
    const eventId = new BN("101");

    const eventStartExpected = await time.latest();
    const eventEndExpected = eventStartExpected.add(time.duration.seconds(5));
    // const eventResult = new BN("0");
    const eventResult = new BN("1");
    // const eventResult = new BN("-1");
    const eventCount = 1;

    const createOrderLog = await cretePendingOrder(isWhite, amount, eventId);
    expectEvent.inLogs(createOrderLog, 'OrderCreated', {
      id: new BN("1")
    });

    // const createOrderLog = await cretePendingOrder(isWhite, amount, eventId);
    expectEvent.inLogs((await cretePendingOrder(0, 60, eventId)), 'OrderCreated', {
      id: new BN("2")
    });

    const ordersCount = await deployedPendingOrders._ordersCount();
    expect(ordersCount).to.be.bignumber.equal(new BN("2"));

    const whitePrice = await deployedPredictionPool._whitePrice();
    console.log("whitePrice:             ", whitePrice.toString());
    // TODO: Check price, assertEquals(new BigInteger("525078986960882648"),bettingPool._whitePrice().send());
    expect(whitePrice).to.be.bignumber.equal(new BN("500000000000000000"));

    const whiteBoughtBefore = await deployedPredictionPool._whiteBought();
    console.log("whiteBoughtBefore:      ", whiteBoughtBefore.toString());

    const eventTx = await deployedEventLifeCycle.addAndStartEvent(
      priceChangePart,
      eventStartExpected,
      eventEndExpected,
      "Test Black team",
      "Test White team",
      "Test event type",
      "Test event series",
      "test event name ",
      eventId
    );

    console.log("White balanceOf PendOr: ", (await deployedWhiteToken.balanceOf(deployedPendingOrders.address)).toString());

    const ongoingEvent = await deployedEventLifeCycle._ongoingEvent();
    expect(ongoingEvent.eventId).to.be.bignumber.equal(eventId);

    const whiteBoughtDuringEvent = await deployedPredictionPool._whiteBought();
    console.log("whiteBoughtDuringEvent: ", whiteBoughtDuringEvent.toString());

    console.log("MIN_HOLD:               ", (await deployedPredictionPool.MIN_HOLD()).toString());

    console.log("WT balanceOf PredPool:  ", (await deployedWhiteToken.balanceOf(deployedPredictionPool.address)).toString());
    console.log("WT balanceOf WhiteTok:  ", (await deployedWhiteToken.balanceOf(deployedWhiteToken.address)).toString());
    console.log("WT balanceOf PredColl:  ", (await deployedWhiteToken.balanceOf(deployedPredictionCollateralization.address)).toString());
    console.log("WT balanceOf deployer:  ", (await deployedWhiteToken.balanceOf(deployerAddress)).toString());

    console.log("BT balanceOf PredPool:  ", (await deployedBlackToken.balanceOf(deployedPredictionPool.address)).toString());
    console.log("BT balanceOf WhiteTok:  ", (await deployedBlackToken.balanceOf(deployedBlackToken.address)).toString());
    console.log("BT balanceOf PredColl:  ", (await deployedBlackToken.balanceOf(deployedPredictionCollateralization.address)).toString());
    console.log("BT balanceOf deployer:  ", (await deployedBlackToken.balanceOf(deployerAddress)).toString());

    console.log("expectedWhiteBuy:       ", expectedWhiteBuy.toString());
    expect(whiteBoughtBefore.add(expectedWhiteBuy)).to.be.bignumber.equal(whiteBoughtDuringEvent);

    const endEvent = await deployedEventLifeCycle.endEvent(
      eventResult
    );
    console.log("whitePrice:             ", (await deployedPredictionPool._whitePrice()).toString());
    const { logs: endEventLog } = endEvent;
    assert.equal(endEventLog.length, eventCount, `triggers must be ${eventCount} event`);

    const whiteBoughtAfter = await deployedPredictionPool._whiteBought();
    console.log("whiteBoughtAfter:       ", whiteBoughtAfter.toString());
    return expect(whiteBoughtBefore).to.be.bignumber.equal(whiteBoughtAfter);
  });

});

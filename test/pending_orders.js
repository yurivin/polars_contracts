const {
  BN,           // Big Number support
  time,
  constants,    // Common constants, like the zero address and largest integers
  expectEvent,  // Assertions for emitted events
  expectRevert, // Assertions for transactions that should fail
  snapshot
} = require('@openzeppelin/test-helpers');

const bigDecimal = require('js-big-decimal');

const chai = require('chai');
const expect = require('chai').expect;

const BONE = 10**18;

const PendingOrders = artifacts.require("PendingOrders");
const EventLifeCycle = artifacts.require("EventLifeCycle");
const PredictionPool = artifacts.require("PredictionPool");
const PredictionCollateralization = artifacts.require("PredictionCollateralization");
const TokenTemplate = artifacts.require("TokenTemplate");

const ntob = (number) => {
  const amountBD = new bigDecimal(number.toString(10))
    .multiply(new bigDecimal(BONE.toString(10)))
    .getValue();
  return new BN(amountBD);
}

const priceChangePart = ntob(0.05);

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
    deployedPendingOrders = await PendingOrders.deployed();
    deployedCollateralToken = await TokenTemplate.deployed();
    deployedWhiteToken = await TokenTemplate.at(await deployedPredictionCollateralization._whiteToken());
    deployedBlackToken = await TokenTemplate.at(await deployedPredictionCollateralization._blackToken());
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

  it("should REVERT on 'Cannot buyback more than sold from the pool'", async () => {
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
    const collateralAmountToBuy = ntob(100000);
    const buyPayment = ntob(5);

    const initialBlackOrWhitePrice = ntob(0.5);

    const collateralTokenDeployerBalance = await deployedCollateralToken.balanceOf(deployerAddress);

    expect(collateralTokenDeployerBalance).to.be.bignumber.at.least(collateralAmountToBuy);

    const eventCount = 1;
    const buyWhiteLog = await buyToken("white", initialBlackOrWhitePrice, buyPayment);

    const whiteBought = ntob(9.970);

    expectEvent.inLogs(buyWhiteLog, 'BuyWhite', {
      user: deployerAddress,
      amount: whiteBought,
      price: initialBlackOrWhitePrice
    });

    expect(
      await deployedWhiteToken.balanceOf(deployerAddress)
    ).to.be.bignumber.equal(whiteBought);

    const buyBlackLog = await buyToken("black", initialBlackOrWhitePrice, buyPayment);

    const blackBought = ntob(9.970);

    expectEvent.inLogs(buyBlackLog, 'BuyBlack', {
      user: deployerAddress,
      amount: blackBought,
      price: initialBlackOrWhitePrice
    });

    expect(
      await deployedBlackToken.balanceOf(deployerAddress)
    ).to.be.bignumber.equal(blackBought);
  }

  const createPendingOrder = async (isWhite, amount, eventId, runner = 0) => {
    const amountBN = ntob(amount);
    const ordersCountExpected = (await deployedPendingOrders._ordersCount()).add(new BN("1"));

    const createOrder = await deployedPendingOrders.createOrder(
      amountBN,
      isWhite,
      eventId,
      { from: runner }
    );

    const { logs: createOrderLog } = createOrder;
    const eventCount = 1;
    assert.equal(createOrderLog.length, eventCount, `triggers must be ${eventCount} event`);

    const ordersCountAfter = await deployedPendingOrders._ordersCount();

    expect(ordersCountExpected).to.be.bignumber.equal(ordersCountAfter);

    expectEvent.inLogs(createOrderLog, 'OrderCreated', {
      id: ordersCountExpected,
      amount: amountBN
    });

    return createOrderLog;
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

    const createOrderLog = await createPendingOrder(isWhite, amount, eventId);
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

  const getExactBuyAmountOut = async (amountIn, buyWhite) => {

    const price0 = buyWhite ? (
      await deployedPredictionPool._whitePrice()
    ) : (
      await deployedPredictionPool._blackPrice()
    );
    const price = new bigDecimal(price0.toString(10))
      .divide(new bigDecimal(BONE.toString(10)), 18);

    const fee = new bigDecimal((await deployedPredictionPool.FEE()).toString())
      .divide(new bigDecimal(BONE.toString(10)), 18);

    const amountBDb = new bigDecimal(ntob(amountIn));
    const f = amountBDb.multiply(fee);
    const a = amountBDb.subtract(f);
    const n1 = a.divide(price, 18);
    return n1.round().getValue();
  }

  const getExactSellAmountOut = async (amountIn, sellWhite) => {

    const price0 = sellWhite ? (
      await deployedPredictionPool._whitePrice()
    ) : (
      await deployedPredictionPool._blackPrice()
    );
    const price = new bigDecimal(price0.toString(10))
      .divide(new bigDecimal(BONE.toString(10)), 18);

    const fee = new bigDecimal((await deployedPredictionPool.FEE()).toString())
      .divide(new bigDecimal(BONE.toString(10)), 18);

    const x = new bigDecimal(amountIn).multiply(price).round()
    const aFeeBD = x.multiply(fee).round();
    const collateralToSend = x.subtract(aFeeBD).round();
    return collateralToSend.getValue();
  }

  const addAndStartEvent = async (eventId, duration) => {

    const eventStartExpected = await time.latest();
    const eventEndExpected = eventStartExpected.add(duration);

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
    return eventTx;
  }

  const executeEventIteration = async (eventId, eventResult, orders) => {
    const whiteBoughtBefore = await deployedPredictionPool._whiteBought();
    const blackBoughtBefore = await deployedPredictionPool._blackBought();

    const eventDuration = time.duration.seconds(5);

    await addAndStartEvent(eventId, eventDuration);

    const ongoingEvent = await deployedEventLifeCycle._ongoingEvent();
    expect(ongoingEvent.eventId).to.be.bignumber.equal(eventId);

    const whiteBoughtDuringEvent = await deployedPredictionPool._whiteBought();
    const blackBoughtDuringEvent = await deployedPredictionPool._blackBought();

    const sumWhite = orders
      .filter(el => el.isWhite === true)
      .reduce((accumulator, a) => accumulator + a.amount, 0);

    const sumBlack = orders
      .filter(el => el.isWhite === false)
      .reduce((accumulator, a) => accumulator + a.amount, 0);

    const buyWhiteAmountOut = await getExactBuyAmountOut(sumWhite, true); // isWhite == true
    const expectedWhiteBuy = new BN(buyWhiteAmountOut);

    const buyBlackAmountOut = await getExactBuyAmountOut(sumBlack, false); // isWhite == false
    const expectedBlackBuy = new BN(buyBlackAmountOut);

    expect(whiteBoughtBefore.add(expectedWhiteBuy)).to.be.bignumber.equal(whiteBoughtDuringEvent);
    expect(blackBoughtBefore.add(expectedBlackBuy)).to.be.bignumber.equal(blackBoughtDuringEvent);

    await time.increase(eventDuration);
    const endEvent = await deployedEventLifeCycle.endEvent(
      eventResult
    );

    const { logs: endEventLog } = endEvent;
    const eventLogCount = 1;
    assert.equal(endEventLog.length, eventLogCount, `triggers must be ${eventLogCount} event`);

    const whiteBoughtAfter = await deployedPredictionPool._whiteBought();
    expect(whiteBoughtBefore).to.be.bignumber.equal(whiteBoughtAfter);
  }

  const eventsArray = [
    { eventId: new BN("101"), eventResult: new BN("1")  },
    { eventId: new BN("102"), eventResult: new BN("1")  },
    { eventId: new BN("103"), eventResult: new BN("0")  },
    { eventId: new BN("104"), eventResult: new BN("1")  },
    { eventId: new BN("105"), eventResult: new BN("-1") },
    { eventId: new BN("106"), eventResult: new BN("-1") },
    { eventId: new BN("107"), eventResult: new BN("0")  }
  ];

  const bids = [
    {
      account: 1,
      isWhite: true,
      eventId: new BN("101"),
      amount: 100
    }, {
      account: 1,
      isWhite: true,
      eventId: new BN("106"),
      amount: 273
    }, {
      account: 2,
      isWhite: true,
      eventId: new BN("101"),
      amount: 332
    }, {
      account: 1,
      isWhite: false,
      eventId: new BN("104"),
      amount: 1253
    }, {
      account: 2,
      isWhite: false,
      eventId: new BN("105"),
      amount: 14
    }, {
      account: 1,
      isWhite: true,
      eventId: new BN("104"),
      amount: 1253
    }
  ]

  const sendCollateralTokenToUser = async (user, amount) => {
    const collateralAmount = new BN(
      new bigDecimal((amount * BONE).toString(10)).getValue()
    );

    const collateralTokenUserBalanceBefore = await deployedCollateralToken.balanceOf(user);

    await deployedCollateralToken.transfer(user, collateralAmount, { from: deployerAddress })

    const collateralTokenUserBalanceAfter = await deployedCollateralToken.balanceOf(user);
    expect(collateralTokenUserBalanceBefore.add(collateralAmount))
      .to.be.bignumber.equal(collateralTokenUserBalanceAfter);

    await deployedCollateralToken.approve(deployedPendingOrders.address, collateralAmount, { from: user })

    expect((await deployedCollateralToken.allowance(user, deployedPendingOrders.address)))
      .to.be.bignumber.equal(collateralAmount);
  }

  it("should assert PredictionPool whiteBoughtBefore equal whiteBoughtAfter after work pending order", async () => {

    await addLiquidityToPrediction();
    await sendCollateralTokenToUser(accounts[1], 100000);
    await sendCollateralTokenToUser(accounts[2], 100000);
    await sendCollateralTokenToUser(accounts[3], 100000);
    await sendCollateralTokenToUser(accounts[4], 100000);

    const whitePricePpedictionBeforeTest = await deployedPredictionPool._whitePrice()
    const blackPricePpedictionBeforeTest = await deployedPredictionPool._blackPrice()

    let ordersApplied = [bids[0], bids[1], bids[2], bids[3], bids[4], bids[5]];
    // let ordersApplied = [bids[0], bids[2], bids[4]];

    for (let bid of ordersApplied) {
      const createOrderLog = await createPendingOrder(bid.isWhite, bid.amount, bid.eventId, accounts[bid.account]); // runner = 0
    }

    const ordersCount = await deployedPendingOrders._ordersCount();
    expect(ordersCount).to.be.bignumber.equal(new BN(ordersApplied.length.toString()));

    let totalWithdrow = [
      { account: 0, sum: 0 },
      { account: 1, sum: 0 },
      { account: 2, sum: 0 },
      { account: 3, sum: 0 },
      { account: 4, sum: 0 },
      { account: 5, sum: 0 },
      { account: 6, sum: 0 },
      { account: 7, sum: 0 },
      { account: 8, sum: 0 },
      { account: 9, sum: 0 }
    ]

    // console.log("whitePrice:", whitePricePpedictionBeforeTest.toString());
    // console.log("blackPrice:", blackPricePpedictionBeforeTest.toString());

    for (let event of eventsArray) {
      const pendingOrders = ordersApplied.filter(el => event.eventId.eq(el.eventId));

      await executeEventIteration(event.eventId, event.eventResult, pendingOrders);
      const duration = time.duration.minutes(1);
      await time.increase(duration);
      const whitePricePpedictionAfterEvent = await deployedPredictionPool._whitePrice()
      const blackPricePpedictionAfterEvent = await deployedPredictionPool._blackPrice()
      // console.log("whitePrice:", whitePricePpedictionAfterEvent.toString());
      // console.log("blackPrice:", blackPricePpedictionAfterEvent.toString());
    }

    function* enumerate(iterable) {
      let i = 0;

      for (const x of iterable) {
        yield [i, x];
        i++;
      }
    }

    for (const [i, account] of enumerate(accounts)) {

      const pendingOrders = ordersApplied.filter(el => i === el.account);
      // console.log(i, account, JSON.stringify(pendingOrders, null, 4));

      const sumColForWhite = pendingOrders
        .filter(el => el.isWhite === true)
        .reduce((accumulator, a) => accumulator + a.amount, 0);
      // console.log("sumColForWhite:", sumColForWhite);

      const sumColForBlack = pendingOrders
        .filter(el => el.isWhite === false)
        .reduce((accumulator, a) => accumulator + a.amount, 0);
      // console.log("sumColForBlack:", sumColForBlack);
      // const withdrawCollateral = await deployedPendingOrders.withdrawCollateral({
      //   from: account
      // });
    }

    /*const withdrawCollateral = await deployedPendingOrders.withdrawCollateral();
    const { logs: withdrawCollateralLog } = withdrawCollateral;

    const collateralToSend = await getExactSellAmountOut(buyAmountOut, isWhite);

    expectEvent.inLogs(withdrawCollateralLog, 'CollateralWithdrew', {
      amount: new BN(collateralToSend)
    });*/
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

    const createOrderLog = await createPendingOrder(isWhite, amount, eventId);
    expectEvent.inLogs(createOrderLog, 'OrderCreated', {
      id: new BN("1")
    });

    // const createOrderLog = await cretePendingOrder(isWhite, amount, eventId);
    expectEvent.inLogs((await createPendingOrder(0, 60, eventId)), 'OrderCreated', {
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

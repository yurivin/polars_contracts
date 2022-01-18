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

    return ordersCountExpected;
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
    { account: 1, isWhite: true,  eventId: new BN("101"), amount: 100,  withdrawAfterEvent: false },
    { account: 1, isWhite: false, eventId: new BN("104"), amount: 1253, withdrawAfterEvent: true  },
    { account: 1, isWhite: true,  eventId: new BN("104"), amount: 1253, withdrawAfterEvent: false },
    { account: 1, isWhite: true,  eventId: new BN("106"), amount: 273,  withdrawAfterEvent: true  },
    { account: 2, isWhite: true,  eventId: new BN("101"), amount: 332,  withdrawAfterEvent: false },
    { account: 2, isWhite: false, eventId: new BN("105"), amount: 14,   withdrawAfterEvent: false },
    { account: 4, isWhite: true,  eventId: new BN("104"), amount: 1253, withdrawAfterEvent: false }
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

  it.only("test suite for multiple pending orders", async () => {

    await addLiquidityToPrediction();
    const userColTotal = 100000;

    for (const i of [...Array(accounts.length).keys()]) {
      if (i > 0) { await sendCollateralTokenToUser(accounts[i], userColTotal) }
    }

    //================= НЕ УДАЛЯТЬ !!! =============================
    // let ordersApplied = [bids[0]];
    // let ordersApplied = [bids[0], bids[1], bids[2], bids[3], bids[4], bids[5], bids[6]];
    // let ordersApplied = [bids[0], bids[1], bids[2], bids[3], bids[4], bids[5]];

    // let ordersApplied = [
    //   { account: 1, isWhite: true,  eventId: new BN("102"), amount: 100,  withdrawAfterEvent: false },
    //   bids[1]
    // ];

    // let ordersApplied = [bids[0], bids[1]];
    // let ordersApplied = [bids[0], bids[1], bids[2]];
    // let ordersApplied = [bids[2]];
    // let ordersApplied = [bids[0], bids[1], bids[3]];
    let ordersApplied = [bids[0], bids[1], bids[2], bids[3]];
    // let ordersApplied = [bids[0], bids[1], bids[2]];
    // let ordersApplied = [bids[0], bids[1], bids[2], bids[3], bids[4]];
    // let ordersApplied = [bids[0], bids[2], bids[4]];

    //================= НЕ УДАЛЯТЬ !!! =============================

    for (let bid of ordersApplied) {
      bid.id = await createPendingOrder(bid.isWhite, bid.amount, bid.eventId, accounts[bid.account]); // runner = 0
      bid.withdrawDone = false;
    }

    const ordersCount = await deployedPendingOrders._ordersCount();
    expect(ordersCount).to.be.bignumber.equal(new BN(ordersApplied.length.toString()));

    let totalwithdraw = [...Array(accounts.length).keys()]
      .map((el) => {
        return { account: el, colateral: 0, white: 0, black: 0, orders: [], orders2: [] };
      });

    let pO = []

    let doneEvents = []

    for (let event of eventsArray) {
      console.log("Start event #:", event.eventId.toString());
      const pendingOrders = ordersApplied.filter(el => event.eventId.eq(el.eventId)) //.map(el => { event: event.eventId, el});

      const whitePricePpedictionBeforeEvent = await deployedPredictionPool._whitePrice()
      const blackPricePpedictionBeforeEvent = await deployedPredictionPool._blackPrice()
      const whitePriceBefore = new bigDecimal(whitePricePpedictionBeforeEvent.toString(10))
        .divide(new bigDecimal(BONE.toString(10)), 18);
      const blackPriceBefore = new bigDecimal(blackPricePpedictionBeforeEvent.toString(10))
        .divide(new bigDecimal(BONE.toString(10)), 18);
      const fee = new bigDecimal((await deployedPredictionPool.FEE()).toString())
        .divide(new bigDecimal(BONE.toString(10)), 18);
      // doneEvents = [...doneEvents, ...pendingOrders];

      const ttt = pendingOrders.map(
        (el) => {
          const amountBDb = new bigDecimal(ntob(el.amount));
          const f = amountBDb.multiply(fee);
          const a = amountBDb.subtract(f);
          const n1 = a.divide(el.isWhite ? whitePriceBefore : blackPriceBefore, 18).round();
          return {
            "id": el.id,
            "account": el.account,
            "isWhite": el.isWhite,
            "withdrawAfterEvent": el.withdrawAfterEvent,
            "eventId2": el.eventId.toString(),
            "eventId": el.eventId, //.toString(),
            "amountBefore": el.amount,
            "feeBefore": f.getValue(),
            "feeAfter": 0,
            "tokens": n1.getValue(),
            "amountAfter": 0,
            "withdrawDone": false
          };
        }
      )

      await executeEventIteration(event.eventId, event.eventResult, pendingOrders);
      const duration = time.duration.minutes(1);
      await time.increase(duration);

      console.log("==================");
      const whitePricePpedictionAfterEvent = await deployedPredictionPool._whitePrice()
      const blackPricePpedictionAfterEvent = await deployedPredictionPool._blackPrice()
      console.log("whitePriceA:", whitePricePpedictionAfterEvent.toString());
      console.log("blackPriceA:", blackPricePpedictionAfterEvent.toString());

      const whitePriceAfter = new bigDecimal(whitePricePpedictionAfterEvent.toString(10))
        .divide(new bigDecimal(BONE.toString(10)), 18);
      const blackPriceAfter = new bigDecimal(blackPricePpedictionAfterEvent.toString(10))
        .divide(new bigDecimal(BONE.toString(10)), 18);

      const ttt2 = ttt.map(
        (order) => {
          const x = new bigDecimal(
            order.tokens // amountIn
          ).multiply(order.isWhite ? whitePriceAfter : blackPriceAfter)//.round()
          const aFeeBD = x.multiply(fee).round();
          const collateralToSend = x.subtract(aFeeBD).round();


          return {
            "id": order.id,
            "account": order.account,
            "isWhite": order.isWhite,
            "withdrawAfterEvent": order.withdrawAfterEvent,
            "eventId2": order.eventId.toString(),
            "eventId": order.eventId, //.toString(),
            "amount": order.amount,
            "amountBefore": order.amountBefore,
            "feeBefore": order.feeBefore,
            "feeAfter": aFeeBD.getValue(),
            "tokens": order.tokens,
            "amountAfter": collateralToSend.getValue(),
            "amountAfter2": collateralToSend.divide(new bigDecimal(BONE.toString(10)), 18).getValue(),
            "withdrawDone": order.withdrawDone,
          };
        }
      )

      ordersApplied.map(
        (order) => {
          let tmpOrder = ttt2.filter(el => order.id === el.id)
          if (tmpOrder.length > 0) {
            tmpOrder = tmpOrder.shift();
            order.eventId2 = tmpOrder.eventId2;
            order.amountBefore = tmpOrder.amountBefore;
            order.feeBefore = tmpOrder.feeBefore;
            order.feeAfter = tmpOrder.feeAfter;
            order.amountAfter = tmpOrder.amountAfter;
            order.amountAfter2 = tmpOrder.amountAfter2;
          }
          return order;
        }
      )


      let accountsSum = [...Array(accounts.length).keys()].map((el) => {
        return { account: el, sum: new BN("0"), needWD: false }
      })

      const ordersToWithDraw = ordersApplied
        .filter(el => el.withdrawDone === false)
        .filter(el => event.eventId.eq(el.eventId))
        .filter(el => el.withdrawAfterEvent === true)
      let withdraw = new BN(0);
      if (ordersToWithDraw.length > 0) {
        withdraw = ordersApplied
          .filter(el => event.eventId.gte(el.eventId))
          .filter(el => el.withdrawDone === false)
          .reduce((a, el) => {
            a[el.account].account = el.account
            a[el.account].sum = new BN(el.amountAfter).add(a[el.account].sum)

            const rrr = ordersApplied
              .filter(order => order.account === el.account)
              .filter(order => event.eventId.eq(order.eventId))
              .filter(order => order.withdrawAfterEvent === true)
            if (rrr.length > 0) {
              a[el.account].needWD = true
            }
            return a
          }, accountsSum)
          // .reduce((accumulator, a) => accumulator.add(new BN(a.amountAfter)), new BN("0"))
        // console.log("withdraw:         ", withdraw);
        // var arr = [1, 2, 3, 4, 5];

        // var results = await Promise.all(
        //   arr.map(async (item) => {
        //     await callAsynchronousOperation(item);
        //     return item + 1;
        //   })
        // );

        // const arr = [1, 2, 3, 4, 5, 6, 7, 8];
        // const randomDelay = () => new Promise(resolve => setTimeout(resolve, Math.random() * 1000));

        // const calc = async n => {
        //   await randomDelay();
        //   return n * 2;
        // };

        // const asyncFunc = async () => {
        //   const unresolvedPromises = arr.map(n => calc(n));
        //   const results = await Promise.all(unresolvedPromises);
        //   console.log("results:", results)

        // };

        // asyncFunc();

        // const arr = await Promise.all(
        //   [1, 2, 3, 4, 5].map(
        //     async (value) => 2 * await asyncThing(value)
        //   )
        // );

        // console.log(arr); // [2, 4, 6, 8, 10]

        // const arr =
        // await Promise.all(
        //   withdraw.map(
        //     async (order) => {
        //       if (order.needWD) {
        //         ordersApplied
        //           .filter(el => el.withdrowDone === false)
        //           .filter(el => order.account === el.account)
        //           .filter(el => event.eventId.gte(el.eventId))
        //           .map(
        //             (el) => {
        //               el.withdrowDone = true;
        //               console.log("ORDER:         ", JSON.stringify(el, null, 4));
        //               return el
        //             }
        //           )

        //         const receipt = await withdrawAmount(accounts[order.account], order.sum.toString());
        //         console.log(`Pending orders GasUsed: ${receipt}`);
        //       }
        //       console.log("withdraw:         ", `{ account: ${order.account}, sum: ${order.sum.toString()}, needWD: ${order.needWD} }`);
        //     }
        //   )
        // );

        await withdraw.map(
          async (order) => {
            // return order;
            if (order.needWD) {

              await ordersApplied
                .filter(el => el.withdrawDone === false)
                .filter(el => order.account === el.account)
                .filter(el => event.eventId.gte(el.eventId))
                .map(
                  (el) => {
                    el.withdrawDone = true;
                    console.log("ORDER:         ", JSON.stringify(el, null, 4));
                    return el
                  }
                )

              // const receipt = await withdrawAmount(accounts[order.account], order.sum.toString());
              // const gasUsed = receipt.receipt.gasUsed;
              console.log(`Pending orders GasUsed: ${(await withdrawAmount(accounts[order.account], order.sum.toString()))}`);
            }
            await console.log("withdraw:         ", `{ account: ${order.account}, sum: ${order.sum.toString()}, needWD: ${order.needWD} }`);
          }
        )
      }

      ordersApplied
        .filter(el => event.eventId.gte(el.eventId))
        .filter(el => el.withdrawDone === false)
        // .filter(el => el.withdrawAfterEvent === true)
        .map(
          (order) => {
            console.log("ORDER2:         ", JSON.stringify(order, null, 4));
            return order;
          }
        )

      doneEvents.push({
        event: event.eventId,
        eventResult: event.eventResult.toString(),
        orders: pendingOrders,
        whitePriceBefore: whitePricePpedictionBeforeEvent.toString(),
        blackPriceBefore: blackPricePpedictionBeforeEvent.toString(),
        whitePriceBefore1: whitePriceBefore.getValue(),
        blackPriceBefore1: blackPriceBefore.getValue(),
        whitePriceAfter: whitePricePpedictionAfterEvent.toString(),
        blackPriceAfter: blackPricePpedictionAfterEvent.toString(),
        whitePriceAfter1: whitePriceAfter.getValue(),
        blackPriceAfter1: blackPriceAfter.getValue(),
      });

      console.log("End event #:", event.eventId.toString(), "result:", event.eventResult.toString());
      console.log("===========================================================");
    } // <=== for (let event of eventsArray)

    console.log("doneEvents:         ", JSON.stringify(doneEvents, null, 4));
  });

  const withdrawAmount = async (account, expextedAmount) => {
    const withdrawCollateral = await deployedPendingOrders.withdrawCollateral({
      from: account
    });
    const { logs: withdrawCollateralLog } = withdrawCollateral;
    expectEvent.inLogs(withdrawCollateralLog, 'CollateralWithdrew', {
      // amount: new BN("20")
      amount: new BN(expextedAmount)
    });
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

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

const { deployContracts, ntob, BONE } = require('./../utils.js');

const priceChangePart = ntob(0.05);

contract("DEV: PendingOrders", function (accounts) {
  "use strict";

  let deployedPredictionPool;
  let deployedEventLifeCycle;
  let deployedPendingOrders;
  let deployedCollateralToken;
  let deployedWhiteToken;
  let deployedBlackToken;
  let deployedPredictionCollateralization;

  const deployerAddress = accounts[0];

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
  });

  afterEach(async () => {

  });

  it('the deployer is the owner', async function () {
    expect(await deployedPendingOrders.owner()).to.equal(deployerAddress);
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

  it("should assert PendingOrders address equal EventLifeCycle._pendingOrders()", async () => {
    return assert.equal(deployedPendingOrders.address, await deployedEventLifeCycle._pendingOrders());
  });

  it("should assert EventLifeCycle._usePendingOrders() true", async () => {
    return assert.equal(await deployedEventLifeCycle._usePendingOrders(), true);
  });

  it("test suite for cancel order on event in progress", async () => {

    await addLiquidityToPrediction(50000);
    const userColTotal = 100000;

    for (const i of [...Array(accounts.length).keys()]) {
      if (i > 0) { await sendCollateralTokenToUser(accounts[i], userColTotal) }
    }
    const someEventsArray2 = [
      { eventId: new BN("101"), eventResult: new BN("1")  },
    ];

    let bid = { account: 3, isWhite: false, eventId: new BN("101"), amount: 1, withdrawAfterEvent: false, cancel: false };

    bid.id = await createPendingOrder(bid.isWhite, bid.amount, bid.eventId, accounts[bid.account]);

    const ordersCount = await deployedPendingOrders._ordersCount();
    expect(ordersCount).to.be.bignumber.equal(new BN("1"));

    const eventDuration = time.duration.seconds(5);

    await addAndStartEvent(someEventsArray2[0].eventId, eventDuration);

    await expectRevert(
      cancelOrder(bid.account, bid.id), "EVENT IN PROGRESS"
    );

    await time.increase(eventDuration);

    const endEvent = await deployedEventLifeCycle.endEvent(
      someEventsArray2[0].eventResult
    );

    await withdrawAmount(accounts[bid.account], new BN("944450619658606827"));

    const amountBN = ntob(bid.amount);

    await expectRevert(
      deployedPendingOrders.createOrder(
        amountBN,
        bid.isWhite,
        bid.eventId,
        { from: accounts[bid.account] }
      ), "EVENT ALREADY STARTED"
    );

    await expectRevert(
      deployedPendingOrders.createOrder(
        amountBN,
        !bid.isWhite,
        bid.eventId,
        { from: accounts[bid.account] }
      ), "EVENT ALREADY STARTED"
    );

    await expectRevert(
      deployedPendingOrders.withdrawCollateral({
        from: accounts[bid.account]
      }), "YOU DON'T HAVE ORDERS"
    );
  });

  it("test suite for Aider case (create order after event done)", async () => {

    await addLiquidityToPrediction(50000);
    const userColTotal = 100000;

    for (const i of [...Array(accounts.length).keys()]) {
      if (i > 0) { await sendCollateralTokenToUser(accounts[i], userColTotal) }
    }
    const someEventsArray2 = [
      { eventId: new BN("101"), eventResult: new BN("1")  },
    ];

    let ordersApplied = [
      { account: 3, isWhite: false, eventId: new BN("101"), amount: 1, withdrawAfterEvent: false, cancel: false }
    ];

    for (let bid of ordersApplied) {
      bid.id = await createPendingOrder(bid.isWhite, bid.amount, bid.eventId, accounts[bid.account]); // runner = 0
      bid.withdrawDone = false;
    }

    const ordersCount = await deployedPendingOrders._ordersCount();
    expect(ordersCount).to.be.bignumber.equal(new BN(ordersApplied.length.toString()));

    const eventDuration = time.duration.seconds(5);

    await addAndStartEvent(someEventsArray2[0].eventId, eventDuration);

    await time.increase(eventDuration);
    const endEvent = await deployedEventLifeCycle.endEvent(
      someEventsArray2[0].eventResult
    );

    await withdrawAmount(accounts[ordersApplied[0].account], new BN("944450619658606827"));

    const amountBN = ntob(ordersApplied[0].amount);

    await expectRevert(
      deployedPendingOrders.createOrder(
        amountBN,
        ordersApplied[0].isWhite,
        ordersApplied[0].eventId,
        { from: accounts[ordersApplied[0].account] }
      ), "EVENT ALREADY STARTED"
    );

    await expectRevert(
      deployedPendingOrders.createOrder(
        amountBN,
        !ordersApplied[0].isWhite,
        ordersApplied[0].eventId,
        { from: accounts[ordersApplied[0].account] }
      ), "EVENT ALREADY STARTED"
    );

    await expectRevert(
      deployedPendingOrders.withdrawCollateral({
        from: accounts[ordersApplied[0].account]
      }), "YOU DON'T HAVE ORDERS"
    );
  });

  it("test emergency withdraw by owner", async () => {

    await addLiquidityToPrediction(50000);
    const userColTotal = 100000;

    for (const i of [...Array(accounts.length).keys()]) {
      if (i > 0) { await sendCollateralTokenToUser(accounts[i], userColTotal) }
    }
    const someEventsArray2 = [
      { eventId: new BN("101"), eventResult: new BN("1")  },
    ];

    const someBids2 = [
      { account: 3, isWhite: false, eventId: new BN("3639043"), amount: 1, withdrawAfterEvent: false, cancel: false }, // 0xe9d3f501b082ba426b4fb1be6b00be64d486d4d9
      { account: 3, isWhite: false, eventId: new BN("3639043"), amount: 10, withdrawAfterEvent: false, cancel: false }, // 0xe9d3f501b082ba426b4fb1be6b00be64d486d4d9
      { account: 4, isWhite: false, eventId: new BN("3639043"), amount: 32, withdrawAfterEvent: false, cancel: false }, // 0x104be074ad7bb0357258e9afe9b8e0a58c551833
      { account: 5, isWhite: false, eventId: new BN("3836557"), amount: 333, withdrawAfterEvent: false, cancel: false }, // 0x6ff725c5d3064bb15bd112bdcce634efe38f3622
      { account: 5, isWhite: false, eventId: new BN("3639055"), amount: 62, withdrawAfterEvent: false, cancel: false }, // 0x6ff725c5d3064bb15bd112bdcce634efe38f3622
      { account: 5, isWhite: false, eventId: new BN("3610190"), amount: 40, withdrawAfterEvent: false, cancel: false }, // 0x6ff725c5d3064bb15bd112bdcce634efe38f3622
      { account: 5, isWhite: false, eventId: new BN("3629382"), amount: 906, withdrawAfterEvent: false, cancel: false }, // 0x6ff725c5d3064bb15bd112bdcce634efe38f3622
      { account: 5, isWhite: false, eventId: new BN("3639054"), amount: 87, withdrawAfterEvent: true,  cancel: false }, // 0x6ff725c5d3064bb15bd112bdcce634efe38f3622
    ]

    let ordersApplied = [
      someBids2[0],
      someBids2[1],
      someBids2[2],
      someBids2[3],
      someBids2[4],
      someBids2[5],
      someBids2[6],
      someBids2[7]
    ];

    for (let bid of ordersApplied) {
      bid.id = await createPendingOrder(bid.isWhite, bid.amount, bid.eventId, accounts[bid.account]); // runner = 0
      bid.withdrawDone = false;
    }

    const ordersCount = await deployedPendingOrders._ordersCount();
    expect(ordersCount).to.be.bignumber.equal(new BN(ordersApplied.length.toString()));

    const colBalancePO = await deployedCollateralToken.balanceOf(deployedPendingOrders.address);

    const colBalanceOwner = await deployedCollateralToken.balanceOf(deployerAddress);

    const sum = ordersApplied
    .map((el) => {
      return el.amount;
    })
    .reduce(
      (previousValue, currentValue) => previousValue + currentValue, 0
    );
    expect(ntob(sum)).to.be.bignumber.equal(colBalancePO);

    await deployedPendingOrders.emergencyWithdrawCollateral()

    const colBalancePO2 = await deployedCollateralToken.balanceOf(deployedPendingOrders.address);
    expect(new BN("0")).to.be.bignumber.equal(colBalancePO2);

    const colBalanceOwner2 = await deployedCollateralToken.balanceOf(deployerAddress);
    expect(colBalanceOwner2).to.be.bignumber.equal(colBalanceOwner.add(ntob(sum)));
  });

  it.skip("test suite for multiple pending orders (8 orders) - ERRORED", async () => {

    await addLiquidityToPrediction(50000);
    const userColTotal = 100000;

    for (const i of [...Array(accounts.length).keys()]) {
      if (i > 0) { await sendCollateralTokenToUser(accounts[i], userColTotal) }
    }
    const someEventsArray2 = [
      { eventId: new BN("101"), eventResult: new BN("1")  },
      { eventId: new BN("102"), eventResult: new BN("1")  },
      { eventId: new BN("103"), eventResult: new BN("0")  },
      { eventId: new BN("104"), eventResult: new BN("1")  },
      { eventId: new BN("105"), eventResult: new BN("-1") },
      { eventId: new BN("106"), eventResult: new BN("-1") },
      { eventId: new BN("107"), eventResult: new BN("0")  }
    ];

    const someBids2 = [
      { account: 3, isWhite: false, eventId: new BN("3639043"), amount: 1, withdrawAfterEvent: false, cancel: false }, // 0xe9d3f501b082ba426b4fb1be6b00be64d486d4d9
      { account: 3, isWhite: false, eventId: new BN("3639043"), amount: 1, withdrawAfterEvent: false, cancel: false }, // 0xe9d3f501b082ba426b4fb1be6b00be64d486d4d9
      { account: 4, isWhite: false, eventId: new BN("3639043"), amount: 1, withdrawAfterEvent: false, cancel: false }, // 0x104be074ad7bb0357258e9afe9b8e0a58c551833
      { account: 5, isWhite: false, eventId: new BN("3836557"), amount: 1, withdrawAfterEvent: false, cancel: false }, // 0x6ff725c5d3064bb15bd112bdcce634efe38f3622
      { account: 5, isWhite: false, eventId: new BN("3639055"), amount: 1, withdrawAfterEvent: false, cancel: false }, // 0x6ff725c5d3064bb15bd112bdcce634efe38f3622
      { account: 5, isWhite: false, eventId: new BN("3610190"), amount: 1, withdrawAfterEvent: false, cancel: false }, // 0x6ff725c5d3064bb15bd112bdcce634efe38f3622
      { account: 5, isWhite: false, eventId: new BN("3629382"), amount: 1, withdrawAfterEvent: false, cancel: false }, // 0x6ff725c5d3064bb15bd112bdcce634efe38f3622
      { account: 5, isWhite: false, eventId: new BN("3639054"), amount: 1, withdrawAfterEvent: true,  cancel: false }, // 0x6ff725c5d3064bb15bd112bdcce634efe38f3622
    ]

    let ordersApplied = [
      someBids2[0],
      someBids2[1],
      someBids2[2],
      someBids2[3],
      someBids2[4],
      someBids2[5],
      someBids2[6],
      someBids2[7]
    ];

    for (let bid of ordersApplied) {
      bid.id = await createPendingOrder(bid.isWhite, bid.amount, bid.eventId, accounts[bid.account]); // runner = 0
      bid.withdrawDone = false;
    }

    const ordersCount = await deployedPendingOrders._ordersCount();
    expect(ordersCount).to.be.bignumber.equal(new BN(ordersApplied.length.toString()));

    await runEvents(someEventsArray2, ordersApplied);

    await withdrawAmount(accounts[3], 0);
    assert.equal(1, 0, `ddddddddddd`);
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
      eventId,
      { from: deployerAddress }
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
    expect(whitePrice).to.be.bignumber.equal(new BN("500000000000000000"));

    const whiteBoughtBefore = await deployedPredictionPool._whiteBought();

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
    expect(whiteBoughtBefore.add(expectedWhiteBuy)).to.be.bignumber.equal(whiteBoughtDuringEvent);

    return await expectRevert(
      deployedEventLifeCycle.endEvent(
        eventResult
      ), "Cannot buyback more than sold from the pool"
    );
  });

  it.skip("should assert PredictionPool whiteBoughtBefore equal whiteBoughtAfter after work pending order", async () => {

    await addLiquidityToPrediction(50000);

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

  const someEventsArray = [
    { eventId: new BN("101"), eventResult: new BN("1")  },
    { eventId: new BN("102"), eventResult: new BN("1")  },
    { eventId: new BN("103"), eventResult: new BN("0")  },
    { eventId: new BN("104"), eventResult: new BN("1")  },
    { eventId: new BN("105"), eventResult: new BN("-1") },
    { eventId: new BN("106"), eventResult: new BN("-1") },
    { eventId: new BN("107"), eventResult: new BN("0")  }
  ];

  const someBids = [
    { account: 1, isWhite: true,  eventId: new BN("101"), amount: 100,  withdrawAfterEvent: false, cancel: false },
    { account: 1, isWhite: false, eventId: new BN("104"), amount: 1253, withdrawAfterEvent: true,  cancel: false },
    { account: 1, isWhite: true,  eventId: new BN("104"), amount: 1253, withdrawAfterEvent: false, cancel: false },
    { account: 1, isWhite: true,  eventId: new BN("106"), amount: 273,  withdrawAfterEvent: true,  cancel: false },
    { account: 2, isWhite: true,  eventId: new BN("101"), amount: 332,  withdrawAfterEvent: false, cancel: false },
    { account: 2, isWhite: false, eventId: new BN("105"), amount: 14,   withdrawAfterEvent: false, cancel: false },
    { account: 4, isWhite: true,  eventId: new BN("104"), amount: 1253, withdrawAfterEvent: false, cancel: false },
    { account: 2, isWhite: false, eventId: new BN("103"), amount: 14,   withdrawAfterEvent: true,  cancel: false },
  ]

  it("test suite for multiple pending orders (8 orders)", async () => {

    await addLiquidityToPrediction(50000);
    const userColTotal = 100000;

    for (const i of [...Array(accounts.length).keys()]) {
      if (i > 0) { await sendCollateralTokenToUser(accounts[i], userColTotal) }
    }

    let ordersApplied = [
      someBids[0],
      someBids[1],
      someBids[2],
      someBids[3],
      someBids[4],
      someBids[5],
      someBids[6],
      someBids[7]
    ];

    for (let bid of ordersApplied) {
      bid.id = await createPendingOrder(bid.isWhite, bid.amount, bid.eventId, accounts[bid.account]); // runner = 0
      bid.withdrawDone = false;
    }

    const ordersCount = await deployedPendingOrders._ordersCount();
    expect(ordersCount).to.be.bignumber.equal(new BN(ordersApplied.length.toString()));

    await runEvents(someEventsArray, ordersApplied);
  });

  it("test suite for check _ordersOfUser of pending orders (8 orders)", async () => {

    await addLiquidityToPrediction(50000);
    const userColTotal = 100000;

    for (const i of [...Array(accounts.length).keys()]) {
      if (i > 0) { await sendCollateralTokenToUser(accounts[i], userColTotal) }
    }

    let ordersApplied = [
      { account: 1, isWhite: true,  eventId: new BN("101"), amount: 100,  withdrawAfterEvent: false, cancel: false },
      { account: 1, isWhite: false, eventId: new BN("104"), amount: 1253, withdrawAfterEvent: true,  cancel: false },
      { account: 1, isWhite: true,  eventId: new BN("104"), amount: 1253, withdrawAfterEvent: false, cancel: false },
      { account: 1, isWhite: true,  eventId: new BN("106"), amount: 273,  withdrawAfterEvent: true,  cancel: false },
      { account: 2, isWhite: true,  eventId: new BN("101"), amount: 332,  withdrawAfterEvent: false, cancel: false },
      { account: 2, isWhite: false, eventId: new BN("105"), amount: 14,   withdrawAfterEvent: false, cancel: false },
      { account: 4, isWhite: true,  eventId: new BN("104"), amount: 1253, withdrawAfterEvent: false, cancel: false },
      { account: 2, isWhite: false, eventId: new BN("103"), amount: 14,   withdrawAfterEvent: true,  cancel: false },
    ];

    for (let bid of ordersApplied) {
      bid.id = await createPendingOrder(bid.isWhite, bid.amount, bid.eventId, accounts[bid.account]); // runner = 0
      bid.withdrawDone = false;
    }

    const groupByCategory = ordersApplied.reduce((group, order) => {
      const { account } = order;
      group[accounts[account]] = group[accounts[account]] ?? 0;
      group[accounts[account]]++;
      return group;
    }, {});

    await Promise.all(
      accounts.map(async (account) => {
        const _ordersOfUser = await deployedPendingOrders.ordersOfUser(account);
        expect(new BN(_ordersOfUser.length)).to.be.bignumber.equal(new BN(groupByCategory[account]));
      })
    )
    const ordersCount = await deployedPendingOrders._ordersCount();
    expect(ordersCount).to.be.bignumber.equal(new BN(ordersApplied.length.toString()));
  });

  it("test suite for multiple pending orders (7 orders)", async () => {

    await addLiquidityToPrediction(50000);
    const userColTotal = 100000;

    for (const i of [...Array(accounts.length).keys()]) {
      if (i > 0) { await sendCollateralTokenToUser(accounts[i], userColTotal) }
    }

    let ordersApplied = [
      someBids[0],
      someBids[1],
      someBids[2],
      someBids[3],
      someBids[4],
      someBids[5],
      someBids[6]
    ];

    for (let bid of ordersApplied) {
      bid.id = await createPendingOrder(bid.isWhite, bid.amount, bid.eventId, accounts[bid.account]); // runner = 0
      bid.withdrawDone = false;
    }

    const ordersCount = await deployedPendingOrders._ordersCount();
    expect(ordersCount).to.be.bignumber.equal(new BN(ordersApplied.length.toString()));

    await runEvents(someEventsArray, ordersApplied);
  });

  it("test suite for multiple pending orders (10 orders)", async () => {

    await addLiquidityToPrediction(50000);
    const userColTotal = 100000;

    for (const i of [...Array(accounts.length).keys()]) {
      if (i > 0) { await sendCollateralTokenToUser(accounts[i], userColTotal) }
    }

    let ordersApplied = [
      { account: 1, isWhite: true,  eventId: new BN("101"), amount: 100,  withdrawAfterEvent: false, cancel: false },
      { account: 1, isWhite: false, eventId: new BN("104"), amount: 1253, withdrawAfterEvent: true,  cancel: false },
      { account: 1, isWhite: true,  eventId: new BN("104"), amount: 1253, withdrawAfterEvent: false, cancel: false },
      { account: 1, isWhite: true,  eventId: new BN("106"), amount: 273,  withdrawAfterEvent: true,  cancel: false },
      { account: 2, isWhite: true,  eventId: new BN("101"), amount: 332,  withdrawAfterEvent: false, cancel: false },
      { account: 2, isWhite: false, eventId: new BN("105"), amount: 14,   withdrawAfterEvent: false, cancel: false },
      { account: 3, isWhite: false, eventId: new BN("106"), amount: 2730, withdrawAfterEvent: true,  cancel: false },
      { account: 4, isWhite: true,  eventId: new BN("104"), amount: 1253, withdrawAfterEvent: false, cancel: false },
      { account: 2, isWhite: false, eventId: new BN("103"), amount: 14,   withdrawAfterEvent: true,  cancel: false },
      { account: 0, isWhite: false, eventId: new BN("104"), amount: 6222, withdrawAfterEvent: false, cancel: false },
    ];

    for (let bid of ordersApplied) {
      bid.id = await createPendingOrder(bid.isWhite, bid.amount, bid.eventId, accounts[bid.account]); // runner = 0
      bid.withdrawDone = false;
    }

    const ordersCount = await deployedPendingOrders._ordersCount();
    expect(ordersCount).to.be.bignumber.equal(new BN(ordersApplied.length.toString()));

    await runEvents(someEventsArray, ordersApplied);
  });

  it("test suite for multiple pending orders (10 orders, 3 cancel)", async () => {

    await addLiquidityToPrediction(50000);
    const userColTotal = 100000;

    for (const i of [...Array(accounts.length).keys()]) {
      if (i > 0) { await sendCollateralTokenToUser(accounts[i], userColTotal) }
    }

    let ordersApplied = [
      { account: 1, isWhite: true,  eventId: new BN("101"), amount: 100,  withdrawAfterEvent: false, cancel: false },
      { account: 1, isWhite: false, eventId: new BN("104"), amount: 1253, withdrawAfterEvent: true,  cancel: false },
      { account: 1, isWhite: true,  eventId: new BN("104"), amount: 1253, withdrawAfterEvent: false, cancel: true  },
      { account: 1, isWhite: true,  eventId: new BN("106"), amount: 273,  withdrawAfterEvent: true,  cancel: false },
      { account: 2, isWhite: true,  eventId: new BN("101"), amount: 332,  withdrawAfterEvent: false, cancel: false },
      { account: 2, isWhite: false, eventId: new BN("105"), amount: 14,   withdrawAfterEvent: false, cancel: false },
      { account: 3, isWhite: false, eventId: new BN("106"), amount: 2730, withdrawAfterEvent: true,  cancel: true  },
      { account: 4, isWhite: true,  eventId: new BN("104"), amount: 1253, withdrawAfterEvent: false, cancel: false },
      { account: 2, isWhite: false, eventId: new BN("103"), amount: 14,   withdrawAfterEvent: true,  cancel: false },
      { account: 0, isWhite: false, eventId: new BN("104"), amount: 6222, withdrawAfterEvent: false, cancel: true  },
    ];

    for (let bid of ordersApplied) {
      bid.id = await createPendingOrder(bid.isWhite, bid.amount, bid.eventId, accounts[bid.account]); // runner = 0
      bid.withdrawDone = false;
    }

    const ordersCount = await deployedPendingOrders._ordersCount();
    expect(ordersCount).to.be.bignumber.equal(new BN(ordersApplied.length.toString()));

    await runEvents(someEventsArray, ordersApplied);
  });

  it("REVERT: pending orders 'NOT ENOUGH COLLATERAL IN USER'S ACCOUNT'", async () => {

    await addLiquidityToPrediction(50000);
    const userColTotal = 99999;

    await sendCollateralTokenToUser(accounts[1], userColTotal)

    await expectRevert(
      deployedPendingOrders.createOrder(
        ntob(100000),
        true, // isWhite = true
        new BN("101"),
        { from: accounts[1] }
      ),
      "NOT ENOUGH COLLATERAL IN USER'S ACCOUNT",
    );

    const ordersCount = await deployedPendingOrders._ordersCount();
    expect(ordersCount).to.be.bignumber.equal(new BN(0));
  });

  it("test suite for multiple pending orders (10 orders from 1 account)", async () => {

    await addLiquidityToPrediction(50000);
    // await addLiquidityToPrediction(5); // <-- on this, safeMath error
    const userColTotal = 100000;

    await sendCollateralTokenToUser(accounts[1], userColTotal)

    let ordersApplied = [
      { account: 1, isWhite: true,  eventId: new BN("101"), amount: 100,  withdrawAfterEvent: false, cancel: false },
      { account: 1, isWhite: false, eventId: new BN("102"), amount: 1253, withdrawAfterEvent: false, cancel: false },
      { account: 1, isWhite: true,  eventId: new BN("103"), amount: 1253, withdrawAfterEvent: false, cancel: false },
      { account: 1, isWhite: true,  eventId: new BN("104"), amount: 273,  withdrawAfterEvent: false, cancel: false },
      { account: 1, isWhite: true,  eventId: new BN("105"), amount: 332,  withdrawAfterEvent: false, cancel: false },
      { account: 1, isWhite: false, eventId: new BN("106"), amount: 14,   withdrawAfterEvent: false, cancel: false },
      { account: 1, isWhite: false, eventId: new BN("107"), amount: 2730, withdrawAfterEvent: false, cancel: false },
      { account: 1, isWhite: true,  eventId: new BN("105"), amount: 1253, withdrawAfterEvent: false, cancel: false },
      { account: 1, isWhite: false, eventId: new BN("103"), amount: 2795, withdrawAfterEvent: false, cancel: false },
    ];

    for (let bid of ordersApplied) {
      bid.id = await createPendingOrder(bid.isWhite, bid.amount, bid.eventId, accounts[bid.account]); // runner = 0
      bid.withdrawDone = false;
    }

    const ordersCount = await deployedPendingOrders._ordersCount();
    expect(ordersCount).to.be.bignumber.equal(new BN(ordersApplied.length.toString()));

    await runEvents(someEventsArray, ordersApplied);
  });

  it.skip("should assert PredictionPool whiteBoughtBefore equal whiteBoughtAfter after work pending order", async () => {

    await addLiquidityToPrediction(50000);

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

  it("should assert orders count equal 0", async () => {
    const ordersCount = await deployedPendingOrders._ordersCount();
    return expect(ordersCount).to.be.bignumber.equal(new BN("0"));
  });

  it("should REVERT on 'Actual price is higher than acceptable by the user'", async () => {
    await expectRevert(
      deployedPredictionPool.buyWhite(
        ntob(0.4),
        ntob(5),
        { from: deployerAddress }
      ),
      "Actual price is higher than acceptable by the user",
    );
  });

  // Utility
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

  const addLiquidityToPrediction = async (amount) => {
    const collateralAmountToBuy = ntob(100000);
    const buyPayment = ntob(amount);

    const initialBlackOrWhitePrice = ntob(0.5);

    const collateralTokenDeployerBalance = await deployedCollateralToken.balanceOf(deployerAddress);

    expect(collateralTokenDeployerBalance).to.be.bignumber.at.least(collateralAmountToBuy);

    const eventCount = 1;
    const buyWhiteLog = await buyToken("white", initialBlackOrWhitePrice, buyPayment);

    const fee = new bigDecimal((await deployedPredictionPool.FEE()).toString())
      .divide(new bigDecimal(BONE.toString(10)), 18);

    const feeAmount = new bigDecimal(buyPayment.toString(10))
      .multiply(fee)

    const cleanAmount = new bigDecimal(buyPayment.toString(10)).subtract(feeAmount)

    const whiteBought = ntob(cleanAmount.divide(new bigDecimal(initialBlackOrWhitePrice.toString(10)), 18).getValue())

    expectEvent.inLogs(buyWhiteLog, 'BuyWhite', {
      user: deployerAddress,
      amount: whiteBought,
      price: initialBlackOrWhitePrice
    });

    expect(
      await deployedWhiteToken.balanceOf(deployerAddress)
    ).to.be.bignumber.equal(whiteBought);

    const buyBlackLog = await buyToken("black", initialBlackOrWhitePrice, buyPayment);

    const blackBought = whiteBought;

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
      eventId,
      { from: deployerAddress }
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
      .filter(el => el.cancel === false)
      .filter(el => el.isWhite === true)
      .reduce((accumulator, a) => accumulator + a.amount, 0);

    const sumBlack = orders
      .filter(el => el.cancel === false)
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

  const sendCollateralTokenToUser = async (user, amount) => {
    const collateralAmount = ntob(amount)

    const collateralTokenUserBalanceBefore = await deployedCollateralToken.balanceOf(user);

    await deployedCollateralToken.transfer(user, collateralAmount, { from: deployerAddress })

    const collateralTokenUserBalanceAfter = await deployedCollateralToken.balanceOf(user);
    expect(collateralTokenUserBalanceBefore.add(collateralAmount))
      .to.be.bignumber.equal(collateralTokenUserBalanceAfter);

    await deployedCollateralToken.approve(deployedPendingOrders.address, collateralAmount, { from: user })

    expect((await deployedCollateralToken.allowance(user, deployedPendingOrders.address)))
      .to.be.bignumber.equal(collateralAmount);
  }

  const withdrawAmount = async (account, expextedAmount) => {
    const withdrawCollateral = await deployedPendingOrders.withdrawCollateral({
      from: account
    });
    const { logs: withdrawCollateralLog } = withdrawCollateral;
    expectEvent.inLogs(withdrawCollateralLog, 'CollateralWithdrew', {
      amount: new BN(expextedAmount)
    });
    return withdrawCollateral;
  }

  const cancelOrder = async (accountId, orderId) => {
    const cancelOrder = await deployedPendingOrders.cancelOrder(
      orderId,
      { from: accounts[accountId] }
    );
    const { logs: cancelOrderLog } = cancelOrder;
    expectEvent.inLogs(cancelOrderLog, 'OrderCanceled', {
      id: orderId
    });
    return cancelOrder;
  }

  const runEvents = async(eventsArray, ordersApplied, debug=0) => {
    for (let event of eventsArray) {
      if (debug) console.log('\x1b[33m%s%s\x1b[0m', "Start event #", event.eventId.toString());

      const whitePricePpedictionBeforeEvent = await deployedPredictionPool._whitePrice()
      const blackPricePpedictionBeforeEvent = await deployedPredictionPool._blackPrice()
      const whitePriceBefore = new bigDecimal(whitePricePpedictionBeforeEvent.toString(10))
        .divide(new bigDecimal(BONE.toString(10)), 18);
      const blackPriceBefore = new bigDecimal(blackPricePpedictionBeforeEvent.toString(10))
        .divide(new bigDecimal(BONE.toString(10)), 18);
      const fee = new bigDecimal((await deployedPredictionPool.FEE()).toString())
        .divide(new bigDecimal(BONE.toString(10)), 18);

      ordersApplied
        .filter(el => event.eventId.eq(el.eventId))
        .map((el) => {
          if (el.cancel === true) {
            cancelOrder(el.account, el.id)
          }
        })

      const pendingOrders = ordersApplied
        .filter(el => event.eventId.eq(el.eventId))
        .filter(el => el.cancel === false)

      const pendingOrdersBeforeStart = pendingOrders
        .map((el) => {
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
            "eventId": el.eventId,
            "amountBefore": el.amount,
            "feeBefore": f.getValue(),
            "feeAfter": 0,
            "tokens": n1.getValue(),
            "amountAfter": 0,
            "cancel": el.cancel,
            "withdrawDone": false
          };
        })

      await executeEventIteration(event.eventId, event.eventResult, pendingOrders);
      const duration = time.duration.minutes(1);
      await time.increase(duration);

      if (debug) console.log('\x1b[33m%s\x1b[0m', "========After event==========");
      const whitePricePpedictionAfterEvent = await deployedPredictionPool._whitePrice()
      const blackPricePpedictionAfterEvent = await deployedPredictionPool._blackPrice()
      if (debug) console.log("whitePriceA:", whitePricePpedictionAfterEvent.toString());
      if (debug) console.log("blackPriceA:", blackPricePpedictionAfterEvent.toString());

      const whitePriceAfter = new bigDecimal(whitePricePpedictionAfterEvent.toString(10))
        .divide(new bigDecimal(BONE.toString(10)), 18);
      const blackPriceAfter = new bigDecimal(blackPricePpedictionAfterEvent.toString(10))
        .divide(new bigDecimal(BONE.toString(10)), 18);

      const pendingOrdersAfterStart = pendingOrdersBeforeStart
        .filter(el => el.cancel === false)
        .map((order) => {
          const x = new bigDecimal(
            order.tokens
          ).multiply(order.isWhite ? whitePriceAfter : blackPriceAfter)
          const aFeeBD = x.multiply(fee).round();
          const collateralToSend = x.subtract(aFeeBD).round();

          return {
            "id": order.id,
            "account": order.account,
            "isWhite": order.isWhite,
            "withdrawAfterEvent": order.withdrawAfterEvent,
            "eventId2": order.eventId.toString(),
            "eventId": order.eventId,
            "amountBefore": order.amountBefore,
            "feeBefore": order.feeBefore,
            "feeAfter": aFeeBD.getValue(),
            "tokens": order.tokens,
            "amountAfter": collateralToSend.getValue(),
            "amountAfter2": collateralToSend.divide(new bigDecimal(BONE.toString(10)), 18).getValue(),
            "withdrawDone": order.withdrawDone,
          };
        })

      const x = ordersApplied
        .filter(el => el.cancel === false)
        .map((order) => {
        let tmpOrder = pendingOrdersAfterStart.filter(el => order.id === el.id)
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
      })

      let accountsSum = [...Array(accounts.length).keys()].map((el) => {
        return { account: el, sum: new BN("0"), needWD: false, gas: 0 }
      })

      let ordersToWithDraw = [];

      const thisIsLastEvent = eventsArray[eventsArray.length - 1].eventId.eq(event.eventId)

      if (thisIsLastEvent) {
        ordersToWithDraw = ordersApplied
          .filter(el => el.cancel === false)
          .filter(el => el.withdrawDone === false)
      } else {
        ordersToWithDraw = ordersApplied
          .filter(el => el.cancel === false)
          .filter(el => el.withdrawDone === false)
          .filter(el => event.eventId.eq(el.eventId))
          .filter(el => el.withdrawAfterEvent === true)
      }

      let withdraw = [];
      if (ordersToWithDraw.length > 0) {
        withdraw = ordersApplied
          .filter(el => el.cancel === false)
          .filter(el => event.eventId.gte(el.eventId))
          .filter(el => el.withdrawDone === false)
          .reduce((a, el) => {
            a[el.account].account = el.account
            a[el.account].sum = new BN(el.amountAfter).add(a[el.account].sum)

            const isNeedWD = ordersApplied
              .filter(el => el.cancel === false)
              .filter(order => order.account === el.account)
              .filter(order => event.eventId.eq(order.eventId))
              .filter(order => order.withdrawAfterEvent === true)
            if (isNeedWD.length > 0) {
              a[el.account].needWD = true
            }
            a[el.account].gas = 0;
            return a
          }, accountsSum)

        if (thisIsLastEvent) {
          withdraw.map((el) => {
            el.needWD = true;
          })
        }

        await Promise.all(
          withdraw.map(async (order) => {
            if (order.needWD) {
              ordersApplied
                .filter(el => el.cancel === false)
                .filter(el => el.withdrawDone === false)
                .filter(el => order.account === el.account)
                .filter(el => event.eventId.gte(el.eventId))
                .map(
                  (el) => {
                    el.withdrawDone = true;
                    return el
                  }
                )

              if (!order.sum.eq(new BN(0))) {
                const receipt = await withdrawAmount(accounts[order.account], order.sum.toString());
                order.gas = receipt.receipt.gasUsed;
                if (debug) console.log('\x1b[36m%s\x1b[0m', `Withdraw for account ${order.account}, sum: ${order.sum.toString()}, needWD: ${order.needWD}, GasUsed: ${order.gas} }`);
              }

            }
            return order;
          })
        )

        withdraw.map((el) => {
          if (debug) console.log('\x1b[36m%s\x1b[0m', `{ account: ${el.account}, sum: ${el.sum.toString()}, needWD: ${el.needWD}, gas: ${el.gas} }`);
        })
      }

      const withdrawDoneCount = thisIsLastEvent
        ? ordersApplied
          .filter(el => el.cancel === false)
          .filter(el => el.withdrawDone === true)
          .length
        : ordersApplied
          .filter(el => el.cancel === false)
          .filter(el => el.withdrawDone === true)
          .filter(el => event.eventId.eq(el.eventId))
          .length

      if (debug) console.log("withdrawDoneCount:", withdrawDoneCount);
      if (debug) console.log(
        '\x1b[33m%s%s with %s\x1b[33m %s\x1b[0m', "End event #", event.eventId.toString(), "result:", event.eventResult.toString()
      );
      if (debug) console.log('\x1b[31m%s\x1b[0m', "===========================================================");
    } // <=== for (let event of eventsArray)
  }

});


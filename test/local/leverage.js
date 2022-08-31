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

const { deployContracts, getLogs, mntob, ntob, BONE } = require('./../utils.js');

const debug = 0;

[
  "6",
  "18"
].forEach((decimals) => {
  const collateralTokenDecimals = decimals;
  const multiplier = 10 ** parseInt(collateralTokenDecimals);
  const collateralTokenSupply = mntob(1e13, multiplier);

  contract(`DEV: Leverage ${decimals} Decimals`, function (accounts) {
    "use strict";

    let deployedPredictionPool;
    let deployedEventLifeCycle;
    let deployedPendingOrders;
    let deployedCollateralToken;
    let deployedWhiteToken;
    let deployedBlackToken;
    let deployedPredictionCollateralization;
    let deployedLeverage;

    const deployerAddress = accounts[0];

    before(async () => {

    });

    beforeEach(async () => {
      const deployedContracts = await deployContracts(deployerAddress, collateralTokenDecimals);

      deployedPredictionPool = deployedContracts.deployedPredictionPool;
      deployedPredictionCollateralization = deployedContracts.deployedPredictionCollateralization;
      deployedEventLifeCycle = deployedContracts.deployedEventLifeCycle;
      deployedPendingOrders = deployedContracts.deployedPendingOrders;
      deployedCollateralToken = deployedContracts.deployedCollateralToken;
      deployedWhiteToken = deployedContracts.deployedWhiteToken;
      deployedBlackToken = deployedContracts.deployedBlackToken;
      deployedLeverage = deployedContracts.deployedLeverage;
    });

    afterEach(async () => {

    });

    it('check state variables', async function () {
      expect(await deployedLeverage.owner()).to.equal(deployerAddress);
      expect(await deployedLeverage._collateralToken()).to.equal(deployedCollateralToken.address);
      expect(await deployedLeverage._pendingOrders()).to.equal(deployedPendingOrders.address);
      expect(await deployedLeverage.getLpRatio()).to.be.bignumber.equal(ntob(1));
      expect(await deployedLeverage._maxUsageThreshold()).to.be.bignumber.equal(ntob(0.2));
    });

    it("calculate _lpRatio", async () => {
      expect(await deployedLeverage._collateralTokens()).to.be.bignumber.equal(ntob(0));
      expect(await deployedLeverage._lpTokens()).to.be.bignumber.equal(ntob(0));
      expect(await deployedLeverage.getLpRatio()).to.be.bignumber.equal(ntob(1));
      await deployedCollateralToken.transfer(deployedLeverage.address, mntob(20, multiplier), { from: deployerAddress })
      expect(await deployedLeverage.getLpRatio()).to.be.bignumber.equal(ntob(1));


      await expectRevert(
        deployedLeverage.addLiquidity(mntob(0, multiplier), { from: deployerAddress }), "TOKENS AMOUNT CANNOT BE 0"
      );
      await expectRevert(
        deployedLeverage.addLiquidity(mntob(20, multiplier), { from: deployerAddress }), "NOT ENOUGH COLLATERAL TOKENS ARE DELEGATED"
      );
      await deployedCollateralToken.approve(deployedLeverage.address, mntob(20, multiplier), { from: deployerAddress })
      await deployedLeverage.addLiquidity(mntob(20, multiplier), { from: deployerAddress })
      expect(await deployedLeverage.getLpRatio()).to.be.bignumber.equal(ntob(1));
      expect(await deployedLeverage._collateralTokens()).to.be.bignumber.equal(mntob(20, multiplier));
      expect(await deployedLeverage._lpTokens()).to.be.bignumber.equal(mntob(20, multiplier));


      await deployedLeverage.updateBalances(
        mntob(50, multiplier),
        mntob(10, multiplier),
        { from: deployerAddress }
      );

      const _collateralTokens = new bigDecimal(
        (await deployedLeverage._collateralTokens()).toString()
      );

      const _lpTokens = new bigDecimal(
        (await deployedLeverage._lpTokens()).toString()
      );

      const expectedLpRatio = _collateralTokens.divide(_lpTokens, 18)
        .multiply(new bigDecimal(BONE.toString(10)));

      expect(
        await deployedLeverage.getLpRatio()
      ).to.be.bignumber.equal(expectedLpRatio.getValue());

      await expectRevert(
        deployedLeverage.addLiquidity(
          mntob(1530, multiplier),
          { from: deployerAddress }
        ),
        "NOT ENOUGH COLLATERAL TOKENS ARE DELEGATED"
      );

      await deployedCollateralToken.approve(
        deployedLeverage.address,
        mntob(1530, multiplier),
        { from: deployerAddress }
      )

      await deployedLeverage.addLiquidity(
        mntob(1530, multiplier),
        { from: deployerAddress }
      );

      const expectedLpTokens = _lpTokens.add(
        new bigDecimal(mntob(1530, multiplier).toString())
          .divide(expectedLpRatio, 18)
          .multiply(new bigDecimal(BONE.toString(10)))
      );

      expect(
        await deployedLeverage._collateralTokens()
      ).to.be.bignumber.equal(mntob(1600, multiplier));

      expect(
        await deployedLeverage._lpTokens()
      ).to.be.bignumber.equal(expectedLpTokens.getValue());
    });

    const leverageCreateOrder = async (user, collateralAmount, isWhite, maxLoss, eventId) => {
      await deployedCollateralToken.transfer(user, collateralAmount, { from: deployerAddress });

      await deployedCollateralToken.approve(deployedLeverage.address, collateralAmount, { from: user });

      const order = await deployedLeverage.createOrder(
        collateralAmount,     // uint256 amount
        isWhite,              // bool isWhite,
        maxLoss,              // uint256 maxLoss,
        eventId,              // uint256 eventId
        { from: user }
      )

      const { logs: orderLog } = order;
      const eventCount = 3;
      assert.equal(orderLog.length, eventCount, `triggers must be ${eventCount} event`);

      expectEvent.inLogs(orderLog, 'Transfer', {
        from: user,
        to: deployedLeverage.address,
        value: collateralAmount
      });

      expectEvent.inLogs(orderLog, 'Approval', {
        owner: user,
        spender: deployedLeverage.address
      });

      const _priceChangePart = await deployedLeverage._priceChangePart();

      expectEvent.inLogs(orderLog, 'OrderCreated', {
        user: user,
        maxLoss: maxLoss,
        priceChangePart: _priceChangePart,
        ownAmount: collateralAmount
      });
    }

    it("Leverage createOrder", async () => {

      const eventDuration = time.duration.seconds(5);

      await addLiquidityToPrediction(50000);
      await deployedEventLifeCycle.setLeverage(deployedLeverage.address, true);

      const user = accounts[4];

      const collateralAmount = mntob(20, multiplier);
      const maxLossUserDefined = ntob(0.25);
      const userSelectedEventId = new BN("100");

      const liquidityAmount = mntob(2000, multiplier);


      if (debug) console.log("collateralAmount:  ", collateralAmount.toString())
      if (debug) console.log("maxLossUserDefined:", maxLossUserDefined.toString())
      if (debug) console.log("liquidityAmount:   ", liquidityAmount.toString())

      await expectRevert(
        deployedLeverage.createOrder(
          collateralAmount,     // uint256 amount
          true,                 // bool isWhite,
          ntob(25),             // uint256 maxLoss,
          userSelectedEventId,  // uint256 eventId
        ), "MAX LOSS PERCENT IS VERY BIG"
      );

      await deployedEventLifeCycle.addNewEvent(
        new BN("50000000000000000"),  // uint256 priceChangePart,
        new BN("1800"),               // uint256 eventStartTimeExpected,
        new BN("1800"),               // uint256 eventEndTimeExpected,
        'BNB-DOWN',                   // string calldata blackTeam,
        'BNB-UP',                     // string calldata whiteTeam,
        'Crypto',                     // string calldata eventType,
        'BNB-USDT',                   // string calldata eventSeries,
        'BNB-USDT',                   // string calldata eventName,
        userSelectedEventId           // uint256 eventId
      )

      const queuedEvent = await deployedEventLifeCycle._queuedEvent();

      expect(queuedEvent.priceChangePart).to.be.bignumber.equal(new BN("50000000000000000"));
      expect(queuedEvent.eventStartTimeExpected).to.be.bignumber.equal(new BN("1800"));
      expect(queuedEvent.eventEndTimeExpected).to.be.bignumber.equal(new BN("1800"));
      expect(queuedEvent.blackTeam).to.be.equals('BNB-DOWN');
      expect(queuedEvent.whiteTeam).to.be.equals('BNB-UP');
      expect(queuedEvent.eventType).to.be.equals('Crypto');
      expect(queuedEvent.eventSeries).to.be.equals('BNB-USDT');
      expect(queuedEvent.eventName).to.be.equals('BNB-USDT');
      expect(queuedEvent.eventId).to.be.bignumber.equal(userSelectedEventId);

      await expectRevert(
        deployedLeverage.createOrder(
          collateralAmount,     // uint256 amount
          true,                 // bool isWhite,
          maxLossUserDefined,   // uint256 maxLoss,
          userSelectedEventId,  // uint256 eventId
          { from: user }
        ), "NOT ENOUGH COLLATERAL IN USER ACCOUNT"
      );

      expect(await deployedCollateralToken.balanceOf(user)).to.be.bignumber.equal(new BN("0"));

      await deployedCollateralToken.transfer(user, collateralAmount, { from: deployerAddress })

      expect(await deployedCollateralToken.balanceOf(user)).to.be.bignumber.equal(collateralAmount);

      await expectRevert(
        deployedLeverage.createOrder(
          collateralAmount,     // uint256 amount
          true,                 // bool isWhite,
          maxLossUserDefined,   // uint256 maxLoss,
          userSelectedEventId,  // uint256 eventId
          { from: user }
        ), "NOT ENOUGHT DELEGATED TOKENS"
      );

      await deployedCollateralToken.approve(deployedLeverage.address, collateralAmount, { from: user })

      expect(
        await deployedCollateralToken.balanceOf(deployedLeverage.address)
      ).to.be.bignumber.equal(new BN("0"));

      await deployedCollateralToken.approve(deployedLeverage.address, liquidityAmount, { from: deployerAddress })

      await expectRevert(
        deployedLeverage.createOrder(
          collateralAmount,     // uint256 amount
          true,                 // bool isWhite,
          maxLossUserDefined,   // uint256 maxLoss,
          userSelectedEventId,  // uint256 eventId
          { from: user }
        ), "NOT ENOUGH COLLATERAL BALANCE FOR BORROW"
      );

      await deployedLeverage.addLiquidity(liquidityAmount, { from: deployerAddress })

      expect(
        await deployedCollateralToken.balanceOf(deployedLeverage.address)
      ).to.be.bignumber.equal(liquidityAmount);

      await deployedLeverage.createOrder(
        collateralAmount,     // uint256 amount
        true,                 // bool isWhite,
        maxLossUserDefined,   // uint256 maxLoss,
        userSelectedEventId,  // uint256 eventId
        { from: user }
      )

      const firstOrder = getLogs(await deployedLeverage._orders(0));

      expect(firstOrder.orderer).to.be.equals(user);
      expect(firstOrder.cross).to.be.bignumber.equal('5000000000000000000');
      expect(firstOrder.ownAmount).to.be.bignumber.equal(mntob(20, multiplier));
      expect(firstOrder.borrowedAmount).to.be.bignumber.equal(mntob(80, multiplier));
      expect(firstOrder.isWhite).to.be.equals(true);
      expect(firstOrder.eventId).to.be.bignumber.equal(userSelectedEventId);

      if (debug) console.log("firstOrder:", firstOrder);
      if (debug) console.log("_orders(0):", getLogs(await deployedLeverage._orders(0)))

      if (debug) console.log("_ordersOfUser:", getLogs(await deployedLeverage._ordersOfUser(user, 0)))

      expect((await deployedPendingOrders.ordersOfUser(deployedLeverage.address)).length).to.be.equals(0);

      await expectRevert(
        deployedLeverage.cancelOrder(0),
        "NOT YOUR ORDER"
      );

      const cancelOrder = await deployedLeverage.cancelOrder(0, { from: user });

      const { logs: cancelOrderLog } = cancelOrder;
      const eventCount = 2;
      assert.equal(cancelOrderLog.length, eventCount, `triggers must be ${eventCount} event`);
      expectEvent.inLogs(cancelOrderLog, 'Transfer', {
        from: deployedLeverage.address,
        to: user,
        value: collateralAmount
      });

      expectEvent.inLogs(cancelOrderLog, 'OrderCanceled', {
        id: '0',
        user: user
      });

      expect(
        await deployedCollateralToken.balanceOf(deployedLeverage.address)
      ).to.be.bignumber.equal(liquidityAmount);

      if (debug) console.log("balanceOf only liquidity:", ( await deployedCollateralToken.balanceOf(deployedLeverage.address)).toString())

      await addAndStartEvent(
        userSelectedEventId,
        time.duration.seconds(5),
        new BN("50000000000000000")
      );

      await time.increase(eventDuration);

      await deployedEventLifeCycle.endEvent(
        new BN("0")
      );

      await deployedLeverage.withdrawCollateral(accounts[4]);

      const events = [
        { id: "102", priceChangePart: '50000000000000000', duration: 5, result: '1' },
        { id: "103", priceChangePart: '50000000000000000', duration: 15, result: '0' },
        { id: "104", priceChangePart: '50000000000000000', duration: 25, result: '-1' },
        { id: "105", priceChangePart: '50000000000000000', duration: 35, result: '1' }
      ]

      const orders = [                                                                                // ifWhiteWin | ifBlackWin
        { user: 1, ownAmount: 160, isWhite: false, maxLoss: 0.13, eventId: '102' }, // 2,6 -- 416     - 139,2       |
        { user: 1, ownAmount: 22,  isWhite: true,  maxLoss: 0.24, eventId: '102' }, // 4,8 -- 105,6   -
        { user: 3, ownAmount: 100, isWhite: false, maxLoss: 0.37, eventId: '102' }, // 7,4 -- 740     - 63          |
        { user: 4, ownAmount: 56,  isWhite: true,  maxLoss: 0.42, eventId: '102' }, // 8,4 -- 470,4   -
        { user: 4, ownAmount: 55,  isWhite: false, maxLoss: 0.11, eventId: '102' }, // 2,2 -- 121     - 48,95       |
        { user: 5, ownAmount: 34,  isWhite: true,  maxLoss: 0.09, eventId: '102' }, // 1,8 -- 61,2    -

        { user: 4, ownAmount: 34,  isWhite: true,  maxLoss: 0.09, eventId: '103' }, // 1,8 -- 61,2
        { user: 3, ownAmount: 340, isWhite: false, maxLoss: 0.09, eventId: '104' }, // 1,8 -- 612
      ]

      const nowEvent = events[0];

      const currentOrders = orders.filter(el => el.eventId === nowEvent.id)

      const ownAmountSum = currentOrders
        .map((el) => { return mntob(el.ownAmount, multiplier); })
        .reduce((prev, curr) => prev.add(curr), new BN('0'));

      if (debug) console.log(`ownAmountSum  :`, ownAmountSum.toString())

      const calcTotal = (el) => {
        const maxLossBD = new bigDecimal(el.maxLoss.toString(10)).multiply(new bigDecimal(BONE.toString(10)));
        const crossBD = maxLossBD.divide(new bigDecimal(nowEvent.priceChangePart), 18)
        const ownAmountBD = new bigDecimal(mntob(el.ownAmount, multiplier).toString());
        const totalAmountBD = ownAmountBD.multiply(crossBD);
        el.borrowedAmount = new BN(totalAmountBD.subtract(ownAmountBD).getValue());
        el.total = new BN(totalAmountBD.getValue());
        return el;
      }

      const totalAmountSum = currentOrders
        .map(calcTotal)
        .reduce((prev, curr) => prev.add(curr.total), new BN('0'));

      const crossAmountSum = totalAmountSum.sub(ownAmountSum);

      if (debug) console.log(`totalAmountSum:`, totalAmountSum.toString())
      if (debug) console.log(`crossAmountSum:`, crossAmountSum.toString())


      for (const i of [...Array(currentOrders.length).keys()]) {
        await leverageCreateOrder(
          accounts[currentOrders[i].user],                // user
          mntob(currentOrders[i].ownAmount, multiplier),  // collateralAmount
          currentOrders[i].isWhite,                       // isWhite
          ntob(currentOrders[i].maxLoss),                 // maxLoss
          currentOrders[i].eventId                        // eventId
        );
      }

      expect(
        await deployedCollateralToken.balanceOf(deployedLeverage.address)
      ).to.be.bignumber.equal(ownAmountSum.add(liquidityAmount));

      if (debug) console.log("balanceOf after post orders:", ( await deployedCollateralToken.balanceOf(deployedLeverage.address)).toString())

      const pendingOrdersCountOfLeverageBeforeStart = await deployedPendingOrders.ordersOfUser(deployedLeverage.address);

      if (debug) console.log("ordersOfLeverageBeforeStart:", pendingOrdersCountOfLeverageBeforeStart)

      expect(pendingOrdersCountOfLeverageBeforeStart.length).to.equal(0);

      if (debug) console.log("_events:", getLogs(await deployedLeverage._events(nowEvent.id)))

      await expectRevert(
        addAndStartEvent(
          nowEvent.id,
          time.duration.seconds(nowEvent.duration),
          ntob(0.03)
        ),
        "WRONG PRICE CHANGE PART"
      );

      await addAndStartEvent(
        nowEvent.id,
        time.duration.seconds(nowEvent.duration),
        nowEvent.priceChangePart
      );

      await expectRevert(
        deployedLeverage.cancelOrder(1),
        "NOT YOUR ORDER"
      );

      await expectRevert(
        deployedLeverage.cancelOrder(1, { from: accounts[1]}),
        "EVENT IN PROGRESS"
      );

      const pendingOrdersCountOfLeverageAfterStart = await deployedPendingOrders.ordersOfUser(deployedLeverage.address);

      if (debug) console.log(
        "ordersOfLeverageAfterStart:",
        pendingOrdersCountOfLeverageAfterStart.map((el) => { return el.toString()})
      )
      expect(pendingOrdersCountOfLeverageAfterStart.length).to.equal(2);

      expect(
        await deployedCollateralToken.balanceOf(deployedLeverage.address)
      ).to.be.bignumber.equal(
        ownAmountSum.add(liquidityAmount).sub(totalAmountSum)
      );

      expect(
        await deployedCollateralToken.balanceOf(deployedLeverage.address)
      ).to.be.bignumber.equal(liquidityAmount.sub(crossAmountSum));

      if (debug) console.log("balanceOf after start event:", (await deployedCollateralToken.balanceOf(deployedLeverage.address)).toString())

      await time.increase(eventDuration);

      const endEvent = await deployedEventLifeCycle.endEvent(
        nowEvent.result
      );

      if (debug) console.log("_events:", (await deployedLeverage._events(nowEvent.id)).orders)
      if (debug) console.log("_events:", getLogs(await deployedLeverage._events(nowEvent.id)))

      if (debug) console.log("balanceOf:", ( await deployedCollateralToken.balanceOf(deployedLeverage.address)).toString())

      if (debug) console.log("_whitePrice:", ( await deployedPredictionPool._whitePrice()).toString())
      if (debug) console.log("_blackPrice:", ( await deployedPredictionPool._blackPrice()).toString())

      const resultAmountSum = currentOrders
        .map(calcTotal)
        .reduce(
          (prev, curr) => prev.add(curr.total), new BN('0')
        );

      if (debug) console.log("resultAmountSum:", resultAmountSum.toString())

      const resultAmountSumBlack = currentOrders
        .filter(el => el.isWhite === false)
        .map(calcTotal)
        .reduce((prev, curr) => prev.add(curr.total), new BN('0'));

      const resultAmountSumWhite = currentOrders
        .filter(el => el.isWhite === true)
        .map(calcTotal)
        .reduce(
          (prev, curr) => prev.add(curr.total), new BN('0')
        );

      const eventInfo = await deployedLeverage._events(nowEvent.id);
      if (debug) console.log("resultAmountSumBlack:", resultAmountSumBlack.toString())
      if (debug) console.log("resultAmountSumWhite:", resultAmountSumWhite.toString())
      if (debug) console.log("balanceOf after end event  :", (await deployedCollateralToken.balanceOf(deployedLeverage.address)).toString())
      if (debug) console.log("_events:", getLogs(eventInfo))

      expect(eventInfo.blackCollateralAmount).to.be.bignumber.equal(resultAmountSumBlack);
      expect(eventInfo.whiteCollateralAmount).to.be.bignumber.equal(resultAmountSumWhite);

      // ? resultAmountSum


      const fee = new bigDecimal(
        (await deployedPredictionPool.FEE()).toString())
          .divide(new bigDecimal(BONE.toString(10)), 18);

      const whitePriceBefore = new bigDecimal(eventInfo.whitePriceBefore.toString())
          .divide(new bigDecimal(BONE.toString(10)), 18);
      const blackPriceBefore = new bigDecimal(eventInfo.blackPriceBefore.toString())
        .divide(new bigDecimal(BONE.toString(10)), 18);

      const whitePriceAfter = new bigDecimal(eventInfo.whitePriceAfter.toString())
          .divide(new bigDecimal(BONE.toString(10)), 18);
      const blackPriceAfter = new bigDecimal(eventInfo.blackPriceAfter.toString())
        .divide(new bigDecimal(BONE.toString(10)), 18);

      const xxx = (el) => {
        const amountBDb = new bigDecimal(el.total);
        const f = amountBDb.multiply(fee);
        const a = amountBDb.subtract(f);
        const n1 = a.divide(el.isWhite ? whitePriceBefore : blackPriceBefore, 18).round();
        const x = n1.multiply(el.isWhite ? whitePriceAfter : blackPriceAfter)
        const aFeeBD = x.multiply(fee).round();
        const collateralToSend = x.subtract(aFeeBD).round();
        el.collateralToSend = new BN(collateralToSend.getValue());
        return el;
      }

      const tmpUsers = currentOrders
        .map((el) => {
          return el.user;
        })
      const users = tmpUsers.filter(function(item, pos) {
        return tmpUsers.indexOf(item) == pos;
      })

      if (debug) console.log("users:", users);

      const withdraw = async (account) => {

        if (debug) console.log("account :", account);
        if (debug) console.log("currentOrders :", currentOrders.filter(el => el.user === account));

        const expectedWithdrawAmountByUser = currentOrders
          .filter(el => el.user === account)
          .map(calcTotal)
          .map(xxx)
          .reduce(
            (prev, curr) => prev.add(curr.collateralToSend.sub(curr.borrowedAmount)), new BN('0')
          );
        if (debug) console.log("expectedWithdrawAmountByUser :", expectedWithdrawAmountByUser.toString());

        const userBalanceBeforeWithdraw = await deployedCollateralToken.balanceOf(accounts[account]);

        if (debug) console.log("balanceOf before withdraw  :", account, userBalanceBeforeWithdraw.toString());

        if (debug) console.log("balanceOf before withdraw  :", (await deployedCollateralToken.balanceOf(deployedLeverage.address)).toString())

        const resWithdrawCollateral = await deployedLeverage.withdrawCollateral(accounts[account]);

        const { logs: resWithdrawCollateralLog } = resWithdrawCollateral;
        const withdrawEventCount = 2;
        assert.equal(
          resWithdrawCollateralLog.length,
          withdrawEventCount,
          `triggers must be ${withdrawEventCount} event`
        );

        expectEvent.inLogs(resWithdrawCollateralLog, 'CollateralWithdrew', {
          amount: expectedWithdrawAmountByUser, /* Temporary disabled */
          user: accounts[account],
          caller: deployerAddress
        });

        expectEvent.inLogs(resWithdrawCollateralLog, 'Transfer', {
          from: deployedLeverage.address,
          to: accounts[account],
          value: expectedWithdrawAmountByUser /* Temporary disabled */
        });

        const userBalanceAfterWithdraw = await deployedCollateralToken.balanceOf(accounts[account]);
        expect(userBalanceAfterWithdraw).to.be.bignumber.equal(
          userBalanceBeforeWithdraw.add(expectedWithdrawAmountByUser)
        );
        if (debug) console.log("balanceOf after withdraw   :", (await deployedCollateralToken.balanceOf(deployedLeverage.address)).toString())
        if (debug) console.log("balanceOf after withdraw   :", account, userBalanceAfterWithdraw.toString())
      }

      for (let user of users) {
        if (debug) console.log("user:", user, accounts[user]);
        await withdraw(user);
      }

      await expectRevert(
        deployedLeverage.withdrawCollateral(accounts[0]),
        "ACCOUNT HAS NO ORDERS"
      );

      if (debug) console.log("balanceOf after all done   :", (await deployedCollateralToken.balanceOf(deployedLeverage.address)).toString())

      const _ordersCounter = await deployedLeverage._ordersCounter();
      if (debug) console.log("_ordersCounter:", _ordersCounter.toNumber());
      for (let orderId of [...Array(_ordersCounter.toNumber()).keys()]) {
        const order = await deployedLeverage._orders(orderId);
        if (debug) console.log("_orders:", getLogs(order));
        expect(order.orderer).to.equal('0x0000000000000000000000000000000000000000');
        expect(order.cross).to.be.bignumber.equal(new BN("0"));
        expect(order.ownAmount).to.be.bignumber.equal(new BN("0"));
        expect(order.borrowedAmount).to.be.bignumber.equal(new BN("0"));
        expect(order.isWhite).to.equal(false);
        expect(order.eventId).to.be.bignumber.equal(new BN("0"));
        expect(order.isCanceled).to.equal(false);

      }

      const _eventsById = await deployedLeverage._events(nowEvent.id);
      if (debug) console.log("_eventsById:", _eventsById);
      if (debug) console.log("_eventsById:", _eventsById.crossOrdersOfUser);
    });

    it("Leverage createOrder, more orders and amounts", async () => {

      const eventDuration = time.duration.seconds(5);

      await addLiquidityToPrediction(50000);
      await deployedEventLifeCycle.setLeverage(deployedLeverage.address, true);

      const user = accounts[4];

      const collateralAmount = mntob(20, multiplier);
      const maxLossUserDefined = ntob(0.25);
      const userSelectedEventId = new BN("100");

      const liquidityAmount = mntob(50000, multiplier);


      if (debug) console.log("collateralAmount:  ", collateralAmount.toString())
      if (debug) console.log("maxLossUserDefined:", maxLossUserDefined.toString())
      if (debug) console.log("liquidityAmount:   ", liquidityAmount.toString())

      await expectRevert(
        deployedLeverage.createOrder(
          collateralAmount,     // uint256 amount
          true,                 // bool isWhite,
          ntob(25),             // uint256 maxLoss,
          userSelectedEventId,  // uint256 eventId
        ), "MAX LOSS PERCENT IS VERY BIG"
      );

      await deployedEventLifeCycle.addNewEvent(
        new BN("50000000000000000"),  // uint256 priceChangePart,
        new BN("1800"),               // uint256 eventStartTimeExpected,
        new BN("1800"),               // uint256 eventEndTimeExpected,
        'BNB-DOWN',                   // string calldata blackTeam,
        'BNB-UP',                     // string calldata whiteTeam,
        'Crypto',                     // string calldata eventType,
        'BNB-USDT',                   // string calldata eventSeries,
        'BNB-USDT',                   // string calldata eventName,
        userSelectedEventId           // uint256 eventId
      )

      const queuedEvent = await deployedEventLifeCycle._queuedEvent();

      expect(queuedEvent.priceChangePart).to.be.bignumber.equal(new BN("50000000000000000"));
      expect(queuedEvent.eventStartTimeExpected).to.be.bignumber.equal(new BN("1800"));
      expect(queuedEvent.eventEndTimeExpected).to.be.bignumber.equal(new BN("1800"));
      expect(queuedEvent.blackTeam).to.be.equals('BNB-DOWN');
      expect(queuedEvent.whiteTeam).to.be.equals('BNB-UP');
      expect(queuedEvent.eventType).to.be.equals('Crypto');
      expect(queuedEvent.eventSeries).to.be.equals('BNB-USDT');
      expect(queuedEvent.eventName).to.be.equals('BNB-USDT');
      expect(queuedEvent.eventId).to.be.bignumber.equal(userSelectedEventId);

      await expectRevert(
        deployedLeverage.createOrder(
          collateralAmount,     // uint256 amount
          true,                 // bool isWhite,
          maxLossUserDefined,   // uint256 maxLoss,
          userSelectedEventId,  // uint256 eventId
          { from: user }
        ), "NOT ENOUGH COLLATERAL IN USER ACCOUNT"
      );

      expect(await deployedCollateralToken.balanceOf(user)).to.be.bignumber.equal(new BN("0"));

      await deployedCollateralToken.transfer(user, collateralAmount, { from: deployerAddress })

      expect(await deployedCollateralToken.balanceOf(user)).to.be.bignumber.equal(collateralAmount);

      await expectRevert(
        deployedLeverage.createOrder(
          collateralAmount,     // uint256 amount
          true,                 // bool isWhite,
          maxLossUserDefined,   // uint256 maxLoss,
          userSelectedEventId,  // uint256 eventId
          { from: user }
        ), "NOT ENOUGHT DELEGATED TOKENS"
      );

      await deployedCollateralToken.approve(deployedLeverage.address, collateralAmount, { from: user })

      expect(
        await deployedCollateralToken.balanceOf(deployedLeverage.address)
      ).to.be.bignumber.equal(new BN("0"));

      await deployedCollateralToken.approve(deployedLeverage.address, liquidityAmount, { from: deployerAddress })

      await expectRevert(
        deployedLeverage.createOrder(
          collateralAmount,     // uint256 amount
          true,                 // bool isWhite,
          maxLossUserDefined,   // uint256 maxLoss,
          userSelectedEventId,  // uint256 eventId
          { from: user }
        ), "NOT ENOUGH COLLATERAL BALANCE FOR BORROW"
      );

      await deployedLeverage.addLiquidity(liquidityAmount, { from: deployerAddress })

      expect(
        await deployedCollateralToken.balanceOf(deployedLeverage.address)
      ).to.be.bignumber.equal(liquidityAmount);

      await deployedLeverage.createOrder(
        collateralAmount,     // uint256 amount
        true,                 // bool isWhite,
        maxLossUserDefined,   // uint256 maxLoss,
        userSelectedEventId,  // uint256 eventId
        { from: user }
      )

      const firstOrder = getLogs(await deployedLeverage._orders(0));

      expect(firstOrder.orderer).to.be.equals(user);
      expect(firstOrder.cross).to.be.bignumber.equal('5000000000000000000');
      expect(firstOrder.ownAmount).to.be.bignumber.equal(mntob(20, multiplier));
      expect(firstOrder.borrowedAmount).to.be.bignumber.equal(mntob(80, multiplier));
      expect(firstOrder.isWhite).to.be.equals(true);
      expect(firstOrder.eventId).to.be.bignumber.equal(userSelectedEventId);

      if (debug) console.log("firstOrder:", firstOrder);
      if (debug) console.log("_orders:", getLogs(await deployedLeverage._orders(0)))

      if (debug) console.log("_ordersOfUser:", getLogs(await deployedLeverage._ordersOfUser(user, 0)))

      expect((await deployedPendingOrders.ordersOfUser(deployedLeverage.address)).length).to.be.equals(0);

      await expectRevert(
        deployedLeverage.cancelOrder(0),
        "NOT YOUR ORDER"
      );

      const cancelOrder = await deployedLeverage.cancelOrder(0, { from: user });

      const { logs: cancelOrderLog } = cancelOrder;
      const eventCount = 2;
      assert.equal(cancelOrderLog.length, eventCount, `triggers must be ${eventCount} event`);
      expectEvent.inLogs(cancelOrderLog, 'Transfer', {
        from: deployedLeverage.address,
        to: user,
        value: collateralAmount
      });

      expectEvent.inLogs(cancelOrderLog, 'OrderCanceled', {
        id: '0',
        user: user
      });

      expect(
        await deployedCollateralToken.balanceOf(deployedLeverage.address)
      ).to.be.bignumber.equal(liquidityAmount);

      if (debug) console.log("balanceOf only liquidity:", ( await deployedCollateralToken.balanceOf(deployedLeverage.address)).toString())

      await addAndStartEvent(
        userSelectedEventId,
        time.duration.seconds(5),
        new BN("50000000000000000")
      );

      await time.increase(eventDuration);

      await deployedEventLifeCycle.endEvent(
        new BN("0")
      );

      await deployedLeverage.withdrawCollateral(accounts[4]);

      const firstOrderAfterCancel = getLogs(await deployedLeverage._orders(0));
      if (debug) console.log("firstOrderAfterCancel:", firstOrderAfterCancel);

      const events = [
        { id: "101", priceChangePart: '50000000000000000', duration: 5, result: '1' },
        { id: "102", priceChangePart: '50000000000000000', duration: 5, result: '1' },
        { id: "103", priceChangePart: '50000000000000000', duration: 15, result: '0' },
        { id: "104", priceChangePart: '50000000000000000', duration: 25, result: '1' },
        { id: "105", priceChangePart: '50000000000000000', duration: 35, result: '-1' },
        { id: "106", priceChangePart: '50000000000000000', duration: 35, result: '-1' },
        { id: "107", priceChangePart: '50000000000000000', duration: 35, result: '0' }
      ]

      const orders = [
        { user: 1, ownAmount: 100,  isWhite: true,  maxLoss: 0.13, eventId: '102', cancel: false },
        { user: 1, ownAmount: 1253, isWhite: false, maxLoss: 0.24, eventId: '102', cancel: false },
        { user: 1, ownAmount: 1253, isWhite: true,  maxLoss: 0.37, eventId: '102', cancel: false },
        { user: 1, ownAmount: 273,  isWhite: true,  maxLoss: 0.42, eventId: '102', cancel: false },
        { user: 1, ownAmount: 332,  isWhite: true,  maxLoss: 0.11, eventId: '102', cancel: false },
        { user: 1, ownAmount: 14,   isWhite: false, maxLoss: 0.09, eventId: '102', cancel: false },
        { user: 1, ownAmount: 2730, isWhite: false, maxLoss: 0.09, eventId: '103', cancel: false },
        { user: 1, ownAmount: 1253, isWhite: true,  maxLoss: 0.09, eventId: '104', cancel: false },
        { user: 1, ownAmount: 2795, isWhite: false, maxLoss: 0.09, eventId: '104', cancel: false },
      ]

      for (let event = 0; event < events.length; event++) {
        const nowEvent = events[event];
        if (debug) console.log(`Let processing event #${nowEvent.id}:`);

        const duration = time.duration.seconds(nowEvent.duration);

        const eventStartExpected = await time.latest();
        const eventEndExpected = eventStartExpected.add(duration);
        await deployedEventLifeCycle.addNewEvent(
          nowEvent.priceChangePart,   // uint256 priceChangePart,
          eventStartExpected,         // uint256 eventStartTimeExpected,
          eventEndExpected,           // uint256 eventEndTimeExpected,
          'BNB-DOWN',                 // string calldata blackTeam,
          'BNB-UP',                   // string calldata whiteTeam,
          'Crypto',                   // string calldata eventType,
          'BNB-USDT',                 // string calldata eventSeries,
          'BNB-USDT',                 // string calldata eventName,
          nowEvent.id                 // uint256 eventId
        );

        const currentOrders = orders.filter(el => el.eventId === nowEvent.id);

        const blackOrders = currentOrders.filter(el => el.isWhite === false);
        const whiteOrders = currentOrders.filter(el => el.isWhite === true);

        if (debug) console.log(`blackOrders  :`, blackOrders.length)
        if (debug) console.log(`whiteOrders  :`, whiteOrders.length)

        const ownAmountSum = currentOrders
          .map((el) => { return mntob(el.ownAmount, multiplier); })
          .reduce((prev, curr) => prev.add(curr), new BN('0'));

        if (debug) console.log(`ownAmountSum  :`, ownAmountSum.toString())

        const calcTotal = (el) => {
          const maxLossBD = new bigDecimal(el.maxLoss.toString(10)).multiply(new bigDecimal(BONE.toString(10)));
          const crossBD = maxLossBD.divide(new bigDecimal(nowEvent.priceChangePart), 18)
          const ownAmountBD = new bigDecimal(mntob(el.ownAmount, multiplier).toString());
          const totalAmountBD = ownAmountBD.multiply(crossBD);
          el.borrowedAmount = new BN(totalAmountBD.subtract(ownAmountBD).getValue());
          el.total = new BN(totalAmountBD.getValue());
          return el;
        }

        const totalAmountSum = currentOrders
          .map(calcTotal)
          .reduce((prev, curr) => prev.add(curr.total), new BN('0'));

        const crossAmountSum = totalAmountSum.sub(ownAmountSum);

        if (debug) console.log(`totalAmountSum:`, totalAmountSum.toString())
        if (debug) console.log(`crossAmountSum:`, crossAmountSum.toString())

        const levBalanceBeforeOrders = await deployedCollateralToken.balanceOf(deployedLeverage.address);
        if (debug) console.log(`levBalanceBeforeOrders:`, levBalanceBeforeOrders.toString())

        for (let i of [...Array(currentOrders.length).keys()]) {
          await leverageCreateOrder(
            accounts[currentOrders[i].user],                // user
            mntob(currentOrders[i].ownAmount, multiplier),  // collateralAmount
            currentOrders[i].isWhite,                       // isWhite
            ntob(currentOrders[i].maxLoss),                 // maxLoss
            currentOrders[i].eventId                        // eventId
          );
        }

        const levBalanceAfterOrders = await deployedCollateralToken.balanceOf(deployedLeverage.address);
        if (debug) console.log(`levBalanceAfterOrders: `, levBalanceAfterOrders.toString())
        expect(
          await deployedCollateralToken.balanceOf(deployedLeverage.address)
        ).to.be.bignumber.equal(
          levBalanceBeforeOrders.add(ownAmountSum)
        );

        if (debug) console.log("balanceOf after post orders:", levBalanceAfterOrders.toString())

        const pendingOrdersCountOfLeverageBeforeStart = await deployedPendingOrders.ordersOfUser(deployedLeverage.address);

        if (debug) console.log("ordersOfLeverageBeforeStart:", pendingOrdersCountOfLeverageBeforeStart)

        expect(pendingOrdersCountOfLeverageBeforeStart.length).to.equal(0);

        if (debug) console.log("_events:", getLogs(await deployedLeverage._events(nowEvent.id)))

        await expectRevert(
          addAndStartEvent(
            nowEvent.id,
            time.duration.seconds(nowEvent.duration),
            ntob(0.03)
          ),
          "WRONG PRICE CHANGE PART"
        );

        await addAndStartEvent(
          nowEvent.id,
          time.duration.seconds(nowEvent.duration),
          nowEvent.priceChangePart
        );

        const pendingOrdersCountOfLeverageAfterStart = await deployedPendingOrders.ordersOfUser(deployedLeverage.address);

        if (debug) console.log(
          "ordersOfLeverageAfterStart:",
          pendingOrdersCountOfLeverageAfterStart.map((el) => { return el.toString()})
        )

        expect(pendingOrdersCountOfLeverageAfterStart.length).to.equal(
          (blackOrders.length > 0 ? 1 : 0) + (whiteOrders.length > 0 ? 1 : 0)
        );

        if (debug) console.log(`levBalanceAfterStart:  `, (await deployedCollateralToken.balanceOf(deployedLeverage.address)).toString())
        if (debug) console.log(`levBalanceAfterStart:  `, (levBalanceAfterOrders.sub(totalAmountSum)).toString())

        expect(
          await deployedCollateralToken.balanceOf(deployedLeverage.address)
        ).to.be.bignumber.equal(
          levBalanceAfterOrders.sub(totalAmountSum)
        );

        if (debug) console.log("balanceOf after start event:", (await deployedCollateralToken.balanceOf(deployedLeverage.address)).toString())

        await time.increase(eventDuration);

        const endEvent = await deployedEventLifeCycle.endEvent(
          new BN(nowEvent.result)
        );

        if (debug) console.log("_events:", (await deployedLeverage._events(nowEvent.id)).orders)
        if (debug) console.log("_events:", getLogs(await deployedLeverage._events(nowEvent.id)))

        if (debug) console.log("balanceOf:", ( await deployedCollateralToken.balanceOf(deployedLeverage.address)).toString())

        if (debug) console.log("_whitePrice:", ( await deployedPredictionPool._whitePrice()).toString())
        if (debug) console.log("_blackPrice:", ( await deployedPredictionPool._blackPrice()).toString())

        const resultAmountSum = currentOrders
          .map(calcTotal)
          .reduce(
            (prev, curr) => prev.add(curr.total), new BN('0')
          );

        if (debug) console.log("resultAmountSum:", resultAmountSum.toString())

        const resultAmountSumBlack = currentOrders
          .filter(el => el.isWhite === false)
          .map(calcTotal)
          .reduce((prev, curr) => prev.add(curr.total), new BN('0'));

        const resultAmountSumWhite = currentOrders
          .filter(el => el.isWhite === true)
          .map(calcTotal)
          .reduce(
            (prev, curr) => prev.add(curr.total), new BN('0')
          );

        const eventInfo = await deployedLeverage._events(nowEvent.id);
        if (debug) console.log("resultAmountSumBlack:", resultAmountSumBlack.toString())
        if (debug) console.log("resultAmountSumWhite:", resultAmountSumWhite.toString())
        if (debug) console.log("balanceOf after end event  :", (await deployedCollateralToken.balanceOf(deployedLeverage.address)).toString())
        if (debug) console.log("_events:", getLogs(eventInfo))

        expect(eventInfo.blackCollateralAmount).to.be.bignumber.equal(resultAmountSumBlack);
        expect(eventInfo.whiteCollateralAmount).to.be.bignumber.equal(resultAmountSumWhite);

        // ? resultAmountSum


        const fee = new bigDecimal(
          (await deployedPredictionPool.FEE()).toString())
            .divide(new bigDecimal(BONE.toString(10)), 18);

        const whitePriceBefore = new bigDecimal(eventInfo.whitePriceBefore.toString())
            .divide(new bigDecimal(BONE.toString(10)), 18);
        const blackPriceBefore = new bigDecimal(eventInfo.blackPriceBefore.toString())
          .divide(new bigDecimal(BONE.toString(10)), 18);

        const whitePriceAfter = new bigDecimal(eventInfo.whitePriceAfter.toString())
            .divide(new bigDecimal(BONE.toString(10)), 18);
        const blackPriceAfter = new bigDecimal(eventInfo.blackPriceAfter.toString())
          .divide(new bigDecimal(BONE.toString(10)), 18);

        const xxx = (el) => {
          const amountBDb = new bigDecimal(el.total);
          const f = amountBDb.multiply(fee);
          const a = amountBDb.subtract(f);
          const n1 = a.divide(el.isWhite ? whitePriceBefore : blackPriceBefore, 18).round();
          const x = n1.multiply(el.isWhite ? whitePriceAfter : blackPriceAfter)
          const aFeeBD = x.multiply(fee).round();
          const collateralToSend = x.subtract(aFeeBD).round();
          el.collateralToSend = new BN(collateralToSend.getValue());
          return el;
        }

        const tmpUsers = currentOrders
          .map((el) => {
            return el.user;
          })
        const users = tmpUsers.filter(function(item, pos) {
            return tmpUsers.indexOf(item) == pos;
          })
        if (debug) console.log("users:", users);

        const withdraw = async (account) => {

          if (debug) console.log("account :", account);
          if (debug) console.log("currentOrders :", currentOrders.filter(el => el.user === account));

          const expectedWithdrawAmountByUser = currentOrders
            .filter(el => el.user === account)
            .map(calcTotal)
            .map(xxx)
            .reduce(
              (prev, curr) => prev.add(curr.collateralToSend.sub(curr.borrowedAmount)), new BN('0')
            );
          if (debug) console.log("expectedWithdrawAmountByUser :", expectedWithdrawAmountByUser.toString());

          const userBalanceBeforeWithdraw = await deployedCollateralToken.balanceOf(accounts[account]);

          if (debug) console.log("balanceOf before withdraw  :", account, userBalanceBeforeWithdraw.toString());

          if (debug) console.log("balanceOf before withdraw  :", (await deployedCollateralToken.balanceOf(deployedLeverage.address)).toString())

          const resWithdrawCollateral = await deployedLeverage.withdrawCollateral(accounts[account]);

          const { logs: resWithdrawCollateralLog } = resWithdrawCollateral;
          const withdrawEventCount = 2;
          assert.equal(
            resWithdrawCollateralLog.length,
            withdrawEventCount,
            `triggers must be ${withdrawEventCount} event`
          );

          expectEvent.inLogs(resWithdrawCollateralLog, 'CollateralWithdrew', {
            amount: expectedWithdrawAmountByUser, /* Temporary disabled */
            user: accounts[account],
            caller: deployerAddress
          });

          expectEvent.inLogs(resWithdrawCollateralLog, 'Transfer', {
            from: deployedLeverage.address,
            to: accounts[account],
            value: expectedWithdrawAmountByUser /* Temporary disabled */
          });

          const userBalanceAfterWithdraw = await deployedCollateralToken.balanceOf(accounts[account]);
          expect(userBalanceAfterWithdraw).to.be.bignumber.equal(
            userBalanceBeforeWithdraw.add(expectedWithdrawAmountByUser)
          );
          if (debug) console.log("balanceOf after withdraw   :", (await deployedCollateralToken.balanceOf(deployedLeverage.address)).toString())
          if (debug) console.log("balanceOf after withdraw   :", account, userBalanceAfterWithdraw.toString())
        }

        for (let user of users) {
          if (debug) console.log("user:", user, accounts[user]);
          await withdraw(user);
        }

        await expectRevert(
          deployedLeverage.withdrawCollateral(accounts[0]),
          "ACCOUNT HAS NO ORDERS"
        );

        if (debug) console.log("balanceOf after all done   :", (await deployedCollateralToken.balanceOf(deployedLeverage.address)).toString())

        const _ordersCounter = await deployedLeverage._ordersCounter();
        if (debug) console.log("_ordersCounter:", _ordersCounter.toNumber());
        for (let orderId of [...Array(_ordersCounter.toNumber()).keys()]) {
          const order = await deployedLeverage._orders(orderId);
          if (debug) console.log("_orders:", getLogs(order));
            expect(order.orderer).to.equal('0x0000000000000000000000000000000000000000');
            expect(order.cross).to.be.bignumber.equal(new BN("0"));
            expect(order.ownAmount).to.be.bignumber.equal(new BN("0"));
            expect(order.borrowedAmount).to.be.bignumber.equal(new BN("0"));
            expect(order.isWhite).to.equal(false);
            expect(order.eventId).to.be.bignumber.equal(new BN("0"));
            expect(order.isCanceled).to.equal(false);
        }

        const _eventsById = await deployedLeverage._events(nowEvent.id);
        if (debug) console.log("_eventsById:", getLogs(_eventsById));
        if (debug) console.log("_eventsById:", _eventsById.crossOrdersOfUser);
      }
    });

    it("Leverage createOrder, check disabled Pending orders", async () => {

      const eventDuration = time.duration.seconds(5);

      await addLiquidityToPrediction(50000);
      await deployedEventLifeCycle.setLeverage(deployedLeverage.address, true);
      await deployedEventLifeCycle.setPendingOrders(
        deployedPendingOrders.address,
        false,
        { from: deployerAddress }
      );

      const user = accounts[4];

      const collateralAmount = mntob(20, multiplier);
      const maxLossUserDefined = ntob(0.25);
      const userSelectedEventId = new BN("100");

      const liquidityAmount = mntob(50000, multiplier);


      if (debug) console.log("collateralAmount:  ", collateralAmount.toString())
      if (debug) console.log("maxLossUserDefined:", maxLossUserDefined.toString())
      if (debug) console.log("liquidityAmount:   ", liquidityAmount.toString())

      await expectRevert(
        deployedLeverage.createOrder(
          collateralAmount,     // uint256 amount
          true,                 // bool isWhite,
          ntob(25),             // uint256 maxLoss,
          userSelectedEventId,  // uint256 eventId
        ), "MAX LOSS PERCENT IS VERY BIG"
      );

      await deployedEventLifeCycle.addNewEvent(
        new BN("50000000000000000"),  // uint256 priceChangePart,
        new BN("1800"),               // uint256 eventStartTimeExpected,
        new BN("1800"),               // uint256 eventEndTimeExpected,
        'BNB-DOWN',                   // string calldata blackTeam,
        'BNB-UP',                     // string calldata whiteTeam,
        'Crypto',                     // string calldata eventType,
        'BNB-USDT',                   // string calldata eventSeries,
        'BNB-USDT',                   // string calldata eventName,
        userSelectedEventId           // uint256 eventId
      )

      const queuedEvent = await deployedEventLifeCycle._queuedEvent();

      expect(queuedEvent.priceChangePart).to.be.bignumber.equal(new BN("50000000000000000"));
      expect(queuedEvent.eventStartTimeExpected).to.be.bignumber.equal(new BN("1800"));
      expect(queuedEvent.eventEndTimeExpected).to.be.bignumber.equal(new BN("1800"));
      expect(queuedEvent.blackTeam).to.be.equals('BNB-DOWN');
      expect(queuedEvent.whiteTeam).to.be.equals('BNB-UP');
      expect(queuedEvent.eventType).to.be.equals('Crypto');
      expect(queuedEvent.eventSeries).to.be.equals('BNB-USDT');
      expect(queuedEvent.eventName).to.be.equals('BNB-USDT');
      expect(queuedEvent.eventId).to.be.bignumber.equal(userSelectedEventId);

      await expectRevert(
        addAndStartEvent(
          userSelectedEventId,
          time.duration.seconds(5),
          new BN("50000000000000000")
        ), "PENDING ORDERS DISABLED"
      );

      await expectRevert(
        deployedLeverage.createOrder(
          collateralAmount,     // uint256 amount
          true,                 // bool isWhite,
          maxLossUserDefined,   // uint256 maxLoss,
          userSelectedEventId,  // uint256 eventId
          { from: user }
        ), "NOT ENOUGH COLLATERAL IN USER ACCOUNT"
      );

      expect(await deployedCollateralToken.balanceOf(user)).to.be.bignumber.equal(new BN("0"));

      await deployedCollateralToken.transfer(user, collateralAmount, { from: deployerAddress })

      expect(await deployedCollateralToken.balanceOf(user)).to.be.bignumber.equal(collateralAmount);

      await expectRevert(
        deployedLeverage.createOrder(
          collateralAmount,     // uint256 amount
          true,                 // bool isWhite,
          maxLossUserDefined,   // uint256 maxLoss,
          userSelectedEventId,  // uint256 eventId
          { from: user }
        ), "NOT ENOUGHT DELEGATED TOKENS"
      );

      await deployedCollateralToken.approve(deployedLeverage.address, collateralAmount, { from: user })

      expect(
        await deployedCollateralToken.balanceOf(deployedLeverage.address)
      ).to.be.bignumber.equal(new BN("0"));

      await deployedCollateralToken.approve(deployedLeverage.address, liquidityAmount, { from: deployerAddress })

      await expectRevert(
        deployedLeverage.createOrder(
          collateralAmount,     // uint256 amount
          true,                 // bool isWhite,
          maxLossUserDefined,   // uint256 maxLoss,
          userSelectedEventId,  // uint256 eventId
          { from: user }
        ), "NOT ENOUGH COLLATERAL BALANCE FOR BORROW"
      );

      await deployedLeverage.addLiquidity(liquidityAmount, { from: deployerAddress })

      expect(
        await deployedCollateralToken.balanceOf(deployedLeverage.address)
      ).to.be.bignumber.equal(liquidityAmount);

      await deployedLeverage.createOrder(
        collateralAmount,     // uint256 amount
        true,                 // bool isWhite,
        maxLossUserDefined,   // uint256 maxLoss,
        userSelectedEventId,  // uint256 eventId
        { from: user }
      )

      const firstOrder = getLogs(await deployedLeverage._orders(0));

      expect(firstOrder.orderer).to.be.equals(user);
      expect(firstOrder.cross).to.be.bignumber.equal('5000000000000000000');
      expect(firstOrder.ownAmount).to.be.bignumber.equal(mntob(20, multiplier));
      expect(firstOrder.borrowedAmount).to.be.bignumber.equal(mntob(80, multiplier));
      expect(firstOrder.isWhite).to.be.equals(true);
      expect(firstOrder.eventId).to.be.bignumber.equal(userSelectedEventId);

      if (debug) console.log("firstOrder:", firstOrder);
      if (debug) console.log("_orders:", getLogs(await deployedLeverage._orders(0)))

      if (debug) console.log("_ordersOfUser:", getLogs(await deployedLeverage._ordersOfUser(user, 0)))

      expect((await deployedPendingOrders.ordersOfUser(deployedLeverage.address)).length).to.be.equals(0);

      await expectRevert(
        deployedLeverage.cancelOrder(0),
        "NOT YOUR ORDER"
      );

      const cancelOrder = await deployedLeverage.cancelOrder(0, { from: user });

      const { logs: cancelOrderLog } = cancelOrder;
      const eventCount = 2;
      assert.equal(cancelOrderLog.length, eventCount, `triggers must be ${eventCount} event`);
      expectEvent.inLogs(cancelOrderLog, 'Transfer', {
        from: deployedLeverage.address,
        to: user,
        value: collateralAmount
      });

      expectEvent.inLogs(cancelOrderLog, 'OrderCanceled', {
        id: '0',
        user: user
      });

      expect(
        await deployedCollateralToken.balanceOf(deployedLeverage.address)
      ).to.be.bignumber.equal(liquidityAmount);

      if (debug) console.log("balanceOf only liquidity:", ( await deployedCollateralToken.balanceOf(deployedLeverage.address)).toString())

      await deployedEventLifeCycle.setPendingOrders(
        deployedPendingOrders.address,
        true,
        { from: deployerAddress }
      );

      await addAndStartEvent(
        userSelectedEventId,
        time.duration.seconds(5),
        new BN("50000000000000000")
      );

      await time.increase(eventDuration);

      await deployedEventLifeCycle.endEvent(
        new BN("0")
      );

      await deployedLeverage.withdrawCollateral(accounts[4]);

      const firstOrderAfterCancel = getLogs(await deployedLeverage._orders(0));
      if (debug) console.log("firstOrderAfterCancel:", firstOrderAfterCancel);

      const events = [
        { id: "101", priceChangePart: '50000000000000000', duration: 5, result: '1' },
        { id: "102", priceChangePart: '50000000000000000', duration: 5, result: '1' },
        { id: "103", priceChangePart: '50000000000000000', duration: 15, result: '0' },
        { id: "104", priceChangePart: '50000000000000000', duration: 25, result: '1' },
        { id: "105", priceChangePart: '50000000000000000', duration: 35, result: '-1' },
        { id: "106", priceChangePart: '50000000000000000', duration: 35, result: '-1' },
        { id: "107", priceChangePart: '50000000000000000', duration: 35, result: '0' }
      ]

      const orders = [
        { user: 1, ownAmount: 100,  isWhite: true,  maxLoss: 0.13, eventId: '102', cancel: false },
        { user: 1, ownAmount: 1253, isWhite: false, maxLoss: 0.24, eventId: '102', cancel: false },
        { user: 1, ownAmount: 1253, isWhite: true,  maxLoss: 0.37, eventId: '102', cancel: false },
        { user: 1, ownAmount: 273,  isWhite: true,  maxLoss: 0.42, eventId: '102', cancel: false },
        { user: 1, ownAmount: 332,  isWhite: true,  maxLoss: 0.11, eventId: '102', cancel: false },
        { user: 1, ownAmount: 14,   isWhite: false, maxLoss: 0.09, eventId: '102', cancel: false },
        { user: 1, ownAmount: 2730, isWhite: false, maxLoss: 0.09, eventId: '103', cancel: false },
        { user: 1, ownAmount: 1253, isWhite: true,  maxLoss: 0.09, eventId: '104', cancel: false },
        { user: 1, ownAmount: 2795, isWhite: false, maxLoss: 0.09, eventId: '104', cancel: false },
      ]

      for (let event = 0; event < events.length; event++) {
        const nowEvent = events[event];
        if (debug) console.log(`Let processing event #${nowEvent.id}:`);

        const duration = time.duration.seconds(nowEvent.duration);

        const eventStartExpected = await time.latest();
        const eventEndExpected = eventStartExpected.add(duration);
        await deployedEventLifeCycle.addNewEvent(
          nowEvent.priceChangePart,   // uint256 priceChangePart,
          eventStartExpected,         // uint256 eventStartTimeExpected,
          eventEndExpected,           // uint256 eventEndTimeExpected,
          'BNB-DOWN',                 // string calldata blackTeam,
          'BNB-UP',                   // string calldata whiteTeam,
          'Crypto',                   // string calldata eventType,
          'BNB-USDT',                 // string calldata eventSeries,
          'BNB-USDT',                 // string calldata eventName,
          nowEvent.id                 // uint256 eventId
        );

        const currentOrders = orders.filter(el => el.eventId === nowEvent.id);

        const blackOrders = currentOrders.filter(el => el.isWhite === false);
        const whiteOrders = currentOrders.filter(el => el.isWhite === true);

        if (debug) console.log(`blackOrders  :`, blackOrders.length)
        if (debug) console.log(`whiteOrders  :`, whiteOrders.length)

        const ownAmountSum = currentOrders
          .map((el) => { return mntob(el.ownAmount, multiplier); })
          .reduce((prev, curr) => prev.add(curr), new BN('0'));

        if (debug) console.log(`ownAmountSum  :`, ownAmountSum.toString())

        const calcTotal = (el) => {
          const maxLossBD = new bigDecimal(el.maxLoss.toString(10)).multiply(new bigDecimal(BONE.toString(10)));
          const crossBD = maxLossBD.divide(new bigDecimal(nowEvent.priceChangePart), 18)
          const ownAmountBD = new bigDecimal(mntob(el.ownAmount, multiplier).toString());
          const totalAmountBD = ownAmountBD.multiply(crossBD);
          el.borrowedAmount = new BN(totalAmountBD.subtract(ownAmountBD).getValue());
          el.total = new BN(totalAmountBD.getValue());
          return el;
        }

        const totalAmountSum = currentOrders
          .map(calcTotal)
          .reduce((prev, curr) => prev.add(curr.total), new BN('0'));

        const crossAmountSum = totalAmountSum.sub(ownAmountSum);

        if (debug) console.log(`totalAmountSum:`, totalAmountSum.toString())
        if (debug) console.log(`crossAmountSum:`, crossAmountSum.toString())

        const levBalanceBeforeOrders = await deployedCollateralToken.balanceOf(deployedLeverage.address);
        if (debug) console.log(`levBalanceBeforeOrders:`, levBalanceBeforeOrders.toString())

        for (let i of [...Array(currentOrders.length).keys()]) {
          await leverageCreateOrder(
            accounts[currentOrders[i].user],                // user
            mntob(currentOrders[i].ownAmount, multiplier),  // collateralAmount
            currentOrders[i].isWhite,                       // isWhite
            ntob(currentOrders[i].maxLoss),                 // maxLoss
            currentOrders[i].eventId                        // eventId
          );
        }

        const levBalanceAfterOrders = await deployedCollateralToken.balanceOf(deployedLeverage.address);
        if (debug) console.log(`levBalanceAfterOrders: `, levBalanceAfterOrders.toString())
        expect(
          await deployedCollateralToken.balanceOf(deployedLeverage.address)
        ).to.be.bignumber.equal(
          levBalanceBeforeOrders.add(ownAmountSum)
        );

        if (debug) console.log("balanceOf after post orders:", levBalanceAfterOrders.toString())

        const pendingOrdersCountOfLeverageBeforeStart = await deployedPendingOrders.ordersOfUser(deployedLeverage.address);

        if (debug) console.log("ordersOfLeverageBeforeStart:", pendingOrdersCountOfLeverageBeforeStart)

        expect(pendingOrdersCountOfLeverageBeforeStart.length).to.equal(0);

        if (debug) console.log("_events:", getLogs(await deployedLeverage._events(nowEvent.id)))

        await expectRevert(
          addAndStartEvent(
            nowEvent.id,
            time.duration.seconds(nowEvent.duration),
            ntob(0.03)
          ),
          "WRONG PRICE CHANGE PART"
        );

        await addAndStartEvent(
          nowEvent.id,
          time.duration.seconds(nowEvent.duration),
          nowEvent.priceChangePart
        );

        const pendingOrdersCountOfLeverageAfterStart = await deployedPendingOrders.ordersOfUser(deployedLeverage.address);

        if (debug) console.log(
          "ordersOfLeverageAfterStart:",
          pendingOrdersCountOfLeverageAfterStart.map((el) => { return el.toString()})
        )

        expect(pendingOrdersCountOfLeverageAfterStart.length).to.equal(
          (blackOrders.length > 0 ? 1 : 0) + (whiteOrders.length > 0 ? 1 : 0)
        );

        if (debug) console.log(`levBalanceAfterStart:  `, (await deployedCollateralToken.balanceOf(deployedLeverage.address)).toString())
        if (debug) console.log(`levBalanceAfterStart:  `, (levBalanceAfterOrders.sub(totalAmountSum)).toString())

        expect(
          await deployedCollateralToken.balanceOf(deployedLeverage.address)
        ).to.be.bignumber.equal(
          levBalanceAfterOrders.sub(totalAmountSum)
        );

        if (debug) console.log("balanceOf after start event:", (await deployedCollateralToken.balanceOf(deployedLeverage.address)).toString())

        await time.increase(eventDuration);

        const endEvent = await deployedEventLifeCycle.endEvent(
          new BN(nowEvent.result)
        );

        if (debug) console.log("_events:", (await deployedLeverage._events(nowEvent.id)).orders)
        if (debug) console.log("_events:", getLogs(await deployedLeverage._events(nowEvent.id)))

        if (debug) console.log("balanceOf:", ( await deployedCollateralToken.balanceOf(deployedLeverage.address)).toString())

        if (debug) console.log("_whitePrice:", ( await deployedPredictionPool._whitePrice()).toString())
        if (debug) console.log("_blackPrice:", ( await deployedPredictionPool._blackPrice()).toString())

        const resultAmountSum = currentOrders
          .map(calcTotal)
          .reduce(
            (prev, curr) => prev.add(curr.total), new BN('0')
          );

        if (debug) console.log("resultAmountSum:", resultAmountSum.toString())

        const resultAmountSumBlack = currentOrders
          .filter(el => el.isWhite === false)
          .map(calcTotal)
          .reduce((prev, curr) => prev.add(curr.total), new BN('0'));

        const resultAmountSumWhite = currentOrders
          .filter(el => el.isWhite === true)
          .map(calcTotal)
          .reduce(
            (prev, curr) => prev.add(curr.total), new BN('0')
          );

        const eventInfo = await deployedLeverage._events(nowEvent.id);
        if (debug) console.log("resultAmountSumBlack:", resultAmountSumBlack.toString())
        if (debug) console.log("resultAmountSumWhite:", resultAmountSumWhite.toString())
        if (debug) console.log("balanceOf after end event  :", (await deployedCollateralToken.balanceOf(deployedLeverage.address)).toString())
        if (debug) console.log("_events:", getLogs(eventInfo))

        expect(eventInfo.blackCollateralAmount).to.be.bignumber.equal(resultAmountSumBlack);
        expect(eventInfo.whiteCollateralAmount).to.be.bignumber.equal(resultAmountSumWhite);

        // ? resultAmountSum


        const fee = new bigDecimal(
          (await deployedPredictionPool.FEE()).toString())
            .divide(new bigDecimal(BONE.toString(10)), 18);

        const whitePriceBefore = new bigDecimal(eventInfo.whitePriceBefore.toString())
            .divide(new bigDecimal(BONE.toString(10)), 18);
        const blackPriceBefore = new bigDecimal(eventInfo.blackPriceBefore.toString())
          .divide(new bigDecimal(BONE.toString(10)), 18);

        const whitePriceAfter = new bigDecimal(eventInfo.whitePriceAfter.toString())
            .divide(new bigDecimal(BONE.toString(10)), 18);
        const blackPriceAfter = new bigDecimal(eventInfo.blackPriceAfter.toString())
          .divide(new bigDecimal(BONE.toString(10)), 18);

        const xxx = (el) => {
          const amountBDb = new bigDecimal(el.total);
          const f = amountBDb.multiply(fee);
          const a = amountBDb.subtract(f);
          const n1 = a.divide(el.isWhite ? whitePriceBefore : blackPriceBefore, 18).round();
          const x = n1.multiply(el.isWhite ? whitePriceAfter : blackPriceAfter)
          const aFeeBD = x.multiply(fee).round();
          const collateralToSend = x.subtract(aFeeBD).round();
          el.collateralToSend = new BN(collateralToSend.getValue());
          return el;
        }

        const tmpUsers = currentOrders
          .map((el) => {
            return el.user;
          })
        const users = tmpUsers.filter(function(item, pos) {
            return tmpUsers.indexOf(item) == pos;
          })
        if (debug) console.log("users:", users);

        const withdraw = async (account) => {

          if (debug) console.log("account :", account);
          if (debug) console.log("currentOrders :", currentOrders.filter(el => el.user === account));

          const expectedWithdrawAmountByUser = currentOrders
            .filter(el => el.user === account)
            .map(calcTotal)
            .map(xxx)
            .reduce(
              (prev, curr) => prev.add(curr.collateralToSend.sub(curr.borrowedAmount)), new BN('0')
            );
          if (debug) console.log("expectedWithdrawAmountByUser :", expectedWithdrawAmountByUser.toString());

          const userBalanceBeforeWithdraw = await deployedCollateralToken.balanceOf(accounts[account]);

          if (debug) console.log("balanceOf before withdraw  :", account, userBalanceBeforeWithdraw.toString());

          if (debug) console.log("balanceOf before withdraw  :", (await deployedCollateralToken.balanceOf(deployedLeverage.address)).toString())

          const resWithdrawCollateral = await deployedLeverage.withdrawCollateral(accounts[account]);

          const { logs: resWithdrawCollateralLog } = resWithdrawCollateral;
          const withdrawEventCount = 2;
          assert.equal(
            resWithdrawCollateralLog.length,
            withdrawEventCount,
            `triggers must be ${withdrawEventCount} event`
          );

          expectEvent.inLogs(resWithdrawCollateralLog, 'CollateralWithdrew', {
            amount: expectedWithdrawAmountByUser, /* Temporary disabled */
            user: accounts[account],
            caller: deployerAddress
          });

          expectEvent.inLogs(resWithdrawCollateralLog, 'Transfer', {
            from: deployedLeverage.address,
            to: accounts[account],
            value: expectedWithdrawAmountByUser /* Temporary disabled */
          });

          const userBalanceAfterWithdraw = await deployedCollateralToken.balanceOf(accounts[account]);
          expect(userBalanceAfterWithdraw).to.be.bignumber.equal(
            userBalanceBeforeWithdraw.add(expectedWithdrawAmountByUser)
          );
          if (debug) console.log("balanceOf after withdraw   :", (await deployedCollateralToken.balanceOf(deployedLeverage.address)).toString())
          if (debug) console.log("balanceOf after withdraw   :", account, userBalanceAfterWithdraw.toString())
        }

        for (let user of users) {
          if (debug) console.log("user:", user, accounts[user]);
          await withdraw(user);
        }

        await expectRevert(
          deployedLeverage.withdrawCollateral(accounts[0]),
          "ACCOUNT HAS NO ORDERS"
        );

        if (debug) console.log("balanceOf after all done   :", (await deployedCollateralToken.balanceOf(deployedLeverage.address)).toString())

        const _ordersCounter = await deployedLeverage._ordersCounter();
        if (debug) console.log("_ordersCounter:", _ordersCounter.toNumber());
        for (let orderId of [...Array(_ordersCounter.toNumber()).keys()]) {
          const order = await deployedLeverage._orders(orderId);
          if (debug) console.log("_orders:", getLogs(order));
            expect(order.orderer).to.equal('0x0000000000000000000000000000000000000000');
            expect(order.cross).to.be.bignumber.equal(new BN("0"));
            expect(order.ownAmount).to.be.bignumber.equal(new BN("0"));
            expect(order.borrowedAmount).to.be.bignumber.equal(new BN("0"));
            expect(order.isWhite).to.equal(false);
            expect(order.eventId).to.be.bignumber.equal(new BN("0"));
            expect(order.isCanceled).to.equal(false);
        }

        const _eventsById = await deployedLeverage._events(nowEvent.id);
        if (debug) console.log("_eventsById:", getLogs(_eventsById));
        if (debug) console.log("_eventsById:", _eventsById.crossOrdersOfUser);
      }
    });

    // Utility
    const buyToken = async (color, initialBlackOrWhitePrice, buyPayment) => {
      let buyColor;
      const eventCount = 4;
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
      const buyPayment = mntob(amount, multiplier);

      const collateralTokenDeployerBalance = await deployedCollateralToken.balanceOf(deployerAddress);
      expect(collateralTokenDeployerBalance).to.be.bignumber.at.least(buyPayment);

      const collateralTokenPpBefore = await deployedCollateralToken.balanceOf(deployedPredictionPool.address);
      const collateralTokenPcBefore = await deployedCollateralToken.balanceOf(deployedPredictionCollateralization.address);
      const _whiteBoughtBefore = await deployedPredictionPool._whiteBought();
      const _blackBoughtBefore = await deployedPredictionPool._blackBought();

      const addLiquidity = await deployedPredictionPool.addLiquidity(buyPayment);
      const { logs: addLiquidityLog } = addLiquidity;

      const wPrice = await deployedPredictionPool._whitePrice();
      const bPrice = await deployedPredictionPool._blackPrice();

      const sPrice = new bigDecimal(wPrice.toString()).add(new bigDecimal(bPrice.toString()));

      const bwAmount = new bigDecimal(buyPayment.toString())
        .divide(sPrice, 18)
        .multiply(new bigDecimal(BONE.toString(10)))
        .getValue();

      if (debug) console.log("collateralTokenPpBefore  :", collateralTokenPpBefore.toString())
      if (debug) console.log("collateralTokenPcBefore  :", collateralTokenPcBefore.toString())
      if (debug) console.log("wPrice  :", wPrice.toString())
      if (debug) console.log("bPrice  :", bPrice.toString())
      if (debug) console.log("sPrice  :", sPrice.getValue())
      if (debug) console.log("bwAmount:", bwAmount)

      expectEvent.inLogs(addLiquidityLog, 'AddLiquidity', {
        user: deployerAddress,
        whitePrice: wPrice,
        blackPrice: bPrice,
        bwAmount: bwAmount,
        colaterallAmount: buyPayment
      });

      const _whiteBoughtExpected = new bigDecimal(_whiteBoughtBefore.toString())
        .add(new bigDecimal(bwAmount))
        .getValue();

      const _blackBoughtExpected = new bigDecimal(_blackBoughtBefore.toString())
        .add(new bigDecimal(bwAmount))
        .getValue();

      const collateralTokenPpExpected = new bigDecimal(collateralTokenPpBefore.toString())
        .add(new bigDecimal(buyPayment))
        .getValue();

      expect(await deployedPredictionPool._whiteBought()).to.be.bignumber.equal(_whiteBoughtExpected);
      expect(await deployedPredictionPool._blackBought()).to.be.bignumber.equal(_blackBoughtExpected);

      if (debug) console.log(
        "collateralTokenPcBefore  :",
        (await deployedCollateralToken.balanceOf(
          deployedPredictionCollateralization.address
        )).toString()
      )

      expect(
        await deployedCollateralToken.balanceOf(deployedPredictionCollateralization.address)
      ).to.be.bignumber.equal(collateralTokenPpExpected);
    }

    const addAndStartEvent = async (eventId, duration, priceChangePart) => {
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
  });

})

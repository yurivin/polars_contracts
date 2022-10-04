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

const { deployContracts, ntob, mntob, BONE } = require('./../utils.js');

[
  "6",
  "18"
].forEach((decimals) => {
  const collateralTokenDecimals = decimals;
  const multiplier = 10 ** parseInt(collateralTokenDecimals);
  const collateralTokenSupply = mntob(1e13, multiplier);

  contract(`DEV: PredictionPool ${decimals} Decimals`, (accounts) => {
    "use strict";

    const [ deployerAddress ] = accounts;

    let deployedPredictionPool;
    let deployedPredictionCollateralization;
    let deployedCollateralToken;
    let deployedWhiteToken;
    let deployedBlackToken;
    let deployedPendingOrders;
    let deployedEventLifeCycle;

    let snapshotA;

    before(async () => {

    });

    beforeEach(async () => {
      const deployedContracts = await deployContracts(deployerAddress, collateralTokenDecimals);

      deployedPredictionPool = deployedContracts.deployedPredictionPool;
      deployedPredictionCollateralization = deployedContracts.deployedPredictionCollateralization;
      deployedCollateralToken = deployedContracts.deployedCollateralToken;
      deployedWhiteToken = deployedContracts.deployedWhiteToken;
      deployedBlackToken = deployedContracts.deployedBlackToken;
      deployedPendingOrders = deployedContracts.deployedPendingOrders;
      deployedEventLifeCycle = deployedContracts.deployedEventLifeCycle;
    });

    afterEach(async () => {

    });

    it("should assert PredictionPool address equal PredictionCollateralization._poolAddress()", async function () {
      return assert.equal(deployedPredictionPool.address, await deployedPredictionCollateralization._poolAddress());
    });

    it("should assert collateralTokentotalSupply equal collateralTokenDeployerBalance", async function () {
      const collateralTokentotalSupply = await deployedCollateralToken.totalSupply();
      const collateralTokenDeployerBalance = await deployedCollateralToken.balanceOf(deployerAddress);
      return expect(collateralTokentotalSupply).to.be.bignumber.equal(collateralTokenDeployerBalance);
    });

    it("should assert PredictionCollateralization address equal PredictionPool._thisCollateralization()", async function () {
      return assert.equal(await deployedPredictionPool._thisCollateralization(), deployedPredictionCollateralization.address);
    });

    it("Orderer functional enabled", async function () {
      const anotherOrderer = accounts[7]
      await deployedPredictionPool.changeOrderer(
        anotherOrderer,
        { from: deployerAddress }
      );
      await deployedPredictionPool.setOnlyOrderer(
        true,
        { from: deployerAddress }
      );

      const collateralAmountToBuy = mntob(1e5, multiplier);
      const buyPayment = mntob(5, multiplier);

      const initialBlackOrWhitePrice = mntob(0.5, multiplier);

      const collateralTokenDeployerBalance = await deployedCollateralToken.balanceOf(deployerAddress);

      expect(collateralTokenDeployerBalance).to.be.bignumber.at.least(collateralAmountToBuy);

      await expectRevert(
        deployedPredictionPool.buyBlack(
          initialBlackOrWhitePrice,
          buyPayment,
          { from: deployerAddress }
        ),
        "Incorrerct orderer",
      );

      await expectRevert(
        deployedPredictionPool.buyBlack(
          initialBlackOrWhitePrice,
          buyPayment,
          { from: anotherOrderer }
        ),
        "Not enough delegated tokens",
      );

      await deployedCollateralToken.approve(
        deployedPredictionCollateralization.address,
        buyPayment,
        { from: anotherOrderer }
      );

      await expectRevert(
        deployedPredictionPool.buyBlack(
          initialBlackOrWhitePrice,
          buyPayment,
          { from: anotherOrderer }
        ),
        "SafeMath: subtraction overflow",
      );

      await deployedCollateralToken.transfer(
        anotherOrderer,
        buyPayment,
        { from: deployerAddress }
      );

      const buyBlack = await deployedPredictionPool.buyBlack(
        initialBlackOrWhitePrice,
        buyPayment,
        { from: anotherOrderer }
      );
      const { logs: buyBlackLog } = buyBlack;

      const eventCount = 4;
      assert.equal(buyBlackLog.length, eventCount, `triggers must be ${eventCount} event`);

      const blackBought = new BN("9970000000000000000");

      expectEvent.inLogs(buyBlackLog, 'BuyBlack', {
        user: anotherOrderer,
        amount: blackBought,
        price: initialBlackOrWhitePrice
      });

      return expect(
        await deployedBlackToken.balanceOf(anotherOrderer)
      ).to.be.bignumber.equal(blackBought);
    });

    Array.from({length: 50}, (_, i) => i + 1).forEach((liqAmount) => {
      it(`addLiquidity and withdrawLiquidity errors catch on amount ${liqAmount}`, async function () {
        const tokensAmount = mntob(liqAmount, multiplier);
        const bwTokensAmount = ntob(liqAmount);
        const blackTokensAmount = ntob(liqAmount);
        const whiteTokensAmount = ntob(liqAmount);
        const totalCollateralTokensAmount = collateralTokenSupply;

        const forWhiteAmount = mntob((liqAmount/2), multiplier);
        const forBlackAmount = mntob((liqAmount/2), multiplier);

        const startPrice = mntob(0.5, multiplier);
        const sPrice = startPrice.add(startPrice);
        expect(sPrice).to.be.bignumber.equal(mntob(1, multiplier));

        const bwAmnt = new bigDecimal(tokensAmount.toString())
          .divide(new bigDecimal(sPrice.toString(10)), 18);

        const forWhite = bwAmnt.multiply(new bigDecimal(startPrice.toString(10))).getValue()

        const forBlack = bwAmnt.multiply(new bigDecimal(startPrice.toString(10))).getValue()

        const bwAmount = ntob(liqAmount); // ?????

        await expectRevert(
          deployedPredictionPool.addLiquidity(
            tokensAmount,
            { from: accounts[6] }
          ),
          "Not enough tokens are delegated",
        );

        await deployedCollateralToken.approve(
          deployedPredictionPool.address,     // address spender
          tokensAmount,                       // uint256 value
          { from: accounts[6] }
        )

        await expectRevert(
          deployedPredictionPool.addLiquidity(
            tokensAmount,
            { from: accounts[6] }
          ),
          "Not enough tokens on the user balance",
        );

        expect(bwAmount).to.be.bignumber.equal(bwTokensAmount);
        expect(forWhite).to.be.bignumber.equal(forWhiteAmount);
        expect(forBlack).to.be.bignumber.equal(forBlackAmount);

        expect(await deployedPredictionPool._whitePrice()).to.be.bignumber.equal(startPrice);
        expect(await deployedPredictionPool._blackPrice()).to.be.bignumber.equal(startPrice);

        expect(await deployedPredictionPool._collateralForWhite()).to.be.bignumber.equal(new BN("0"));
        expect(await deployedPredictionPool._collateralForBlack()).to.be.bignumber.equal(new BN("0"));

        expect(
          await deployedPredictionPool.balanceOf(deployerAddress)
        ).to.be.bignumber.equal(new BN("0"));

        expect(
          await deployedCollateralToken.balanceOf(deployedPredictionPool.address)
        ).to.be.bignumber.equal(new BN("0"));

        expect(
          await deployedCollateralToken.balanceOf(deployerAddress)
        ).to.be.bignumber.equal(totalCollateralTokensAmount);

        expect(
          await deployedCollateralToken.balanceOf(deployedPredictionCollateralization.address)
        ).to.be.bignumber.equal(new BN("0"));

        expect(
          await deployedWhiteToken.balanceOf(deployedPredictionPool.address)
        ).to.be.bignumber.equal(new BN("0"));

        expect(
          await deployedBlackToken.balanceOf(deployedPredictionPool.address)
        ).to.be.bignumber.equal(new BN("0"));

        expect(
          await deployedWhiteToken.balanceOf(deployedPredictionCollateralization.address)
        ).to.be.bignumber.equal(new BN("0"));

        expect(
          await deployedBlackToken.balanceOf(deployedPredictionCollateralization.address)
        ).to.be.bignumber.equal(new BN("0"));

        expect(await deployedPredictionPool._blackBought()).to.be.bignumber.equal(new BN("0"));
        expect(await deployedPredictionPool._whiteBought()).to.be.bignumber.equal(new BN("0"));


        const addLiquidity = await deployedPredictionPool.addLiquidity(
          tokensAmount,
          { from: deployerAddress }
        );
        const { logs: addLiquidityLog } = addLiquidity;

        expectEvent.inLogs(addLiquidityLog, 'AddLiquidity', {
          user: deployerAddress,
          whitePrice: startPrice,              // "0.5",
          blackPrice: startPrice,              // "0.5",
          bwAmount: bwTokensAmount,            // "1000",
          colaterallAmount: tokensAmount       // "1000"
        });


        expect(await deployedPredictionPool._whitePrice()).to.be.bignumber.equal(startPrice);
        expect(await deployedPredictionPool._blackPrice()).to.be.bignumber.equal(startPrice);

        expect(await deployedPredictionPool._collateralForWhite()).to.be.bignumber.equal(forWhiteAmount);
        expect(await deployedPredictionPool._collateralForBlack()).to.be.bignumber.equal(forBlackAmount);

        expect(
          await deployedPredictionPool.balanceOf(deployerAddress)
        ).to.be.bignumber.equal(bwTokensAmount);

        expect(
          await deployedCollateralToken.balanceOf(deployedPredictionPool.address)
        ).to.be.bignumber.equal(new BN("0"));

        expect(
          await deployedCollateralToken.balanceOf(deployerAddress)
        ).to.be.bignumber.equal(totalCollateralTokensAmount.sub(tokensAmount));

        expect(
          await deployedCollateralToken.balanceOf(deployedPredictionCollateralization.address)
        ).to.be.bignumber.equal(tokensAmount);

        expect(
          await deployedWhiteToken.balanceOf(deployedPredictionPool.address)
        ).to.be.bignumber.equal(whiteTokensAmount);

        expect(
          await deployedBlackToken.balanceOf(deployedPredictionPool.address)
        ).to.be.bignumber.equal(blackTokensAmount);

        expect(
          await deployedWhiteToken.balanceOf(deployedPredictionCollateralization.address)
        ).to.be.bignumber.equal(new BN("0"));

        expect(
          await deployedBlackToken.balanceOf(deployedPredictionCollateralization.address)
        ).to.be.bignumber.equal(new BN("0"));

        expect(await deployedPredictionPool._blackBought()).to.be.bignumber.equal(bwTokensAmount);
        expect(await deployedPredictionPool._whiteBought()).to.be.bignumber.equal(bwTokensAmount);


        await expectRevert(
          deployedPredictionPool.withdrawLiquidity(
            bwTokensAmount,
            { from: accounts[6] }
          ),
          "Not enough pool tokens are delegated",
        );

        await deployedPredictionPool.approve(
          deployedPredictionPool.address,     // address spender
          bwTokensAmount,                     // uint256 value
          { from: accounts[6] }
        )

        await expectRevert(
          deployedPredictionPool.withdrawLiquidity(
            bwTokensAmount,
            { from: accounts[6] }
          ),
          "Not enough tokens on the user balance",
        );

        await deployedPredictionPool.approve(
          deployedPredictionPool.address,     // address spender
          bwTokensAmount,                     // uint256 value
          { from: deployerAddress }
        )

        const withdrawLiquidity = await deployedPredictionPool.withdrawLiquidity(
          bwTokensAmount,
          { from: deployerAddress }
        );

        const { logs: withdrawLiquidityLog } = withdrawLiquidity;

        expectEvent.inLogs(withdrawLiquidityLog, 'WithdrawLiquidity', {
          user: deployerAddress,
          whitePrice: startPrice,              // "0.5",
          blackPrice: startPrice,              // "0.5",
          bwAmount: bwTokensAmount,            // "1000",
          colaterallAmount: tokensAmount       // "1000"
        });

        expect(await deployedPredictionPool._whitePrice()).to.be.bignumber.equal(startPrice);
        expect(await deployedPredictionPool._blackPrice()).to.be.bignumber.equal(startPrice);

        expect(await deployedPredictionPool._collateralForWhite()).to.be.bignumber.equal(new BN("0"));
        expect(await deployedPredictionPool._collateralForBlack()).to.be.bignumber.equal(new BN("0"));

        expect(
          await deployedPredictionPool.balanceOf(deployerAddress)
        ).to.be.bignumber.equal(new BN("0"));

        expect(
          await deployedCollateralToken.balanceOf(deployedPredictionPool.address)
        ).to.be.bignumber.equal(new BN("0"));

        expect(
          await deployedCollateralToken.balanceOf(deployerAddress)
        ).to.be.bignumber.equal(totalCollateralTokensAmount);

        expect(
          await deployedCollateralToken.balanceOf(deployedPredictionCollateralization.address)
        ).to.be.bignumber.equal(new BN("0"));

        expect(
          await deployedWhiteToken.balanceOf(deployedPredictionPool.address)
        ).to.be.bignumber.equal(new BN("0"));

        expect(
          await deployedBlackToken.balanceOf(deployedPredictionPool.address)
        ).to.be.bignumber.equal(new BN("0"));

        expect(
          await deployedWhiteToken.balanceOf(deployedPredictionCollateralization.address)
        ).to.be.bignumber.equal(new BN("0"));

        expect(
          await deployedBlackToken.balanceOf(deployedPredictionCollateralization.address)
        ).to.be.bignumber.equal(new BN("0"));

        expect(await deployedPredictionPool._blackBought()).to.be.bignumber.equal(new BN("0"));
        expect(await deployedPredictionPool._whiteBought()).to.be.bignumber.equal(new BN("0"));
      });
    });

    it("addLiquidity and withdrawLiquidity", async function () {
      const tokensAmount = mntob(1000, multiplier);
      const bwTokensAmount = ntob(1000);
      const blackTokensAmount = ntob(1000);
      const whiteTokensAmount = ntob(1000);
      const totalCollateralTokensAmount = collateralTokenSupply;

      const forWhiteAmount = mntob(500, multiplier);
      const forBlackAmount = mntob(500, multiplier);

      const startPrice = mntob(0.5, multiplier);
      const sPrice = startPrice.add(startPrice);
      expect(sPrice).to.be.bignumber.equal(mntob(1, multiplier));

      const bwAmnt = new bigDecimal(tokensAmount.toString())
        .divide(new bigDecimal(sPrice.toString(10)), 18);

      const forWhite = bwAmnt.multiply(new bigDecimal(startPrice.toString(10))).getValue()

      const forBlack = bwAmnt.multiply(new bigDecimal(startPrice.toString(10))).getValue()

      // const bwAmount = new BN(
      //   bwAmnt.multiply(new bigDecimal(multiplier.toString(10))).getValue()
      // );
      const bwAmount = ntob(1000); // ?????

      await expectRevert(
        deployedPredictionPool.addLiquidity(
          tokensAmount,
          { from: accounts[6] }
        ),
        "Not enough tokens are delegated",
      );

      await deployedCollateralToken.approve(
        deployedPredictionPool.address,     // address spender
        tokensAmount,                       // uint256 value
        { from: accounts[6] }
      )

      await expectRevert(
        deployedPredictionPool.addLiquidity(
          tokensAmount,
          { from: accounts[6] }
        ),
        "Not enough tokens on the user balance",
      );

      expect(bwAmount).to.be.bignumber.equal(bwTokensAmount);
      expect(forWhite).to.be.bignumber.equal(forWhiteAmount);
      expect(forBlack).to.be.bignumber.equal(forBlackAmount);

      expect(await deployedPredictionPool._whitePrice()).to.be.bignumber.equal(startPrice);
      expect(await deployedPredictionPool._blackPrice()).to.be.bignumber.equal(startPrice);

      expect(await deployedPredictionPool._collateralForWhite()).to.be.bignumber.equal(new BN("0"));
      expect(await deployedPredictionPool._collateralForBlack()).to.be.bignumber.equal(new BN("0"));

      expect(
        await deployedPredictionPool.balanceOf(deployerAddress)
      ).to.be.bignumber.equal(new BN("0"));

      expect(
        await deployedCollateralToken.balanceOf(deployedPredictionPool.address)
      ).to.be.bignumber.equal(new BN("0"));

      expect(
        await deployedCollateralToken.balanceOf(deployerAddress)
      ).to.be.bignumber.equal(totalCollateralTokensAmount);

      expect(
        await deployedCollateralToken.balanceOf(deployedPredictionCollateralization.address)
      ).to.be.bignumber.equal(new BN("0"));

      expect(
        await deployedWhiteToken.balanceOf(deployedPredictionPool.address)
      ).to.be.bignumber.equal(new BN("0"));

      expect(
        await deployedBlackToken.balanceOf(deployedPredictionPool.address)
      ).to.be.bignumber.equal(new BN("0"));

      expect(
        await deployedWhiteToken.balanceOf(deployedPredictionCollateralization.address)
      ).to.be.bignumber.equal(new BN("0"));

      expect(
        await deployedBlackToken.balanceOf(deployedPredictionCollateralization.address)
      ).to.be.bignumber.equal(new BN("0"));

      expect(await deployedPredictionPool._blackBought()).to.be.bignumber.equal(new BN("0"));
      expect(await deployedPredictionPool._whiteBought()).to.be.bignumber.equal(new BN("0"));


      const addLiquidity = await deployedPredictionPool.addLiquidity(
        tokensAmount,
        { from: deployerAddress }
      );
      const { logs: addLiquidityLog } = addLiquidity;

      expectEvent.inLogs(addLiquidityLog, 'AddLiquidity', {
        user: deployerAddress,
        whitePrice: startPrice,              // "0.5",
        blackPrice: startPrice,              // "0.5",
        bwAmount: bwTokensAmount,            // "1000",
        colaterallAmount: tokensAmount       // "1000"
      });


      expect(await deployedPredictionPool._whitePrice()).to.be.bignumber.equal(startPrice);
      expect(await deployedPredictionPool._blackPrice()).to.be.bignumber.equal(startPrice);

      expect(await deployedPredictionPool._collateralForWhite()).to.be.bignumber.equal(forWhiteAmount);
      expect(await deployedPredictionPool._collateralForBlack()).to.be.bignumber.equal(forBlackAmount);

      expect(
        await deployedPredictionPool.balanceOf(deployerAddress)
      ).to.be.bignumber.equal(bwTokensAmount);

      expect(
        await deployedCollateralToken.balanceOf(deployedPredictionPool.address)
      ).to.be.bignumber.equal(new BN("0"));

      expect(
        await deployedCollateralToken.balanceOf(deployerAddress)
      ).to.be.bignumber.equal(totalCollateralTokensAmount.sub(tokensAmount));

      expect(
        await deployedCollateralToken.balanceOf(deployedPredictionCollateralization.address)
      ).to.be.bignumber.equal(tokensAmount);

      expect(
        await deployedWhiteToken.balanceOf(deployedPredictionPool.address)
      ).to.be.bignumber.equal(whiteTokensAmount);

      expect(
        await deployedBlackToken.balanceOf(deployedPredictionPool.address)
      ).to.be.bignumber.equal(blackTokensAmount);

      expect(
        await deployedWhiteToken.balanceOf(deployedPredictionCollateralization.address)
      ).to.be.bignumber.equal(new BN("0"));

      expect(
        await deployedBlackToken.balanceOf(deployedPredictionCollateralization.address)
      ).to.be.bignumber.equal(new BN("0"));

      expect(await deployedPredictionPool._blackBought()).to.be.bignumber.equal(bwTokensAmount);
      expect(await deployedPredictionPool._whiteBought()).to.be.bignumber.equal(bwTokensAmount);


      await expectRevert(
        deployedPredictionPool.withdrawLiquidity(
          bwTokensAmount,
          { from: accounts[6] }
        ),
        "Not enough pool tokens are delegated",
      );

      await deployedPredictionPool.approve(
        deployedPredictionPool.address,     // address spender
        bwTokensAmount,                     // uint256 value
        { from: accounts[6] }
      )

      await expectRevert(
        deployedPredictionPool.withdrawLiquidity(
          bwTokensAmount,
          { from: accounts[6] }
        ),
        "Not enough tokens on the user balance",
      );

      await deployedPredictionPool.approve(
        deployedPredictionPool.address,     // address spender
        bwTokensAmount,                     // uint256 value
        { from: deployerAddress }
      )

      const withdrawLiquidity = await deployedPredictionPool.withdrawLiquidity(
        bwTokensAmount,
        { from: deployerAddress }
      );

      const { logs: withdrawLiquidityLog } = withdrawLiquidity;

      expectEvent.inLogs(withdrawLiquidityLog, 'WithdrawLiquidity', {
        user: deployerAddress,
        whitePrice: startPrice,              // "0.5",
        blackPrice: startPrice,              // "0.5",
        bwAmount: bwTokensAmount,            // "1000",
        colaterallAmount: tokensAmount       // "1000"
      });

      expect(await deployedPredictionPool._whitePrice()).to.be.bignumber.equal(startPrice);
      expect(await deployedPredictionPool._blackPrice()).to.be.bignumber.equal(startPrice);

      expect(await deployedPredictionPool._collateralForWhite()).to.be.bignumber.equal(new BN("0"));
      expect(await deployedPredictionPool._collateralForBlack()).to.be.bignumber.equal(new BN("0"));

      expect(
        await deployedPredictionPool.balanceOf(deployerAddress)
      ).to.be.bignumber.equal(new BN("0"));

      expect(
        await deployedCollateralToken.balanceOf(deployedPredictionPool.address)
      ).to.be.bignumber.equal(new BN("0"));

      expect(
        await deployedCollateralToken.balanceOf(deployerAddress)
      ).to.be.bignumber.equal(totalCollateralTokensAmount);

      expect(
        await deployedCollateralToken.balanceOf(deployedPredictionCollateralization.address)
      ).to.be.bignumber.equal(new BN("0"));

      expect(
        await deployedWhiteToken.balanceOf(deployedPredictionPool.address)
      ).to.be.bignumber.equal(new BN("0"));

      expect(
        await deployedBlackToken.balanceOf(deployedPredictionPool.address)
      ).to.be.bignumber.equal(new BN("0"));

      expect(
        await deployedWhiteToken.balanceOf(deployedPredictionCollateralization.address)
      ).to.be.bignumber.equal(new BN("0"));

      expect(
        await deployedBlackToken.balanceOf(deployedPredictionCollateralization.address)
      ).to.be.bignumber.equal(new BN("0"));

      expect(await deployedPredictionPool._blackBought()).to.be.bignumber.equal(new BN("0"));
      expect(await deployedPredictionPool._whiteBought()).to.be.bignumber.equal(new BN("0"));
    });

    it("test for create orders without liquidity in pool", async function () {
    // it.only("test", async function () {
      const runner = accounts[7]
      const runner2 = accounts[8]

      const amountBN = mntob(10, multiplier);
      const isWhite = true;
      const eventId = "10000002426";

      await expectRevert(
        deployedPendingOrders.createOrder(
          amountBN,
          isWhite,
          eventId,
          { from: runner }
        ),
        "NOT ENOUGH COLLATERAL IN USER ACCOUNT",
      );

      await deployedCollateralToken.transfer(runner, amountBN, { from: deployerAddress })
      await deployedCollateralToken.approve(deployedPendingOrders.address, amountBN, { from: runner })

      const createOrder = await deployedPendingOrders.createOrder(
        amountBN,
        isWhite,
        eventId,
        { from: runner }
      );

      const { logs: createOrderLog } = createOrder;
      const eventCount = 1;
      assert.equal(createOrderLog.length, eventCount, `triggers must be ${eventCount} event`);

      expectEvent.inLogs(createOrderLog, 'OrderCreated', {
        id: "0",
        user: runner,
        amount: amountBN
      });


      await deployedCollateralToken.transfer(runner2, amountBN, { from: deployerAddress })
      await deployedCollateralToken.approve(deployedPendingOrders.address, amountBN, { from: runner2 })

      const createOrder2 = await deployedPendingOrders.createOrder(
        amountBN,
        false,
        eventId,
        { from: runner2 }
      );

      const { logs: createOrderLog2 } = createOrder2;

      assert.equal(createOrderLog2.length, eventCount, `triggers must be ${eventCount} event`);

      expectEvent.inLogs(createOrderLog2, 'OrderCreated', {
        id: "1",
        user: runner2,
        amount: amountBN
      });

      const eventDuration = time.duration.seconds(5);
      const eventStartExpected = await time.latest();
      const eventEndExpected = eventStartExpected.add(eventDuration);
      const priceChangePart = ntob(0.05);
      const eventResult = "1";

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

      await time.increase(eventDuration);

      await expectRevert(
        deployedEventLifeCycle.endEvent(
          eventResult
        ),
        "Cannot buyback more than sold from the pool",
      );

      const bwTokensAmount = ntob(2.1);
      const tokensAmount = mntob(2.1, multiplier);
      const startPrice = mntob(0.5, multiplier);


      const addLiquidity = await deployedPredictionPool.addLiquidity(
        tokensAmount,
        { from: deployerAddress }
      );
      const { logs: addLiquidityLog } = addLiquidity;

      expectEvent.inLogs(addLiquidityLog, 'AddLiquidity', {
        user: deployerAddress,
        whitePrice: startPrice,              // "0.5",
        blackPrice: startPrice,              // "0.5",
        bwAmount: bwTokensAmount,            // "1000",
        colaterallAmount: tokensAmount       // "1000"
      });

      const endEvent = await deployedEventLifeCycle.endEvent(
        eventResult
      );

      const { logs: endEventLog } = endEvent;
      const eventLogCount = 1;
      assert.equal(endEventLog.length, eventLogCount, `triggers must be ${eventLogCount} event`);


    })

    it("buyBlack", async function () {
      const collateralAmountToBuy = mntob(1, multiplier);
      const buyPayment = mntob(1, multiplier);

      const maxBlackOrWhitePrice = mntob(0.5, multiplier);

      const collateralTokenDeployerBalance = await deployedCollateralToken.balanceOf(deployerAddress);

      expect(collateralTokenDeployerBalance).to.be.bignumber.at.least(collateralAmountToBuy);

      await expectRevert(
        deployedPredictionPool.buyBlack(
          mntob(0.05, multiplier),
          buyPayment,
          { from: deployerAddress }
        ),
        "Actual price is higher than acceptable by the user",
      );

      const feePP = await deployedPredictionPool.FEE();

      const buyBlack = await deployedPredictionPool.buyBlack(
        maxBlackOrWhitePrice,
        buyPayment,
        { from: deployerAddress }
      );
      const { logs: buyBlackLog } = buyBlack;

      const eventCount = 4;
      assert.equal(buyBlackLog.length, eventCount, `triggers must be ${eventCount} event`);

      let blackBought = new bigDecimal(buyPayment.toString())
        .divide(new bigDecimal(maxBlackOrWhitePrice.toString(10)), 18)
        .multiply(new bigDecimal(BONE.toString(10)))

      const fee = blackBought.multiply(new bigDecimal((0.003 * multiplier).toString(10)))
        .divide(new bigDecimal(multiplier.toString(10)))
        .floor()

      blackBought = blackBought.subtract(fee);

      expectEvent.inLogs(buyBlackLog, 'BuyBlack', {
        user: deployerAddress,
        amount: blackBought.getValue(),
        price: maxBlackOrWhitePrice
      });

      const anotherOrderer = accounts[7]
      await deployedPredictionPool.changeOrderer(
        anotherOrderer,
        { from: deployerAddress }
      );
      await deployedPredictionPool.setOnlyOrderer(
        true,
        { from: deployerAddress }
      );

      await expectRevert(
        deployedPredictionPool.buyBlack(
          maxBlackOrWhitePrice,
          buyPayment,
          { from: deployerAddress }
        ),
        "Incorrerct orderer",
      );

      return expect(
        await deployedBlackToken.balanceOf(deployerAddress)
      ).to.be.bignumber.equal(blackBought.getValue());
    });

    it("buyWhite", async function () {
      const collateralAmountToBuy = mntob(1e5, multiplier);
      const buyPayment = mntob(5, multiplier);

      const initialBlackOrWhitePrice = mntob(0.5, multiplier);

      const collateralTokenDeployerBalance = await deployedCollateralToken.balanceOf(deployerAddress);

      expect(collateralTokenDeployerBalance).to.be.bignumber.at.least(collateralAmountToBuy);

      const buyWhite = await deployedPredictionPool.buyWhite(
        initialBlackOrWhitePrice,
        buyPayment,
        { from: deployerAddress }
      );
      const { logs: buyWhiteLog } = buyWhite;

      const eventCount = 4;
      assert.equal(buyWhiteLog.length, eventCount, `triggers must be ${eventCount} event`);

      const whiteBought = new BN("9970000000000000000");

      expectEvent.inLogs(buyWhiteLog, 'BuyWhite', {
        user: deployerAddress,
        amount: whiteBought,
        price: initialBlackOrWhitePrice
      });

      return expect(
        await deployedWhiteToken.balanceOf(deployerAddress)
      ).to.be.bignumber.equal(whiteBought);
    });

    it("addCollateral", async function() {
      const addForWhiteAmount = mntob(5, multiplier);
      const addForBlackAmount = mntob(3, multiplier);

      const buyPayment = mntob(5, multiplier);
      const initialBlackOrWhitePrice = mntob(0.5, multiplier);
      await deployedPredictionPool.buyBlack(
        initialBlackOrWhitePrice,
        buyPayment,
        { from: deployerAddress }
      );

      const initialCollateralForBlack = await deployedPredictionPool._collateralForBlack();
      const initialCollateralForWhite = await deployedPredictionPool._collateralForWhite();

      const collateralTokenDeployerBalance = await deployedCollateralToken.balanceOf(deployerAddress);

      const sumAddition = addForWhiteAmount.add(addForBlackAmount);
      expect(collateralTokenDeployerBalance).to.be.bignumber.at.least(sumAddition);

      await deployedPredictionPool.addCollateral(
        addForWhiteAmount,
        addForBlackAmount,
        { from: deployerAddress }
      );

      const newCollateralForBlack = await deployedPredictionPool._collateralForBlack();
      const newCollateralForWhite = await deployedPredictionPool._collateralForWhite();

      expect(newCollateralForBlack).to.be.bignumber.equal(addForBlackAmount.add(initialCollateralForBlack));

      expect(newCollateralForWhite).to.be.bignumber.equal(addForWhiteAmount.add(initialCollateralForWhite));

    });
  });
})

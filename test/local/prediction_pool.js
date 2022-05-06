const {
  BN,           // Big Number support
  constants,    // Common constants, like the zero address and largest integers
  expectEvent,  // Assertions for emitted events
  expectRevert, // Assertions for transactions that should fail
  snapshot
} = require('@openzeppelin/test-helpers');

const bigDecimal = require('js-big-decimal');

const chai = require('chai');
const expect = require('chai').expect;

const { deployContracts, ntob, BONE } = require('./../utils.js');

contract("DEV: PredictionPool", (accounts) => {
  "use strict";

  const [ deployerAddress ] = accounts;

  let deployedPredictionPool;
  let deployedPredictionCollateralization;
  let deployedCollateralToken;
  let deployedWhiteToken;
  let deployedBlackToken;

  let snapshotA;

  before(async () => {

  });

  beforeEach(async () => {
    const deployedContracts = await deployContracts(deployerAddress);

    deployedPredictionPool = deployedContracts.deployedPredictionPool;
    deployedPredictionCollateralization = deployedContracts.deployedPredictionCollateralization;
    deployedCollateralToken = deployedContracts.deployedCollateralToken;
    deployedWhiteToken = deployedContracts.deployedWhiteToken;
    deployedBlackToken = deployedContracts.deployedBlackToken;
  });

  afterEach(async () => {

  });

  it("should assert PredictionPool address equal PredictionCollateralization._poolAddress()", async function () {
    return assert.equal(deployedPredictionPool.address, await deployedPredictionCollateralization._poolAddress());
  });

  it("should assert collateralTokentotalSupply equal collateralTokenDeployerBalance", async function () {
    const collateralTokentotalSupply = await deployedCollateralToken.totalSupply();
    const collateralTokenDeployerBalance = await deployedCollateralToken.balanceOf(deployerAddress);
    // return assert.equal(collateralTokentotalSupply, collateralTokenDeployerBalance);
    return expect(collateralTokentotalSupply).to.be.bignumber.equal(collateralTokenDeployerBalance);
  });

  it("should assert PredictionCollateralization address equal PredictionPool._thisCollateralization()", async function () {
    return assert.equal(await deployedPredictionPool._thisCollateralization(), deployedPredictionCollateralization.address);
  });

  it("addLiquidity and withdrawLiquidity", async function () {
    const tokensAmount = ntob(1000)
    const bwTokensAmount = ntob(1000)
    const blackTokensAmount = ntob(1000)
    const whiteTokensAmount = ntob(1000)
    const totalCollateralTokensAmount = ntob(10000000000000)
    const forWhiteAmount = ntob(500)
    const forBlackAmount = ntob(500)

    const startPrice = ntob(0.5)

    const sPrice = startPrice.add(startPrice);
    expect(sPrice).to.be.bignumber.equal(ntob(1));

    const bwAmnt = new bigDecimal(tokensAmount.toString())
      .divide(new bigDecimal(sPrice.toString(10)), 18);

    const forWhite = bwAmnt.multiply(new bigDecimal(startPrice.toString(10))).getValue()

    const forBlack = bwAmnt.multiply(new bigDecimal(startPrice.toString(10))).getValue()

    const bwAmount = new BN(
      bwAmnt.multiply(new bigDecimal(BONE.toString(10))).getValue()
    );

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
      whitePrice: ntob(0.5),              // "500000000000000000",
      blackPrice: ntob(0.5),              // "500000000000000000",
      bwAmount: bwTokensAmount,             // "1000000000000000000000",
      colaterallAmount: tokensAmount      // "1000000000000000000000"
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
      whitePrice: ntob(0.5),              // "500000000000000000",
      blackPrice: ntob(0.5),              // "500000000000000000",
      bwAmount: bwTokensAmount,           // "1000000000000000000000",
      colaterallAmount: bwTokensAmount    // "1000000000000000000000"
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

  it("buyBlack", async function () {
    const collateralAmountToBuy = new BN("100000000000000000000000");
    const buyPayment = new BN("5000000000000000000");

    const initialBlackOrWhitePrice = new BN("500000000000000000");

    const collateralTokenDeployerBalance = await deployedCollateralToken.balanceOf(deployerAddress);

    expect(collateralTokenDeployerBalance).to.be.bignumber.at.least(collateralAmountToBuy);

    const buyBlack = await deployedPredictionPool.buyBlack(
      initialBlackOrWhitePrice,
      buyPayment,
      { from: deployerAddress }
    );
    const { logs: buyBlackLog } = buyBlack;

    const eventCount = 4;
    assert.equal(buyBlackLog.length, eventCount, `triggers must be ${eventCount} event`);

    const blackBought = new BN("9970000000000000000");

    expectEvent.inLogs(buyBlackLog, 'BuyBlack', {
      user: deployerAddress,
      amount: blackBought,
      price: initialBlackOrWhitePrice
    });

    return expect(
      await deployedBlackToken.balanceOf(deployerAddress)
    ).to.be.bignumber.equal(blackBought);
  });

  it("buyWhite", async function () {
    const collateralAmountToBuy = new BN("100000000000000000000000");
    const buyPayment = new BN("5000000000000000000");

    const initialBlackOrWhitePrice = new BN("500000000000000000");

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
    const addForWhiteAmount = new BN("5000000000000000000");
    const addForBlackAmount = new BN("3000000000000000000");

    const buyPayment = new BN("5000000000000000000");
    const initialBlackOrWhitePrice = new BN("500000000000000000");
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

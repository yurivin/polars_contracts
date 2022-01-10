const {
  BN,           // Big Number support
  constants,    // Common constants, like the zero address and largest integers
  expectEvent,  // Assertions for emitted events
  expectRevert, // Assertions for transactions that should fail
  snapshot
} = require('@openzeppelin/test-helpers');

const chai = require('chai');
const expect = require('chai').expect;

const PredictionPool = artifacts.require("PredictionPool");
const PredictionCollateralization = artifacts.require("PredictionCollateralization");
const TokenTemplate = artifacts.require("TokenTemplate");

contract("PredictionPool", (accounts) => {
  "use strict";

  const deployerAddress = accounts[0];

  let deployedPredictionPool;
  let deployedPredictionCollateralization;
  let deployedCollateralToken;
  let whiteToken;
  let blackToken;

  let snapshotA;

  before(async () => {
    deployedPredictionPool = await PredictionPool.deployed();
    deployedPredictionCollateralization = await PredictionCollateralization.deployed();
    deployedCollateralToken = await TokenTemplate.deployed();
    whiteToken = await TokenTemplate.at(await deployedPredictionCollateralization._whiteToken());
    blackToken = await TokenTemplate.at(await deployedPredictionCollateralization._blackToken());
    snapshotA = await snapshot();
  });

  afterEach(async () => {
      await snapshotA.restore()
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

    const eventCount = 1;
    assert.equal(buyBlackLog.length, eventCount, `triggers must be ${eventCount} event`);

    const blackBought = new BN("9970000000000000000");

    expectEvent.inLogs(buyBlackLog, 'BuyBlack', {
      user: deployerAddress,
      amount: blackBought,
      price: initialBlackOrWhitePrice
    });

    return expect(
      await blackToken.balanceOf(deployerAddress)
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

    const eventCount = 1;
    assert.equal(buyWhiteLog.length, eventCount, `triggers must be ${eventCount} event`);

    const whiteBought = new BN("9970000000000000000");

    expectEvent.inLogs(buyWhiteLog, 'BuyWhite', {
      user: deployerAddress,
      amount: whiteBought,
      price: initialBlackOrWhitePrice
    });

    return expect(
      await whiteToken.balanceOf(deployerAddress)
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

    const initialCollateralForBlack = deployedPredictionPool._collateralForBlack();
    const initialCollateralForWhite = deployedPredictionPool._collateralForWhite();
    
    const collateralTokenDeployerBalance = await deployedCollateralToken.balanceOf(deployerAddress);
    expect(collateralTokenDeployerBalance).to.be.bignumber.at.least(addForWhiteAmount.add(addForBlackAmount));

    await deployedPredictionPool.addCollateral(
      addForWhiteAmount, 
      addForBlackAmount, 
      { from: deployerAddress });

    const newCollateralForBlack = await deployedPredictionPool._collateralForBlack();
    const newCollateralForWhite = await deployedPredictionPool._collateralForWhite();

    expect(newCollateralForBlack).to.be.bignumber.equal(addForBlackAmount.add(initialCollateralForBlack));

    expect(newCollateralForWhite).to.be.bignumber.equal(addForWhiteAmount);

  });
});

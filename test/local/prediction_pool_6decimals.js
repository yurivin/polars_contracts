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

// const { deployContracts, ntob, BONE } = require('./../utils.js');
const { ntob, BONE } = require('./../utils.js');

const PendingOrders = artifacts.require('PendingOrders');
const PredictionPool = artifacts.require('PredictionPool');
const PredictionCollateralization = artifacts.require('PredictionCollateralization');
const TokenTemplate = artifacts.require('TokenTemplate');
const EventLifeCycle = artifacts.require('EventLifeCycle');
const OracleSwapEventManager = artifacts.require("OracleSwapEventManager");
const OracleChainlinkEventManager = artifacts.require("OracleChainLinkEventManager");
const OraclePayableChainLinkEventManager = artifacts.require("OraclePayableChainLinkEventManager");
const Leverage = artifacts.require("Leverage");

const collateralTokenDecimals = "6";
const multiplier = 10 ** parseInt(collateralTokenDecimals);

const deployContracts = async (deployerAddress, debug=0) => {

  const initialBlackOrWhitePrice = new BN((0.5*multiplier).toString(10));
  const collateralTokenName = "Collateral Token";
  const collateralTokenSymbol = "COL";
  // const collateralTokenSupply = new BN("10000000000000000000000000000000");

  // const collateralTokenDecimals = "18";



  // const collateralTokenName = "Collateral Token";
  // const collateralTokenSymbol = "COL";
  const collateralTokenSupply = new BN((1e13 * multiplier).toString(10));


  const whiteName = "Polars White";
  const whiteSymbol = "WHITE";
  const blackName = "Polars Black";
  const blackSymbol = "BLACK";

  const approveValue = constants.MAX_UINT256;

  const deployedCollateralToken = await TokenTemplate.new(
    collateralTokenName,
    collateralTokenSymbol,
    collateralTokenDecimals,
    deployerAddress,
    collateralTokenSupply,
    { from: deployerAddress }
  );
  const deployedPredictionCollateralization = await PredictionCollateralization.new(
    deployerAddress,
    deployedCollateralToken.address,
    whiteName,
    whiteSymbol,
    blackName,
    blackSymbol,
    { from: deployerAddress }
  );
  const deployedWhiteToken = await TokenTemplate.at(await deployedPredictionCollateralization._whiteToken());
  const deployedBlackToken = await TokenTemplate.at(await deployedPredictionCollateralization._blackToken());

  const deployedPredictionPool = await PredictionPool.new(
    deployedPredictionCollateralization.address,
    deployedCollateralToken.address,
    deployedWhiteToken.address,
    deployedBlackToken.address,
    initialBlackOrWhitePrice,
    initialBlackOrWhitePrice,
    { from: deployerAddress }
  );

  let result = await deployedPredictionPool.init(
    deployerAddress,
    deployerAddress,
    deployerAddress,
    deployerAddress,
    false,
    { from: deployerAddress }
  );
  await deployedPredictionCollateralization.changePoolAddress(
    deployedPredictionPool.address,
    { from: deployerAddress }
  );

  const deployedEventLifeCycle = await EventLifeCycle.new(
    deployerAddress,
    deployerAddress,
    deployedPredictionPool.address,
    { from: deployerAddress }
  );

  await deployedPredictionPool.changeEventContractAddress(
    deployedEventLifeCycle.address,
    { from: deployerAddress }
  );

  const deployedPendingOrders = await PendingOrders.new(
    deployedPredictionPool.address,
    deployedCollateralToken.address,
    deployedEventLifeCycle.address,
    { from: deployerAddress }
  );

  await deployedEventLifeCycle.setPendingOrders(
    deployedPendingOrders.address,
    true,
    { from: deployerAddress }
  );

  // Approves for Secondary collateral & pool
  await deployedCollateralToken.approve(deployedPredictionCollateralization.address, approveValue);
  await deployedWhiteToken.approve(deployedPredictionCollateralization.address, approveValue);
  await deployedBlackToken.approve(deployedPredictionCollateralization.address, approveValue);
  await deployedCollateralToken.approve(deployedPendingOrders.address, approveValue);
  await deployedCollateralToken.approve(deployedPredictionPool.address, approveValue);

  const deployedOracleSwapEventManager = await OracleSwapEventManager.new(
    deployedEventLifeCycle.address,
    deployedPredictionPool.address,
    new BN("50000000000000000"),
    new BN("1800"),
    new BN("1800")
  );

  const deployedOracleChainlinkEventManager = await OracleChainlinkEventManager.new(
    deployedEventLifeCycle.address,
    deployedPredictionPool.address,
    new BN("50000000000000000"),
    new BN("1800"),
    new BN("1800")
  );

  const deployedOraclePayableChainLinkEventManager = await OraclePayableChainLinkEventManager.new(
    deployedEventLifeCycle.address,
    deployedPredictionPool.address,
    new BN("50000000000000000"),
    new BN("1800"),
    new BN("1800")
  );

  const deployedLeverage = await Leverage.new(
    deployedCollateralToken.address,  // address collateralTokenAddress
    deployedPendingOrders.address     // address pendingOrdersAddress
  );

  if (debug) console.log("Collateral token                    :", deployedCollateralToken.address);
  if (debug) console.log("PredictionCollateral                :", deployedPredictionCollateralization.address);
  if (debug) console.log("WhiteToken                          :", deployedWhiteToken.address);
  if (debug) console.log("BlackToken                          :", deployedBlackToken.address);
  if (debug) console.log("PredictionPool                      :", deployedPredictionPool.address);
  if (debug) console.log("Gov address                         :", (await deployedPredictionCollateralization._governanceAddress()));
  if (debug) console.log("PredictionPool                      :", (await deployedPredictionCollateralization._poolAddress()));
  if (debug) console.log("EventLifeCycle                      :", (await deployedEventLifeCycle.address));
  if (debug) console.log("PendingOrders                       :", (await deployedPendingOrders.address));
  if (debug) console.log("OracleSwapEventManager              :", (await deployedOracleSwapEventManager.address));
  if (debug) console.log("OracleChainlinkEventManager         :", (await deployedOracleChainlinkEventManager.address));
  if (debug) console.log("OraclePayableChainLinkEventManager  :", (await deployedOraclePayableChainLinkEventManager.address));
  if (debug) console.log("deployedLeverage                    :", (await deployedLeverage.address));
  if (debug) console.log("deployedCollateralToken.owner()     :", (await deployedCollateralToken.owner()));
  if (debug) console.log("deployedPendingOrders.owner()       :", (await deployedPendingOrders.owner()));
  if (debug) console.log("whiteToken.owner()                  :", (await deployedWhiteToken.owner()));
  if (debug) console.log("blackToken.owner()                  :", (await deployedBlackToken.owner()));


  return {
    deployedCollateralToken,
    deployedPredictionCollateralization,
    deployedPredictionPool,
    deployedEventLifeCycle,
    deployedPendingOrders,
    deployedWhiteToken,
    deployedBlackToken,
    deployedOracleSwapEventManager,
    deployedOracleChainlinkEventManager,
    deployedOraclePayableChainLinkEventManager,
    deployedLeverage
  }
}

contract.only("DEV: PredictionPool 6 Decimals", (accounts) => {
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
    console.log("Collateral token                    :", deployedCollateralToken.address);
    console.log("Collateral token decimals           :", (await deployedCollateralToken.decimals()).toString());
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

    const collateralAmountToBuy = new BN((1e5 * multiplier).toString(10)); // new BN("100000 000000000000000000")
    const buyPayment = new BN((5 * multiplier).toString(10)); // new BN("5000000000000000000");

    const initialBlackOrWhitePrice = new BN((0.5 * multiplier).toString(10)); // new BN("500000000000000000");

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

  it("addLiquidity and withdrawLiquidity", async function () {
    const tokensAmount = ntob(1000)
    const bwTokensAmount = ntob(1000)
    const blackTokensAmount = ntob(1000)
    const whiteTokensAmount = ntob(1000)
    const totalCollateralTokensAmount = ntob(10000000000000)
    const forWhiteAmount = ntob(500)
    const forBlackAmount = ntob(500)

    const startPrice = new BN((0.5 * multiplier).toString(10)); // ntob(0.5)

    const sPrice = startPrice.add(startPrice);
    // expect(sPrice).to.be.bignumber.equal(ntob(1));
    expect(sPrice).to.be.bignumber.equal(new BN((1 * multiplier).toString(10)));

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
    // const collateralAmountToBuy = new BN("100000000000000000000000");
    const collateralAmountToBuy = new BN((1 * multiplier).toString(10)); // new BN("1000000");
    const buyPayment = new BN((1 * multiplier).toString(10)); // new BN("1000000");

    // const initialBlackOrWhitePrice = new BN("500000000000000000");
    const maxBlackOrWhitePrice = new BN((0.5 * multiplier).toString(10)); // new BN("50000");

    const collateralTokenDeployerBalance = await deployedCollateralToken.balanceOf(deployerAddress);

    expect(collateralTokenDeployerBalance).to.be.bignumber.at.least(collateralAmountToBuy);

    await expectRevert(
      deployedPredictionPool.buyBlack(
        new BN((0.05 * multiplier).toString(10)),
        buyPayment,
        { from: deployerAddress }
      ),
      "Actual price is higher than acceptable by the user",
    );

    const buyBlack = await deployedPredictionPool.buyBlack(
      maxBlackOrWhitePrice,
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
    ).to.be.bignumber.equal(blackBought);
  });

  it("buyWhite", async function () {
    const collateralAmountToBuy = new BN((1e5 * multiplier).toString(10)); // new BN("100000000000000000000000");
    const buyPayment = new BN((5 * multiplier).toString(10)); // new BN("5000000000000000000");

    const initialBlackOrWhitePrice = new BN((0.5 * multiplier).toString(10)); // new BN("500000000000000000");

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
    const addForWhiteAmount = new BN((5 * multiplier).toString(10)); // new BN("5000000000000000000");
    const addForBlackAmount = new BN((3 * multiplier).toString(10)); // new BN("3000000000000000000");

    const buyPayment = new BN((5 * multiplier).toString(10)); // new BN("5000000000000000000");
    const initialBlackOrWhitePrice = new BN((0.5 * multiplier).toString(10)); // new BN("500000000000000000");
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

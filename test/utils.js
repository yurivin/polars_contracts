const {
  BN,           // Big Number support
  time,
  constants,    // Common constants, like the zero address and largest integers
  expectEvent,  // Assertions for emitted events
  expectRevert, // Assertions for transactions that should fail
  snapshot
} = require('@openzeppelin/test-helpers');

const bigDecimal = require('js-big-decimal');

const BONE = 10**18;

const PendingOrders = artifacts.require('PendingOrders');
const PredictionPool = artifacts.require('PredictionPool');
const PredictionCollateralization = artifacts.require('PredictionCollateralization');
const TokenTemplate = artifacts.require('TokenTemplate');
const EventLifeCycle = artifacts.require('EventLifeCycle');
const OracleSwapEventManager = artifacts.require("OracleSwapEventManager");

const deployContracts = async (deployerAddress, debug=0) => {
  const collateralTokenDecimals = "18";
  const initialBlackOrWhitePrice = new BN("500000000000000000");
  const collateralTokenName = "Collateral Token";
  const collateralTokenSymbol = "COL";
  const collateralTokenSupply = new BN("10000000000000000000000000000000");

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

  if (debug) console.log("Collateral token                :", deployedCollateralToken.address);
  if (debug) console.log("PredictionCollateral            :", deployedPredictionCollateralization.address);
  if (debug) console.log("WhiteToken                      :", deployedWhiteToken.address);
  if (debug) console.log("BlackToken                      :", deployedBlackToken.address);
  if (debug) console.log("PredictionPool                  :", deployedPredictionPool.address);
  if (debug) console.log("Gov address                     :", (await deployedPredictionCollateralization._governanceAddress()));
  if (debug) console.log("PredictionPool                  :", (await deployedPredictionCollateralization._poolAddress()));
  if (debug) console.log("EventLifeCycle                  :", (await deployedEventLifeCycle.address));
  if (debug) console.log("PendingOrders                   :", (await deployedPendingOrders.address));
  if (debug) console.log("OracleSwapEventManager          :", (await deployedOracleSwapEventManager.address));
  if (debug) console.log("deployedCollateralToken.owner() :", (await deployedCollateralToken.owner()));
  if (debug) console.log("deployedPendingOrders.owner()   :", (await deployedPendingOrders.owner()));
  if (debug) console.log("whiteToken.owner()              :", (await deployedWhiteToken.owner()));
  if (debug) console.log("blackToken.owner()              :", (await deployedBlackToken.owner()));


  return {
    deployedCollateralToken,
    deployedPredictionCollateralization,
    deployedPredictionPool,
    deployedEventLifeCycle,
    deployedPendingOrders,
    deployedWhiteToken,
    deployedBlackToken,
    deployedOracleSwapEventManager
  }
}

const ntob = (number) => {
  const amountBD = new bigDecimal(number.toString(10))
    .multiply(new bigDecimal(BONE.toString(10)))
    .getValue();
  return new BN(amountBD);
}

module.exports = {
  deployContracts,
  ntob,
  BONE
};

const {
  BN,           // Big Number support
  constants,    // Common constants, like the zero address and largest integers
  expectEvent,  // Assertions for emitted events
  expectRevert, // Assertions for transactions that should fail
} = require('@openzeppelin/test-helpers');

const chai = require('chai');
const expect = require('chai').expect;

const { deployContracts } = require('./../utils.js');

contract("DEV: Approves", (accounts) => {
  "use strict";

  const [ deployerAddress ] = accounts;

  const approveValue = constants.MAX_UINT256;

  let deployedPredictionPool;
  let deployedEventLifeCycle;
  let deployedPendingOrders;
  let deployedCollateralToken;
  let deployedWhiteToken;
  let deployedBlackToken;
  let deployedPredictionCollateralization;

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

  it("should assert approveValue equal deployer's CollateralToken allowance count for PredictionCollateralization", async function () {
    return expect(
      await deployedCollateralToken.allowance(deployerAddress, deployedPredictionCollateralization.address)
    ).to.be.bignumber.equal(approveValue);
  });

  it("should assert approveValue equal deployer's CollateralToken allowance count for PredictionPool", async function () {
    return expect(
      await deployedCollateralToken.allowance(deployerAddress, deployedPredictionPool.address)
    ).to.be.bignumber.equal(approveValue);
  });

  it("should assert approveValue equal deployer's whiteToken allowance count for PredictionCollateralization", async function () {
    return expect(
      await deployedWhiteToken.allowance(deployerAddress, deployedPredictionCollateralization.address)
    ).to.be.bignumber.equal(approveValue);
  });

  it("should assert approveValue equal deployer's blackToken allowance count for PredictionCollateralization", async function () {
    return expect(
      await deployedBlackToken.allowance(deployerAddress, deployedPredictionCollateralization.address)
    ).to.be.bignumber.equal(approveValue);
  });

  it("should assert approveValue equal deployer's CollateralToken allowance count for PendingOrders", async function () {
    return expect(
      await deployedCollateralToken.allowance(deployerAddress, deployedPendingOrders.address)
    ).to.be.bignumber.equal(approveValue);
  });
});

const {
  BN,           // Big Number support
  constants,    // Common constants, like the zero address and largest integers
  expectEvent,  // Assertions for emitted events
  expectRevert, // Assertions for transactions that should fail
} = require('@openzeppelin/test-helpers');

const chai = require('chai');
const expect = require('chai').expect;

const PredictionPool = artifacts.require("PredictionPool");
const PredictionCollateralization = artifacts.require("PredictionCollateralization");
const TokenTemplate = artifacts.require("TokenTemplate");
const PendingOrders = artifacts.require("PendingOrders");

/*
 * uncomment accounts to access the test accounts made available by the
 * Ethereum client
 * See docs: https://www.trufflesuite.com/docs/truffle/testing/writing-tests-in-javascript
 */
contract("Approves", (accounts) => {
  "use strict";

  const deployerAddress = accounts[0];

  const approveValue = new BN("999999999999999999999999999999999999");

  let deployedPredictionPool;
  let deployedPredictionCollateralization;
  let deployedCollateralToken;
  let deployedPendingOrders;
  let whiteToken;
  let blackToken;

  before(async () => {
    deployedPredictionPool = await PredictionPool.deployed();
    deployedPredictionCollateralization = await PredictionCollateralization.deployed();
    deployedPendingOrders = await PendingOrders.deployed();
    deployedCollateralToken = await TokenTemplate.deployed();
    whiteToken = await TokenTemplate.at(await deployedPredictionCollateralization._whiteToken());
    blackToken = await TokenTemplate.at(await deployedPredictionCollateralization._blackToken());
  })

  it("should assert approveValue equal deployer's CollateralToken allowance count for PredictionCollateralization", async function () {
    return expect(
      await deployedCollateralToken.allowance(deployerAddress, deployedPredictionCollateralization.address)
    ).to.be.bignumber.equal(approveValue);
  });

  it("should assert approveValue equal deployer's whiteToken allowance count for PredictionCollateralization", async function () {
    return expect(
      await whiteToken.allowance(deployerAddress, deployedPredictionCollateralization.address)
    ).to.be.bignumber.equal(approveValue);
  });

  it("should assert approveValue equal deployer's blackToken allowance count for PredictionCollateralization", async function () {
    return expect(
      await blackToken.allowance(deployerAddress, deployedPredictionCollateralization.address)
    ).to.be.bignumber.equal(approveValue);
  });

  it("should assert approveValue equal deployer's CollateralToken allowance count for PendingOrders", async function () {
    return expect(
      await deployedCollateralToken.allowance(deployerAddress, deployedPendingOrders.address)
    ).to.be.bignumber.equal(approveValue);
  });
});

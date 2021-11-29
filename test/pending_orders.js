const {
  BN,           // Big Number support
  constants,    // Common constants, like the zero address and largest integers
  expectEvent,  // Assertions for emitted events
  expectRevert, // Assertions for transactions that should fail
} = require('@openzeppelin/test-helpers');

const chai = require('chai');
const expect = require('chai').expect;

const PendingOrders = artifacts.require("PendingOrders");
const EventLifeCycle = artifacts.require("EventLifeCycle");
const PredictionPool = artifacts.require("PredictionPool");
const TokenTemplate = artifacts.require("TokenTemplate");

contract("PendingOrders", function (accounts) {
  let deployedPredictionPool;
  let deployedEventLifeCycle;
  let deployedPendingOrders;
  let deployedCollateralToken;

  const deployerAddress = accounts[0];

  before(async () => {
    deployedPredictionPool = await PredictionPool.deployed();
    deployedEventLifeCycle = await EventLifeCycle.deployed();
    deployedEventLifeCycle = await EventLifeCycle.deployed();
    deployedPendingOrders = await PendingOrders.deployed();
    deployedCollateralToken = await TokenTemplate.deployed();
  })

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
});

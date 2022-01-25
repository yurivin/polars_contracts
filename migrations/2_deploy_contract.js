const PendingOrders = artifacts.require("PendingOrders");
const PredictionPool = artifacts.require("PredictionPool");
const PredictionCollateralization = artifacts.require("PredictionCollateralization");
const TokenTemplate = artifacts.require("TokenTemplate");
const EventLifeCycle = artifacts.require("EventLifeCycle");

const {
  BN,           // Big Number support
  constants,    // Common constants, like the zero address and largest integers
  expectEvent,  // Assertions for emitted events
  expectRevert, // Assertions for transactions that should fail
} = require('@openzeppelin/test-helpers');

const chai = require('chai');
const expect = require('chai').expect;

const collateralTokenDecimals = "18";
const initialBlackOrWhitePrice = new BN("500000000000000000");
const collateralTokenName = "Collateral Token";
const collateralTokenSymbol = "COL";
const collateralTokenSupply = new BN("10000000000000000000000000000000");

const whiteName = "Polars White";
const whiteSymbol = "WHITE";
const blackName = "Polars Black";
const blackSymbol = "BLACK";

const approveValue = new BN("999999999999999999999999999999999999");

module.exports = async(deployer, network, accounts) => {
    const deployerAddress = accounts[0];
    console.log(accounts);

    if (network == "development" || network == "soliditycoverage" ) {
        await deployer.deploy(
            TokenTemplate,
            collateralTokenName,
            collateralTokenSymbol,
            collateralTokenDecimals,
            deployerAddress,
            collateralTokenSupply
        );
        const deployedCollateralToken = await TokenTemplate.deployed();
        console.log("Collateral token:        " + deployedCollateralToken.address);

        await deployer.deploy(
            PredictionCollateralization,
            deployerAddress,
            deployedCollateralToken.address,
            whiteName,
            whiteSymbol,
            blackName,
            blackSymbol
        );
        const deployedPredictionCollateralization = await PredictionCollateralization.deployed();

        const whiteToken = await TokenTemplate.at(await deployedPredictionCollateralization._whiteToken());
        const blackToken = await TokenTemplate.at(await deployedPredictionCollateralization._blackToken());
        console.log("PredictionCollateral:    " + deployedPredictionCollateralization.address);
        console.log("WhiteToken:              " + whiteToken.address);
        console.log("BlackToken:              " + blackToken.address);

        await deployer.deploy(
            PredictionPool,
            deployedPredictionCollateralization.address,
            deployedCollateralToken.address,
            whiteToken.address,
            blackToken.address,
            initialBlackOrWhitePrice,
            initialBlackOrWhitePrice
        );
        const deployedPredictionPool = await PredictionPool.deployed();
        let result = await deployedPredictionPool.init(deployerAddress, deployerAddress, deployerAddress)

        console.log("PredictionPool:          " + deployedPredictionPool.address);
        console.log("Gov address:             " + await deployedPredictionCollateralization._governanceAddress());

        await deployedPredictionCollateralization.changePoolAddress(deployedPredictionPool.address);
        console.log("PredictionPool:          " + await deployedPredictionCollateralization._poolAddress());

        await deployer.deploy(
            EventLifeCycle,
            deployerAddress,
            deployerAddress,
            deployedPredictionPool.address
        );
        const deployedEventLifeCycle = await EventLifeCycle.deployed();
        console.log("EventLifeCycle:          " + await deployedEventLifeCycle.address);

        await deployedPredictionPool.changeEventContractAddress(deployedEventLifeCycle.address);

        await deployer.deploy(
            PendingOrders,
            deployedPredictionPool.address,
            deployedCollateralToken.address,
            deployedEventLifeCycle.address
        );
        const deployedPendingOrders = await PendingOrders.deployed();
        console.log("PendingOrders:           " + await deployedPendingOrders.address);

        await deployedEventLifeCycle.setPendingOrders(deployedPendingOrders.address, true);

        // prepareApproves

        // Approves for Secondary collateral & pool
        await deployedCollateralToken.approve(deployedPredictionCollateralization.address, approveValue);
        await whiteToken.approve(deployedPredictionCollateralization.address, approveValue);
        await blackToken.approve(deployedPredictionCollateralization.address, approveValue);
        await deployedCollateralToken.approve(deployedPendingOrders.address, approveValue);
        await deployedCollateralToken.approve(deployedPredictionPool.address, approveValue);

    } else {
        // Perform a different step otherwise.
    }
};

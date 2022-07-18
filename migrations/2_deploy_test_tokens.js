const TokenTemplate = artifacts.require("TokenTemplate");
const IPancakeRouter = artifacts.require("IPancakeRouter");
const IPancakeFactory = artifacts.require("IPancakeFactory");
const IPancakePair = artifacts.require("IPancakePair");

const PendingOrders = artifacts.require("PendingOrders");
const PredictionPool = artifacts.require("PredictionPool");
const PredictionCollateralization = artifacts.require("PredictionCollateralization");
const EventLifeCycle = artifacts.require("EventLifeCycle");
const OracleSwapEventManager = artifacts.require("OracleSwapEventManager");

const fs = require("fs");
const path = require("path");

const {
  BN,           // Big Number support
  time,
  constants,    // Common constants, like the zero address and largest integers
} = require('@openzeppelin/test-helpers');

const { mntob } = require('./../test/utils.js');

const approveValue = constants.MAX_UINT256;

// const collateralTokenDecimals = "6";
const collateralTokenDecimals = "18";

const multiplier = 10 ** parseInt(collateralTokenDecimals);

const collateralTokenName = "Collateral Token";
const collateralTokenSymbol = "COL";
const collateralTokenSupply = mntob(1e13, multiplier);


module.exports = async(deployer, network, accounts) => {
    const deployerAddress = accounts[0];

    if (network === 'development' || network === 'coverage' || network === 'soliditycoverage') {
        return;
    }

    const deployDirectory = `${__dirname}/../deployed`;
    const deployTestTokensFileName = path.join(deployDirectory, `1_${network}_test_tokens_addresses.json`);

    if (!fs.existsSync(deployDirectory)) fs.mkdirSync(deployDirectory);
    if (!fs.existsSync(deployTestTokensFileName)) fs.writeFileSync(deployTestTokensFileName, '{}');

    if (network === "mumbai" || network === "bsc_testnet" || network === 'rinkeby' || network === 'rinkeby2') {
        let deployedSTUsdToken;
        let deployedSTBNBToken;
        let deployedCollateralToken;

        const { stUsd, stBNB, collateralToken } = require(deployTestTokensFileName);

        if (!stUsd || (await web3.eth.getCode(stUsd) === "0x")) {
            await deployer.deploy(
                TokenTemplate,
                "STest USDT",
                "USDT",
                18,
                deployerAddress,
                "1000000000000000000000000000000000"
            )
            deployedSTUsdToken = await TokenTemplate.deployed();
            console.log("STUsd token:             " + deployedSTUsdToken.address);
        } else {
            deployedSTUsdToken = await TokenTemplate.at(stUsd);
        }
        if (!stBNB || (await web3.eth.getCode(stBNB) === "0x")) {
            await deployer.deploy(
                TokenTemplate,
                "STest BNB",
                "BNB",
                18,
                deployerAddress,
                "1000000000000000000000000000000000"
            )
            deployedSTBNBToken = await TokenTemplate.deployed();
            console.log("STBNB token:             " + deployedSTBNBToken.address);
        } else {
            deployedSTBNBToken = await TokenTemplate.at(stBNB);
        }
        if (!collateralToken || (await web3.eth.getCode(collateralToken) === "0x")) {
            await deployer.deploy(
                TokenTemplate,
                collateralTokenName,
                collateralTokenSymbol,
                collateralTokenDecimals,
                deployerAddress,
                collateralTokenSupply
            );
            deployedCollateralToken = await TokenTemplate.deployed();
            console.log("Collateral token:        " + deployedCollateralToken.address);
        } else {
            deployedCollateralToken = await TokenTemplate.at(collateralToken);
        }

        // write addresses to files
        const contractsAddresses = {
            stUsd: deployedSTUsdToken.address,
            stBNB: deployedSTBNBToken.address,
            collateralToken: deployedCollateralToken.address
        };

        fs.writeFileSync(deployTestTokensFileName, JSON.stringify(contractsAddresses, null, 2));
    } else {
        // Perform a different step otherwise.
    }


};

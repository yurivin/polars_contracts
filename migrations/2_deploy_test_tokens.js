const TokenTemplate = artifacts.require("TokenTemplate");
const IPancakeRouter01 = artifacts.require("IPancakeRouter01");
const IPancakeFactory = artifacts.require("IPancakeFactory");
const IPancakePair = artifacts.require("IPancakePair");

const PendingOrders = artifacts.require("PendingOrders");
const PredictionPool = artifacts.require("PredictionPool");
const PredictionCollateralization = artifacts.require("PredictionCollateralization");
// const TokenTemplate = artifacts.require("TokenTemplate");
const EventLifeCycle = artifacts.require("EventLifeCycle");
// const OracleEventManager = artifacts.require("OracleEventManager");
const OracleSwapEventManager = artifacts.require("OracleSwapEventManager");

const fs = require("fs");
const path = require("path");

const {
  BN,           // Big Number support
  time,
  constants,    // Common constants, like the zero address and largest integers
} = require('@openzeppelin/test-helpers');

const approveValue = constants.MAX_UINT256;

const collateralTokenDecimals = "18";
const initialBlackOrWhitePrice = new BN("500000000000000000");
const collateralTokenName = "Collateral Token";
const collateralTokenSymbol = "COL";
const collateralTokenSupply = new BN("10000000000000000000000000000000");

module.exports = async(deployer, network, accounts) => {
    const deployerAddress = accounts[0];

    if (network === 'development' || network === 'coverage' || network === 'soliditycoverage') {
        return;
    }

    const deployDirectory = `${__dirname}/../deployed`;
    const deployTestTokensFileName = path.join(deployDirectory, `1_${network}_test_tokens_addresses.json`);

    if (!fs.existsSync(deployDirectory)) fs.mkdirSync(deployDirectory);
    if (!fs.existsSync(deployTestTokensFileName)) fs.writeFileSync(deployTestTokensFileName, '{}');

    if (network === "bsc_testnet" || network === 'rinkeby' || network === 'rinkeby2') {
        let deployedSTUsdToken;
        let deployedSTBNBToken;
        let deployedCollateralToken;

        const { stUsd, stBNB, collateralToken } = require(deployTestTokensFileName);

        if (!stUsd || (await web3.eth.getCode(stUsd) === "0x")) {
            await deployer.deploy(
                TokenTemplate,
                "STest USDT111",
                "USDT111",
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

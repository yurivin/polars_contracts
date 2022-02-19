const TokenTemplate = artifacts.require("TokenTemplate");
const PredictionCollateralization = artifacts.require("PredictionCollateralization");
const PredictionPool = artifacts.require("PredictionPool");

const fs = require("fs");
const path = require("path");

const {
  BN,           // Big Number support
  constants,    // Common constants, like the zero address and largest integers
} = require('@openzeppelin/test-helpers');

const whiteName = "Polars White";
const whiteSymbol = "WHITE";
const blackName = "Polars Black";
const blackSymbol = "BLACK";

const initialBlackOrWhitePrice = new BN("500000000000000000");

const approveValue = constants.MAX_UINT256;

module.exports = async(deployer, network, accounts) => {
    const deployerAddress = accounts[0];

    if (network === 'development' || network === 'coverage' || network === 'soliditycoverage') {
        return;
    }

    const deployDirectory = `${__dirname}/../deployed`;
    const deployTestTokensFileName = path.join(deployDirectory, `1_${network}_test_tokens_addresses.json`);
    const deployMainContractsFileName = path.join(deployDirectory, `2_${network}_main_contracts_addresses.json`);

    let tokens;
    try {
        tokens = require(deployTestTokensFileName);

        if (!tokens.collateralToken) throw 'CollateralUndefined';
        if (await web3.eth.getCode(tokens.collateralToken) === "0x") throw 'CollateralNotContract';

    } catch(e) {
        console.log('\x1b[33m%s\x1b[33m\x1b[0m',
            `\n\nRUN TOKEN MIGRATIONS FIRST OR REPLACE TOKEN ADDRESSES`);
        console.log('\x1b[33m%s\x1b[33m\x1b[0m', e);
        return;
    }

    let deployedPredictionCollateralization;
    let whiteToken;
    let blackToken;
    try {
        if (!fs.existsSync(deployMainContractsFileName)) fs.writeFileSync(deployMainContractsFileName, '{}');

        const contractsAddresses = require(deployMainContractsFileName);

        const deployedCollateralToken = await TokenTemplate.at(tokens.collateralToken);

        if (!contractsAddresses.predictionCollateralization || (await web3.eth.getCode(contractsAddresses.predictionCollateralization) === "0x")) {
            await deployer.deploy(
                PredictionCollateralization,
                deployerAddress,
                deployedCollateralToken.address,
                whiteName,
                whiteSymbol,
                blackName,
                blackSymbol
            );

            deployedPredictionCollateralization = await PredictionCollateralization.deployed();

            await deployedCollateralToken.approve(deployedPredictionCollateralization.address, approveValue);

            whiteToken = await TokenTemplate.at(await deployedPredictionCollateralization._whiteToken());

            blackToken = await TokenTemplate.at(await deployedPredictionCollateralization._blackToken());

            console.log("PredictionCollateral:    " + deployedPredictionCollateralization.address);
            console.log("WhiteToken:              " + whiteToken.address);
            console.log("BlackToken:              " + blackToken.address);

            await whiteToken.approve(deployedPredictionCollateralization.address, approveValue);
            await blackToken.approve(deployedPredictionCollateralization.address, approveValue);

            contractsAddresses.predictionCollateralization = deployedPredictionCollateralization.address;
            contractsAddresses.whiteToken = whiteToken.address;
            contractsAddresses.blackToken = blackToken.address;
            fs.writeFileSync(deployMainContractsFileName, JSON.stringify(contractsAddresses, null, 2));
        } else {
            deployedPredictionCollateralization = await PredictionCollateralization.at(contractsAddresses.predictionCollateralization);
            whiteToken = await TokenTemplate.at(await deployedPredictionCollateralization._whiteToken());
            blackToken = await TokenTemplate.at(await deployedPredictionCollateralization._whiteToken());
        }

        if (!contractsAddresses.predictionPool || (await web3.eth.getCode(contractsAddresses.predictionPool) === "0x")) {
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

            await deployedCollateralToken.approve(deployedPredictionPool.address, approveValue);

            console.log("PredictionPool:          " + deployedPredictionPool.address);
            console.log("Gov address:             " + await deployedPredictionCollateralization._governanceAddress());

            await deployedPredictionCollateralization.changePoolAddress(deployedPredictionPool.address);
            console.log("PredictionPool:          " + await deployedPredictionCollateralization._poolAddress());

            contractsAddresses.predictionPool = deployedPredictionPool.address;
            contractsAddresses.predictionPool = deployedPredictionPool.address;
            fs.writeFileSync(deployMainContractsFileName, JSON.stringify(contractsAddresses, null, 2));
        }

    } catch(e) {
        console.log('\x1b[33m%s\x1b[33m\x1b[0m',
            `\n\nSOME ERROR)`);
        console.log('\x1b[33m%s\x1b[33m\x1b[0m', e);
        return;
    }
};

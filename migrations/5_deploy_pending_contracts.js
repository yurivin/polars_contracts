const TokenTemplate = artifacts.require("TokenTemplate");
const EventLifeCycle = artifacts.require("EventLifeCycle");
const PredictionPool = artifacts.require("PredictionPool");
const PendingOrders = artifacts.require("PendingOrders");

const fs = require("fs");
const path = require("path");

const {
  BN,           // Big Number support
  constants,    // Common constants, like the zero address and largest integers
} = require('@openzeppelin/test-helpers');

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

    try {
        if (!fs.existsSync(deployMainContractsFileName)) fs.writeFileSync(deployMainContractsFileName, '{}');

        const contractsAddresses = require(deployMainContractsFileName);

        if (!contractsAddresses.predictionPool || (await web3.eth.getCode(contractsAddresses.predictionPool) === "0x")) throw 'PredictionContractsError';
        if (!contractsAddresses.eventLifeCycle || (await web3.eth.getCode(contractsAddresses.eventLifeCycle) === "0x")) throw 'ElcContractsError';

        const deployedCollateralToken = await TokenTemplate.at(tokens.collateralToken);
        const deployedPredictionPool = await PredictionPool.at(contractsAddresses.predictionPool);
        const deployedEventLifeCycle = await EventLifeCycle.at(contractsAddresses.eventLifeCycle);

        if (!contractsAddresses.pendingOrders || (await web3.eth.getCode(contractsAddresses.pendingOrders) === "0x")) {
            await deployer.deploy(
                PendingOrders,
                deployedPredictionPool.address,
                deployedCollateralToken.address,
                deployedEventLifeCycle.address
            );
            const deployedPendingOrders = await PendingOrders.deployed();
            console.log("PendingOrders:           " + await deployedPendingOrders.address);

            await deployedCollateralToken.approve(deployedPendingOrders.address, approveValue);

            /* Init platform to use PendingOrders
            * await deployedEventLifeCycle.setPendingOrders(deployedPendingOrders.address, true);
            * await deployedPredictionPool.changeOrderer(deployedPendingOrders.address);
            * await deployedPredictionPool.setOnlyOrderer(true);
            *
            */

            contractsAddresses.pendingOrders = deployedPendingOrders.address;
            fs.writeFileSync(deployMainContractsFileName, JSON.stringify(contractsAddresses, null, 2));
        }

    } catch(e) {
        console.log('\x1b[33m%s\x1b[33m\x1b[0m',
            `\n\nPLEASE RUN PREVIOUS MIGRATIONS FIRST OR REPLACE CONTRACTS ADDRESSES`);
        console.log('\x1b[33m%s\x1b[33m\x1b[0m', e);
        return;
    }
};

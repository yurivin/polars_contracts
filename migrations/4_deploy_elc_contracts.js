const EventLifeCycle = artifacts.require("EventLifeCycle");
const PredictionPool = artifacts.require("PredictionPool");

const fs = require("fs");
const path = require("path");

const {
  BN,           // Big Number support
  constants,    // Common constants, like the zero address and largest integers
} = require('@openzeppelin/test-helpers');

module.exports = async(deployer, network, accounts) => {
    const deployerAddress = accounts[0];

    if (network === 'development' || network === 'coverage' || network === 'soliditycoverage') {
        return;
    }

    const deployDirectory = `${__dirname}/../deployed`;
    const deployMainContractsFileName = path.join(deployDirectory, `2_${network}_main_contracts_addresses.json`);

    try {
        if (!fs.existsSync(deployMainContractsFileName)) fs.writeFileSync(deployMainContractsFileName, '{}');

        const contractsAddresses = require(deployMainContractsFileName);

        if (!contractsAddresses.predictionPool || (await web3.eth.getCode(contractsAddresses.predictionPool) === "0x")) throw 'PredictionContractsError';

        const deployedPredictionPool = await PredictionPool.at(contractsAddresses.predictionPool);

        if (!contractsAddresses.eventLifeCycle || (await web3.eth.getCode(contractsAddresses.eventLifeCycle) === "0x")) {
            await deployer.deploy(
                EventLifeCycle,
                deployerAddress,
                deployerAddress,
                deployedPredictionPool.address
            );
            const deployedEventLifeCycle = await EventLifeCycle.deployed();
            console.log("EventLifeCycle:          " + await deployedEventLifeCycle.address);

            await deployedPredictionPool.changeEventContractAddress(deployedEventLifeCycle.address);

            contractsAddresses.eventLifeCycle = deployedEventLifeCycle.address;
            fs.writeFileSync(deployMainContractsFileName, JSON.stringify(contractsAddresses, null, 2));
        }

    } catch(e) {
        console.log('\x1b[33m%s\x1b[33m\x1b[0m',
            `\n\nPLEASE RUN PREDICTION MIGRATIONS FIRST OR REPLACE CONTRACTS ADDRESSES`);
        console.log('\x1b[33m%s\x1b[33m\x1b[0m', e);
        return;
    }
};

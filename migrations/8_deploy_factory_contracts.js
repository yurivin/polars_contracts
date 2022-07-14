const TokenTemplate = artifacts.require("TokenTemplate");
// const EventLifeCycle = artifacts.require("EventLifeCycle");
// const PredictionPool = artifacts.require("PredictionPool");
// const OraclePayableChainLinkEventManager = artifacts.require("OraclePayableChainLinkEventManager");

const WhiteList = artifacts.require("WhiteList");
const SuiteFactory = artifacts.require("SuiteFactory");
const SuiteList = artifacts.require("SuiteList");
const PredictionCollateralFactory = artifacts.require("PredictionCollateralFactory");
const PredictionPoolProxy = artifacts.require("PredictionPoolProxy");
const PredictionPoolFactory = artifacts.require("PredictionPoolFactory");
const EventLifeCycleFactory = artifacts.require("EventLifeCycleFactory");
const PendingOrdersFactory = artifacts.require("PendingOrdersFactory");

// const ChainlinkAPIConsumer = artifacts.require("ChainlinkAPIConsumer");

const fs = require("fs");
const path = require("path");

const { PLATFORM_TOKENS } = require('../.env.json');

const {
  BN,           // Big Number support
  time,
  constants,    // Common constants, like the zero address and largest integers
} = require('@openzeppelin/test-helpers');

const UtilConstants = require(`${__dirname}/../UtilConstants.json`)

const approveValue = constants.MAX_UINT256;

module.exports = async(deployer, network, accounts) => {
    const deployerAddress = accounts[0];

    if (network === 'development' || network === 'coverage' || network === 'soliditycoverage') {
        return;
    }

    const deployDirectory = `${__dirname}/../deployed`;
    const deployTestTokensFileName = path.join(deployDirectory, `1_${network}_test_tokens_addresses.json`);
    const deployMainContractsFileName = path.join(deployDirectory, `2_${network}_main_contracts_addresses.json`);
    const deployFactoryContractsFileName = path.join(deployDirectory, `3_${network}_factory_contracts_addresses.json`);

    let deployedPlatformToken;

    console.log("Platform token:             " + PLATFORM_TOKENS);
    console.log("Platform token:             " + PLATFORM_TOKENS[network]);
    if (!PLATFORM_TOKENS[network] || (await web3.eth.getCode(PLATFORM_TOKENS[network]) === "0x")) {
        await deployer.deploy(
            TokenTemplate,
            "STest USDT",
            "USDT",
            18,
            deployerAddress,
            "1000000000000000000000000000000000"
        )
        deployedPlatformToken = await TokenTemplate.deployed();
        console.log("Platform token:             " + deployedPlatformToken.address);
    } else {
        deployedPlatformToken = await TokenTemplate.at(PLATFORM_TOKENS[network]);
    }

    try {
        if (await web3.eth.getCode(deployedPlatformToken.address) === "0x") throw 'PLATFORM_TOKEN NotContract';

        if (!fs.existsSync(deployFactoryContractsFileName)) fs.writeFileSync(deployFactoryContractsFileName, '{}');

        const contractsAddresses = require(deployFactoryContractsFileName);


        if (!contractsAddresses.whiteList || (await web3.eth.getCode(contractsAddresses.whiteList) === "0x")) {
            await deployer.deploy(WhiteList);

            deployedWhiteList = await WhiteList.deployed();

            contractsAddresses.whiteList = deployedWhiteList.address;
            fs.writeFileSync(deployFactoryContractsFileName, JSON.stringify(contractsAddresses, null, 2));
        } else {
            deployedWhiteList = await WhiteList.at(contractsAddresses.whiteList);
        }


        if (!contractsAddresses.suiteFactory || (await web3.eth.getCode(contractsAddresses.suiteFactory) === "0x")) {
            await deployer.deploy(
                SuiteFactory,
                deployedPlatformToken.address,
                new BN("1000000000000000000")
            );

            deployedSuiteFactory = await SuiteFactory.deployed();

            contractsAddresses.suiteFactory = deployedSuiteFactory.address;
            fs.writeFileSync(deployFactoryContractsFileName, JSON.stringify(contractsAddresses, null, 2));
        } else {
            deployedSuiteFactory = await SuiteFactory.at(contractsAddresses.suiteFactory);
        }


        if (!contractsAddresses.suiteList || (await web3.eth.getCode(contractsAddresses.suiteList) === "0x")) {
            await deployer.deploy(
                SuiteList,
                contractsAddresses.suiteFactory
            );

            deployedSuiteList = await SuiteList.deployed();

            contractsAddresses.suiteList = deployedSuiteList.address;
            fs.writeFileSync(deployFactoryContractsFileName, JSON.stringify(contractsAddresses, null, 2));
        } else {
            deployedSuiteList = await SuiteList.at(contractsAddresses.suiteList);
        }


        if (!contractsAddresses.predictionCollateralFactory || (await web3.eth.getCode(contractsAddresses.predictionCollateralFactory) === "0x")) {

            await deployer.deploy(PredictionCollateralFactory);

            deployedPredictionCollateralFactory = await PredictionCollateralFactory.deployed();

            contractsAddresses.predictionCollateralFactory = deployedPredictionCollateralFactory.address;
            fs.writeFileSync(deployFactoryContractsFileName, JSON.stringify(contractsAddresses, null, 2));
        } else {
            deployedPredictionCollateralFactory = await PredictionCollateralFactory.at(contractsAddresses.predictionCollateralFactory);
        }


        if (!contractsAddresses.predictionPoolProxy || (await web3.eth.getCode(contractsAddresses.predictionPoolProxy) === "0x")) {

            await deployer.deploy(PredictionPoolProxy);

            deployedPredictionPoolProxy = await PredictionPoolProxy.deployed();

            contractsAddresses.predictionPoolProxy = deployedPredictionPoolProxy.address;
            fs.writeFileSync(deployFactoryContractsFileName, JSON.stringify(contractsAddresses, null, 2));
        } else {
            deployedPredictionPoolProxy = await PredictionPoolProxy.at(contractsAddresses.predictionPoolProxy);
        }


        if (!contractsAddresses.predictionPoolFactory || (await web3.eth.getCode(contractsAddresses.predictionPoolFactory) === "0x")) {

            await deployer.deploy(PredictionPoolFactory, deployedPredictionPoolProxy.address);

            deployedPredictionPoolFactory = await PredictionPoolFactory.deployed();

            contractsAddresses.predictionPoolFactory = deployedPredictionPoolFactory.address;
            fs.writeFileSync(deployFactoryContractsFileName, JSON.stringify(contractsAddresses, null, 2));
        } else {
            deployedPredictionPoolFactory = await PredictionPoolFactory.at(contractsAddresses.predictionPoolFactory);
        }


        if (!contractsAddresses.eventLifeCycleFactory || (await web3.eth.getCode(contractsAddresses.eventLifeCycleFactory) === "0x")) {

            await deployer.deploy(EventLifeCycleFactory);

            deployedEventLifeCycleFactory = await EventLifeCycleFactory.deployed();

            contractsAddresses.eventLifeCycleFactory = deployedEventLifeCycleFactory.address;
            fs.writeFileSync(deployFactoryContractsFileName, JSON.stringify(contractsAddresses, null, 2));
        } else {
            deployedEventLifeCycleFactory = await EventLifeCycleFactory.at(contractsAddresses.eventLifeCycleFactory);
        }


        if (!contractsAddresses.pendingOrdersFactory || (await web3.eth.getCode(contractsAddresses.pendingOrdersFactory) === "0x")) {

            await deployer.deploy(PendingOrdersFactory);

            deployedPendingOrdersFactory = await PendingOrdersFactory.deployed();

            contractsAddresses.pendingOrdersFactory = deployedPendingOrdersFactory.address;
            fs.writeFileSync(deployFactoryContractsFileName, JSON.stringify(contractsAddresses, null, 2));
        } else {
            deployedPendingOrdersFactory = await PendingOrdersFactory.at(contractsAddresses.pendingOrdersFactory);
        }

        /* Need manual init
         * deployedSuiteFactory.setSuiteList(deployedSuiteList.address)
         * deployedSuiteList.setSuiteFactory(deployedSuiteFactory.address)
         * deployedSuiteList.setWhiteList(deployedWhiteList.address)
         * deployedWhiteList.add(0, deployedPredictionCollateralFactory.address)    // 0 - PREDICTION_COLLATERAL
         * deployedWhiteList.add(1, deployedPredictionPoolFactory.address)          // 1 - PREDICTION_POOL
         * deployedWhiteList.add(2, deployedEventLifeCycleFactory.address)          // 2 - EVENT_LIFE_CYCLE
         * deployedWhiteList.add(3, deployedPendingOrdersFactory.address)           // 3 - PENDING_ORDERS
         * deployedPredictionPoolProxy.setDeployer(contractsAddresses.predictionPoolFactory)
        /* Need manual init */

        // console.log(await deployedPredictionPoolProxy.setDeployer(contractsAddresses.predictionPoolFactory))


    } catch(e) {
        console.log('\x1b[33m%s\x1b[33m\x1b[0m',
            `\n\nPLEASE RUN PREVIOUS MIGRATIONS FIRST OR REPLACE CONTRACTS ADDRESSES`);
        console.log('\x1b[33m%s\x1b[33m\x1b[0m', e);
        return;
    }
};

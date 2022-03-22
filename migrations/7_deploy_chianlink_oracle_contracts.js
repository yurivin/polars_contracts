const TokenTemplate = artifacts.require("TokenTemplate");
const EventLifeCycle = artifacts.require("EventLifeCycle");
const PredictionPool = artifacts.require("PredictionPool");
const OraclePayableChainLinkEventManager = artifacts.require("OraclePayableChainLinkEventManager");

const ChainlinkAPIConsumer = artifacts.require("ChainlinkAPIConsumer");

const fs = require("fs");
const path = require("path");

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
    const deployMainContractsFileName = path.join(deployDirectory, `2_${network}_main_contracts_addresses.json`);

    try {
        if (!fs.existsSync(deployMainContractsFileName)) fs.writeFileSync(deployMainContractsFileName, '{}');

        const contractsAddresses = require(deployMainContractsFileName);

        if (!contractsAddresses.predictionPool || (await web3.eth.getCode(contractsAddresses.predictionPool) === "0x")) throw 'PredictionContractsError';
        if (!contractsAddresses.eventLifeCycle || (await web3.eth.getCode(contractsAddresses.eventLifeCycle) === "0x")) throw 'ElcContractsError';
        if (!UtilConstants[network].linkToken || (await web3.eth.getCode(UtilConstants[network].linkToken) === "0x")) throw 'LinkContractsError';

        const deployedLinkToken = await TokenTemplate.at(UtilConstants[network].linkToken);
        const deployedPredictionPool = await PredictionPool.at(contractsAddresses.predictionPool);
        const deployedEventLifeCycle = await EventLifeCycle.at(contractsAddresses.eventLifeCycle);

        console.log("deployer link balance:", (await deployedLinkToken.balanceOf(deployerAddress)).toString())


        let deployedChainlinkAPIConsumer;

        if (!contractsAddresses.chainlinkAPIConsumer || (await web3.eth.getCode(contractsAddresses.chainlinkAPIConsumer) === "0x")) {
            await deployer.deploy(
                ChainlinkAPIConsumer,
                UtilConstants[network].oracle,                        // address _oracle
                web3.utils.asciiToHex(UtilConstants[network].jobId),  // bytes32 _jobId
                web3.utils.toWei(UtilConstants[network].fee),         // uint256 _fee
                "0x0000000000000000000000000000000000000000"          // address _link
            );

            deployedChainlinkAPIConsumer = await ChainlinkAPIConsumer.deployed();

            contractsAddresses.chainlinkAPIConsumer = deployedChainlinkAPIConsumer.address;
            fs.writeFileSync(deployMainContractsFileName, JSON.stringify(contractsAddresses, null, 2));
        } else {
            deployedChainlinkAPIConsumer = await ChainlinkAPIConsumer.at(contractsAddresses.chainlinkAPIConsumer);
        }

        if (!contractsAddresses.oraclePayableChainLinkEventManager || (await web3.eth.getCode(contractsAddresses.oraclePayableChainLinkEventManager) === "0x")) {
            await deployer.deploy(
                OraclePayableChainLinkEventManager,
                deployedEventLifeCycle.address,
                deployedPredictionPool.address,
                new BN("50000000000000000"),
                new BN("1800"),
                new BN("1800")
            );
            const deployedOraclePayableChainLinkEventManager = await OraclePayableChainLinkEventManager.deployed();

            console.log("OraclePayableChainLinkEventManager:  " + await deployedOraclePayableChainLinkEventManager.address);

            await deployedOraclePayableChainLinkEventManager.addPriceConsumer(
                deployedChainlinkAPIConsumer.address,   // address priceConsumerAddress,
                "BNB",                                  // string memory token0,
                "USDT",                                 // string memory token1
            )

            contractsAddresses.oraclePayableChainLinkEventManager = deployedOraclePayableChainLinkEventManager.address;
            fs.writeFileSync(deployMainContractsFileName, JSON.stringify(contractsAddresses, null, 2));
        }

    } catch(e) {
        console.log('\x1b[33m%s\x1b[33m\x1b[0m',
            `\n\nPLEASE RUN PREVIOUS MIGRATIONS FIRST OR REPLACE CONTRACTS ADDRESSES`);
        console.log('\x1b[33m%s\x1b[33m\x1b[0m', e);
        return;
    }
};

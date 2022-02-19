const TokenTemplate = artifacts.require("TokenTemplate");
const EventLifeCycle = artifacts.require("EventLifeCycle");
const PredictionPool = artifacts.require("PredictionPool");
const OracleSwapEventManager = artifacts.require("OracleSwapEventManager");

const IPancakeRouter01 = artifacts.require("IPancakeRouter01");
const IPancakeFactory = artifacts.require("IPancakeFactory");
const IPancakePair = artifacts.require("IPancakePair");

const fs = require("fs");
const path = require("path");

const {
  BN,           // Big Number support
  time,
  constants,    // Common constants, like the zero address and largest integers
} = require('@openzeppelin/test-helpers');

const dexConstants = require(`${__dirname}/../DexConstants.json`)

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
        if (!tokens.stUsd) throw 'stUsdUndefined';
        if (!tokens.stBNB) throw 'stBNBUndefined';
        if (await web3.eth.getCode(tokens.collateralToken) === "0x") throw 'CollateralNotContract';
        if (await web3.eth.getCode(tokens.stUsd) === "0x") throw 'stUsdNotContract';
        if (await web3.eth.getCode(tokens.stBNB) === "0x") throw 'stBNBNotContract';

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
        const deployedSTUsdToken = await TokenTemplate.at(tokens.stUsd);
        const deployedSTBNBToken = await TokenTemplate.at(tokens.stBNB);
        const deployedPredictionPool = await PredictionPool.at(contractsAddresses.predictionPool);
        const deployedEventLifeCycle = await EventLifeCycle.at(contractsAddresses.eventLifeCycle);

        let dexPair;
        let _primaryToken = 0;

        if (!contractsAddresses.pairAddress || (await web3.eth.getCode(contractsAddresses.pairAddress) === "0x")) {

            const dexRouter = await IPancakeRouter01.at(dexConstants[network]);

            const dexFactoryAddress = await dexRouter.factory()


            const dexFactory = await IPancakeFactory.at(dexFactoryAddress);
            console.log("factoryAddress:          ", dexFactory.address);


            const dexPairAddressBefore = await dexFactory.getPair(
                deployedSTUsdToken.address, // address tokenA,
                deployedSTBNBToken.address, // address tokenB
            )
            console.log("dexPairAddressBefore:    ", dexPairAddressBefore);

            await dexFactory.createPair(
                deployedSTUsdToken.address, // address tokenA,
                deployedSTBNBToken.address, // address tokenB
            )
            const dexPairAddress = await dexFactory.getPair(
                deployedSTUsdToken.address, // address tokenA,
                deployedSTBNBToken.address, // address tokenB
            )

            dexPair = await IPancakePair.at(dexPairAddress);

            const token0 = await dexPair.token0();
            const token1 = await dexPair.token1();
            console.log("dexPairAddressBefore:    ", dexPairAddressBefore);
            console.log("dexPairAddress:          ", dexPairAddress);
            console.log("token0:                  ", token0);
            console.log("usd:                     ", deployedSTUsdToken.address);
            console.log("token1:                  ", token1);
            console.log("bnb:                     ", deployedSTBNBToken.address);


            const amountADesired = new BN("103153246713754825714339456");
            const amountBDesired = new BN("270231134191430226258662");

            // const amountAMin = amountADesired.mul(new BN("0.992"));
            // const amountBMin = amountADesired.mul(new BN("0.992"));

            const amountAMin = new BN("102328020740044787108624740");
            const amountBMin = new BN("268069285117898784448592");

            const deadline = (await time.latest()).add(new BN("300"));

            await deployedSTUsdToken.approve(dexRouter.address, approveValue);

            await deployedSTBNBToken.approve(dexRouter.address, approveValue);

            await dexRouter.addLiquidity(
                deployedSTUsdToken.address, // address tokenA,
                deployedSTBNBToken.address, // address tokenB,
                amountADesired,             // uint256 amountADesired,
                amountBDesired,             // uint256 amountBDesired,
                amountAMin,                 // uint256 amountAMin,
                amountBMin,                 // uint256 amountBMin,
                deployerAddress,            // address to,
                deadline                    // uint256 deadline
            );

            const reserves = await dexPair.getReserves()
            console.log("reserve0:                ", reserves.reserve0.toString())
            console.log("reserve1:                ", reserves.reserve1.toString())
            console.log("blockTimestampLast:      ", reserves.blockTimestampLast.toString())



            if (deployedSTUsdToken.address == token0 && deployedSTBNBToken.address == token1) {
                console.log("price:                   ", reserves.reserve0.div(reserves.reserve1).toString());
                _primaryToken = 1;
            } else {
                console.log("price:                   ", reserves.reserve1.div(reserves.reserve0).toString())
                _primaryToken = 0;
            }

            console.log("pairAddress:             " + dexPair.address);
            console.log("token0:                  " + token0);
            console.log("token1:                  " + token1);

        }

        if (!contractsAddresses.oracleSwapEventManager || (await web3.eth.getCode(contractsAddresses.oracleSwapEventManager) === "0x")) {
            await deployer.deploy(
                OracleSwapEventManager,
                deployedEventLifeCycle.address,
                deployedPredictionPool.address,
                new BN("50000000000000000"),
                new BN("1800"),
                new BN("1800")
            );
            const deployedOracleSwapEventManager = await OracleSwapEventManager.deployed();

            console.log("OracleSwapEventManager:  " + await deployedOracleSwapEventManager.address);

            await deployedOracleSwapEventManager.addDex(
                dexPair.address, _primaryToken
            )

            console.log("OSEManager pair:         " + await deployedOracleSwapEventManager._pair());

            contractsAddresses.oracleSwapEventManager = deployedOracleSwapEventManager.address;
            fs.writeFileSync(deployMainContractsFileName, JSON.stringify(contractsAddresses, null, 2));
        }

    } catch(e) {
        console.log('\x1b[33m%s\x1b[33m\x1b[0m',
            `\n\nPLEASE RUN PREVIOUS MIGRATIONS FIRST OR REPLACE CONTRACTS ADDRESSES`);
        console.log('\x1b[33m%s\x1b[33m\x1b[0m', e);
        return;
    }
};

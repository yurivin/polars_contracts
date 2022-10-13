const {
  BN,           // Big Number support
  time,
  constants,    // Common constants, like the zero address and largest integers
  expectEvent,  // Assertions for emitted events
  expectRevert, // Assertions for transactions that should fail
  snapshot
} = require('@openzeppelin/test-helpers');

const bigDecimal = require('js-big-decimal');

const chai = require('chai');
const expect = require('chai').expect;

const { getLogs, mntob, ntob, BONE } = require('./../utils.js');

const TokenTemplate = artifacts.require('TokenTemplate');
const WhiteList = artifacts.require('WhiteList');
const SuiteFactory = artifacts.require('SuiteFactory');
const Suite = artifacts.require('Suite');
const SuiteList = artifacts.require('SuiteList');
const PredictionCollateralFactory = artifacts.require('PredictionCollateralFactory');
const PredictionPoolFactory = artifacts.require('PredictionPoolFactory');
const PredictionPoolProxy = artifacts.require('PredictionPoolProxy');
const EventLifeCycleFactory = artifacts.require('EventLifeCycleFactory');
const PendingOrdersFactory = artifacts.require('PendingOrdersFactory');
const LeverageFactory = artifacts.require('LeverageFactory');
const PredictionCollateralization = artifacts.require('PredictionCollateralization');
const PredictionPool = artifacts.require('PredictionPool');
const EventLifeCycle = artifacts.require('EventLifeCycle');
const PendingOrders = artifacts.require('PendingOrders');
const Leverage = artifacts.require('Leverage');

const debug = 0;
const maxPageSize = 30;
const polTokenSupply = 1000000000;
const commissionForCreateSuite = 1; // 1$

[
  "6",
  "18"
].forEach((decimals) => {
  const collateralTokenDecimals = decimals;
  const multiplier = 10 ** parseInt(collateralTokenDecimals);
  const collateralTokenSupply = mntob(1e13, multiplier);

  contract(`DEV: Factories ${decimals} Decimals`, function (accounts) {
    "use strict";

    const [ deployerAddress, someUser1, someUser2, factoryAccount, someUser3 ] = accounts;

    const approveValue = constants.MAX_UINT256;

    let deployedPolToken;
    let deployedCollateralToken;
    let deployedWhiteList;
    let deployedSuiteFactory;
    let deployedSuiteList;
    let deployedPredictionCollateralFactory;
    let deployedPredictionPoolProxy;
    let deployedPredictionPoolFactory;
    let deployedEventLifeCycleFactory;
    let deployedPendingOrdersFactory;
    let deployedLeverageFactory;

    let snapshotA;

    before(async () => {

    });

    beforeEach(async () => {

      deployedPolToken = await TokenTemplate.new(
        "Polars",                 // string memory name,
        "POL",                    // string memory symbol,
        new BN("18"),             // uint8 decimals,
        deployerAddress,          // address beneficiary,
        ntob(polTokenSupply),     // uint256 supply
        { from: deployerAddress }
      );

      deployedCollateralToken = await TokenTemplate.new(
        "Binance USD token",      // string memory name,
        "BUSD",                   // string memory symbol,
        new BN(decimals),             // uint8 decimals,
        // new BN("18"),             // uint8 decimals,
        deployerAddress,          // address beneficiary,
        collateralTokenSupply,    // uint256 supply
        // ntob(polTokenSupply),     // uint256 supply
        { from: deployerAddress }
      );

      deployedWhiteList = await WhiteList.new(
        { from: deployerAddress }
      );

      deployedSuiteFactory = await SuiteFactory.new(
        deployedPolToken.address,
        ntob(commissionForCreateSuite), // 1POL commission
        { from: deployerAddress }
      );

      deployedSuiteList = await SuiteList.new(
        deployedSuiteFactory.address,
        { from: deployerAddress }
      );

      await deployedSuiteFactory.setSuiteList(deployedSuiteList.address);

      deployedPredictionCollateralFactory = await PredictionCollateralFactory.new(
        { from: deployerAddress }
      );

      deployedPredictionPoolProxy = await PredictionPoolProxy.new(
        { from: deployerAddress }
      );

      deployedPredictionPoolFactory = await PredictionPoolFactory.new(
        deployedPredictionPoolProxy.address,
        { from: deployerAddress }
      );

      deployedEventLifeCycleFactory = await EventLifeCycleFactory.new(
        { from: deployerAddress }
      );

      deployedPendingOrdersFactory = await PendingOrdersFactory.new(
        { from: deployerAddress }
      );

      deployedLeverageFactory = await LeverageFactory.new(
        { from: deployerAddress }
      );

      snapshotA = await snapshot();
    });

    afterEach(async () => {
      await snapshotA.restore()
    });

    describe("WhiteList", () => {
      it('should assert WhiteList add and remove allowance of factory', async () => {
        const typePC = 0; // PREDICTION_COLLATERAL

        let _allowedFactories = await deployedWhiteList._allowedFactories.call(
          typePC
        );
        expect(_allowedFactories).to.be.equals(
          "0x0000000000000000000000000000000000000000"
        );

        await deployedWhiteList.add(
          typePC,
          factoryAccount
        );
        _allowedFactories = await deployedWhiteList._allowedFactories.call(
          typePC
        );
        expect(_allowedFactories).to.be.equals(factoryAccount);

        await deployedWhiteList.remove(
          typePC
        );
        _allowedFactories = await deployedWhiteList._allowedFactories.call(
          typePC
        );
        expect(_allowedFactories).to.be.equals(
          "0x0000000000000000000000000000000000000000"
        );

        await expectRevert(
          deployedWhiteList.add(
            typePC,
            factoryAccount,
            { from: someUser1 }
          ), "Revert or exceptional halt"
        );

        _allowedFactories = await deployedWhiteList._allowedFactories.call(
          typePC
        );
        expect(_allowedFactories).to.be.equals(
          "0x0000000000000000000000000000000000000000"
        );

        await expectRevert(
          deployedWhiteList.remove(
            typePC,
            { from: someUser1 }
          ), "Revert or exceptional halt"
        );
      });
    });

    const deploySuite = async (user, suiteName, collateralTokenAddress) => {
      await deployedPolToken.transfer(
        user,                               // address recipient
        ntob(commissionForCreateSuite),     // uint256 amount
        { from: deployerAddress }
      )

      await deployedPolToken.approve(
        deployedSuiteFactory.address,       // address spender
        ntob(commissionForCreateSuite*20),  // uint256 amount
        { from: user }
      )

      const deployedSuiteTx = await deployedSuiteFactory.deploySuite(
        suiteName,
        collateralTokenAddress,
        { from: user }
      );
      const deployedSuiteAddress = deployedSuiteTx.logs[2].args.suiteAddress;
      if (debug) console.log("deployedSuiteAddress:", deployedSuiteAddress);

      const deployedSuite = await Suite.at(deployedSuiteAddress);
      const suiteOwner = await deployedSuite.owner();

      expect(
        await deployedSuite._suiteFactoryAddress()
      ).to.be.equals(deployedSuiteFactory.address);

      if (debug) console.log("suiteOwner          :", suiteOwner);
      if (debug) console.log("user                :", user);

      expect(suiteOwner).to.be.equals(user);

      const getSuitesCount = await deployedSuiteList.getSuitesCount();
      if (debug) console.log("getSuitesCount      :", getSuitesCount.toString());


      return deployedSuiteAddress;
    }

    const addToWhiteList = async (type, factoryAddress) => {
      await deployedWhiteList.add(
        type,
        factoryAddress
      );

      const _allowedFactories = await deployedWhiteList._allowedFactories.call(
        type
      );
      expect(_allowedFactories).to.be.equals(factoryAddress);
    }

    const setWhiteList = async () => {
      expect(await deployedSuiteList._whiteList()).to.be.equals("0x0000000000000000000000000000000000000000");
      await deployedSuiteList.setWhiteList(deployedWhiteList.address);
      expect(await deployedSuiteList._whiteList()).to.be.equals(deployedWhiteList.address);
    }

    const deployFactoryContracts = async () => {
      await setWhiteList();

      await addToWhiteList(
        0, // "PREDICTION_COLLATERAL",
        deployedPredictionCollateralFactory.address
      );

      const isSuiteExists = await deployedSuiteList.isSuiteExists(accounts[6]);
      if (debug) console.log("isSuiteExists       :", isSuiteExists);
      expect(isSuiteExists).to.be.equals(false);

      const deployedSuiteAddress = await deploySuite(
        someUser1,
        "SomeNameSuite",
        deployedCollateralToken.address
      );

      const _suites0 = await deployedSuiteList._suites(0);
      expect(_suites0).to.be.equals(deployedSuiteAddress);
      const _suiteIndexes = await deployedSuiteList._suiteIndexes(deployedSuiteAddress);
      const isSuiteExistsAfterCreate = await deployedSuiteList.isSuiteExists(deployedSuiteAddress);
      if (debug) console.log("_suites0            :", _suites0);
      if (debug) console.log("_suiteIndexes      :", _suiteIndexes.toString());
      if (debug) console.log("isSuiteExistsAfterCreate      :", isSuiteExistsAfterCreate);

      expect(isSuiteExistsAfterCreate).to.be.equals(true);

      await expectRevert(
        deployedPredictionCollateralFactory.createContract(
          _suites0,                         // address suiteAddress,
          "testWhiteName",                  // string memory whiteName,
          "testWhiteSymbol",                // string memory whiteSymbol,
          "testBlackName",                  // string memory blackName,
          "testBlackSymbol"                 // string memory blackSymbol
        ), "Caller should be suite owner"
      );

      const createCollateralContractTx = await deployedPredictionCollateralFactory.createContract(
        _suites0,                           // address suiteAddress,
        "testWhiteName",                    // string memory whiteName,
        "testWhiteSymbol",                  // string memory whiteSymbol,
        "testBlackName",                    // string memory blackName,
        "testBlackSymbol",                  // string memory blackSymbol
        { from: someUser1 }
      );

      const { logs: createCollateralContractTxLog } = createCollateralContractTx;
      const eventCount = 1;
      assert.equal(createCollateralContractTxLog.length, eventCount, `triggers must be ${eventCount} event`);

      expectEvent.inLogs(createCollateralContractTxLog, 'ContractCreated', {
        suiteAddress: _suites0,
        contractType: "PREDICTION_COLLATERAL"
      });


      const collateralContractAddress = createCollateralContractTx.logs[0].args.contractAddress;

      if (debug) console.log("contractCollAddress:", collateralContractAddress);

      const factoryCollateralContractType = await deployedPredictionCollateralFactory.FACTORY_CONTRACT_TYPE();
      if (debug) console.log("factoryContractType :", factoryCollateralContractType.toString());
      const deployedSuite = await Suite.at(_suites0);
      expect(await deployedSuite.contracts(factoryCollateralContractType)).to.be.equals(collateralContractAddress);


      const deployedPredictionCollateralization = await PredictionCollateralization.at(
        collateralContractAddress
      );

      expect(
        await deployedPredictionCollateralization._governanceAddress()
      ).to.be.equals(deployedPredictionCollateralFactory.address);

      if (debug) console.log("_poolAddress        :", (await deployedPredictionCollateralization._poolAddress()));
      assert.equal(deployedPredictionCollateralFactory.address, await deployedPredictionCollateralization._poolAddress());

      const deployedWhiteToken = await TokenTemplate.at(await deployedPredictionCollateralization._whiteToken());

      const deployedBlackToken = await TokenTemplate.at(await deployedPredictionCollateralization._blackToken());

      if (debug) console.log("PredictionCollateral:", deployedPredictionCollateralization.address);
      if (debug) console.log("WhiteToken          :", deployedWhiteToken.address);
      if (debug) console.log("BlackToken          :", deployedBlackToken.address);

      const whiteTokenAllowance = await deployedWhiteToken.allowance(
        deployerAddress,                                // address owner,
        deployedPredictionCollateralization.address     // address spender
      )
      if (debug) console.log("whiteTokenAllowance :", whiteTokenAllowance.toString());

      const blackTokenAllowance = await deployedBlackToken.allowance(
        deployerAddress,                                // address owner,
        deployedPredictionCollateralization.address     // address spender
      )
      if (debug) console.log("blackTokenAllowance :", blackTokenAllowance.toString());

      // ------------------------Pool-------------------------------------------
      const initialBlackOrWhitePrice = mntob(0.5, multiplier);
      await expectRevert(
        deployedPredictionPoolFactory.createContract(
          _suites0,                                     // address suiteAddress,
          initialBlackOrWhitePrice,                     // uint256 whitePrice
          initialBlackOrWhitePrice                      // uint256 blackPrice
        ), "Caller should be suite owner"
      );

      await deployedPredictionPoolFactory.changeProxyAddress(deployedPredictionPoolProxy.address);

      await expectRevert(
        deployedPredictionPoolFactory.createContract(
          _suites0,                                     // address suiteAddress,
          initialBlackOrWhitePrice,                     // uint256 whitePrice
          initialBlackOrWhitePrice,                     // uint256 blackPrice
          { from: someUser1 }
        ), "Caller should be allowed deployer"
      );

      await deployedPredictionPoolProxy.setDeployer(deployedPredictionPoolFactory.address);

      await expectRevert(
        deployedPredictionPoolFactory.createContract(
          _suites0,                                     // address suiteAddress,
          initialBlackOrWhitePrice,                     // uint256 whitePrice
          initialBlackOrWhitePrice,                     // uint256 blackPrice
          { from: someUser1 }
        ), "Caller should be in White List"
      );

      await addToWhiteList(
        1, // "PREDICTION_POOL",
        deployedPredictionPoolFactory.address
      );

      const createPoolContractTx = await deployedPredictionPoolFactory.createContract(
        _suites0,                                       // address suiteAddress,
        initialBlackOrWhitePrice,                       // uint256 whitePrice
        initialBlackOrWhitePrice,                       // uint256 blackPrice
        { from: someUser1 }
      );

      const { logs: createPoolContractTxLog } = createPoolContractTx;

      assert.equal(createPoolContractTxLog.length, eventCount, `triggers must be ${eventCount} event`);

      expectEvent.inLogs(createPoolContractTxLog, 'ContractCreated', {
        suiteAddress: _suites0,
        contractType: "PREDICTION_POOL"
      });

      const poolContractAddress = createPoolContractTx.logs[0].args.contractAddress;

      if (debug) console.log("contractPoolAddress :", poolContractAddress);

      const factoryPoolContractType = await deployedPredictionPoolFactory.FACTORY_CONTRACT_TYPE();
      if (debug) console.log("factoryPContractType:", factoryPoolContractType.toString());

      expect(await deployedSuite.contracts(factoryPoolContractType)).to.be.equals(poolContractAddress);


      const deployedPredictionPool = await PredictionPool.at(
        poolContractAddress
      );

      expect(
        await deployedPredictionPool._governanceAddress()
      ).to.be.equals(deployedPredictionPoolFactory.address);

      expect(await deployedPredictionPool._thisCollateralization()).to.be.equals(deployedPredictionCollateralization.address);
      expect(await deployedPredictionPool._whiteToken()).to.be.equals(deployedWhiteToken.address);
      expect(await deployedPredictionPool._blackToken()).to.be.equals(deployedBlackToken.address);

      await expectRevert(
        deployedPredictionCollateralFactory.changePoolAddress(
          _suites0,
        ), "Caller should be suite owner"
      );

      await deployedPredictionCollateralFactory.changePoolAddress(
        _suites0,
        { from: someUser1 }
      );

      if (debug) console.log("_poolAddress        :", (await deployedPredictionCollateralization._poolAddress()));
      assert.equal(deployedPredictionPool.address, await deployedPredictionCollateralization._poolAddress());

      expect(await deployedPredictionPool.inited()).to.be.equals(false);

      const suiteOwner = await deployedSuite.owner();
      if (debug) console.log("gov                 :", (await deployedPredictionPool._governanceAddress()));

      await expectRevert(
        deployedPredictionPool.init(
          suiteOwner, suiteOwner, suiteOwner, suiteOwner, false
        ), "CALLER SHOULD BE GOVERNANCE"
      );


      // -------------------------ELC-------------------------------------------
      await expectRevert(
        deployedEventLifeCycleFactory.createContract(
          _suites0,                                     // address suiteAddress,
          suiteOwner                                    // address oracleAddress
        ), "Caller should be suite owner"
      );

      await expectRevert(
        deployedEventLifeCycleFactory.createContract(
          _suites0,                                     // address suiteAddress,
          suiteOwner,                                   // address oracleAddress
          { from: someUser1 }
        ), "Caller should be in White List"
      );

      await addToWhiteList(
        2, // "EVENT_LIFE_CYCLE",
        deployedEventLifeCycleFactory.address
      );

      const createEventLifeCycleContractTx = await deployedEventLifeCycleFactory.createContract(
        _suites0,                                       // address suiteAddress,
        suiteOwner,                                     // address oracleAddress
        { from: someUser1 }
      );

      const { logs: createEventLifeCycleContractTxLog } = createEventLifeCycleContractTx;

      assert.equal(createEventLifeCycleContractTxLog.length, eventCount, `triggers must be ${eventCount} event`);

      expectEvent.inLogs(createEventLifeCycleContractTxLog, 'ContractCreated', {
        suiteAddress: _suites0,
        contractType: "EVENT_LIFE_CYCLE"
      });

      const elcContractAddress = createEventLifeCycleContractTx.logs[0].args.contractAddress;

      if (debug) console.log("contractElcAddress  :", elcContractAddress);

      const factoryELCContractType = await deployedEventLifeCycleFactory.FACTORY_CONTRACT_TYPE();
      if (debug) console.log("factoryEContractType:", factoryELCContractType.toString());

      expect(await deployedSuite.contracts(factoryELCContractType)).to.be.equals(elcContractAddress);


      const deployedEventLifeCycle = await EventLifeCycle.at(
        elcContractAddress
      );

      expect(
        await deployedEventLifeCycle._governanceAddress()
      ).to.be.equals(deployedSuiteFactory.address);

      await expectRevert(
        deployedPredictionPoolFactory.initPredictionPool(
          _suites0,                           // address suiteAddress,
          ntob(0.002)
        ), "Caller should be suite owner"
      );

      await expectRevert(
        deployedPredictionPoolFactory.initPredictionPool(
          _suites0,                           // address suiteAddress,
          ntob(0.0009),
        { from: suiteOwner }
        ), "Too low total fee"
      );

      await expectRevert(
        deployedPredictionPoolFactory.initPredictionPool(
          _suites0,                           // address suiteAddress,
          ntob(0.11),
        { from: suiteOwner }
        ), "Too high total fee"
      );

      if (debug) console.log("deployerAddress     :", deployerAddress);
      if (debug) console.log("suiteOwner          :", suiteOwner);
      if (debug) console.log("ppf address         :", deployedPredictionPoolFactory.address);
      if (debug) console.log("elc address         :", (await deployedPredictionPool._eventContractAddress()));
      if (debug) console.log("elc gov             :", (await deployedEventLifeCycle._governanceAddress()));
      if (debug) console.log("pp gov              :", (await deployedPredictionPool._governanceAddress()));

      await deployedPredictionPoolFactory.initPredictionPool(
        _suites0,                             // address suiteAddress
        ntob(0.002),
        { from: suiteOwner }
      )

      if (debug) console.log("deployerAddress     :", deployerAddress);
      if (debug) console.log("suiteOwner          :", suiteOwner);
      if (debug) console.log("ppf address         :", deployedPredictionPoolFactory.address);
      if (debug) console.log("elc gov             :", (await deployedEventLifeCycle._governanceAddress()));
      if (debug) console.log("elc address         :", (await deployedPredictionPool._eventContractAddress()));
      if (debug) console.log("pp gov              :", (await deployedPredictionPool._governanceAddress()));

      expect(await deployedPredictionPool.FEE()).to.be.bignumber.equal(ntob(0.002));
      expect(await deployedPredictionPool.inited()).to.be.equals(true);

      assert.equal(deployedEventLifeCycle.address, await deployedPredictionPool._eventContractAddress());
      assert.equal(await deployedSuiteFactory.owner(), await deployedPredictionCollateralization._governanceAddress());
      assert.equal(deployedSuiteFactory.address, await deployedEventLifeCycle._governanceAddress());
      assert.equal(deployedSuiteFactory.address, await deployedPredictionPool._governanceAddress());

      // -------------------------Pending---------------------------------------
      await expectRevert(
        deployedPendingOrdersFactory.createContract(
          _suites0,                                     // address suiteAddress,
        ), "Caller should be suite owner"
      );

      await expectRevert(
        deployedPendingOrdersFactory.createContract(
          _suites0,                                     // address suiteAddress,
          { from: someUser1 }
        ), "Caller should be in White List"
      );

      await addToWhiteList(
        3, // "PENDING_ORDERS",
        deployedPendingOrdersFactory.address
      );

      const createPendingOrdersContractTx = await deployedPendingOrdersFactory.createContract(
        _suites0,                                       // address suiteAddress,
        { from: someUser1 }
      );

      const { logs: createPendingOrdersContractTxLog } = createPendingOrdersContractTx;

      assert.equal(createPendingOrdersContractTxLog.length, eventCount, `triggers must be ${eventCount} event`);

      expectEvent.inLogs(createPendingOrdersContractTxLog, 'ContractCreated', {
        suiteAddress: _suites0,
        contractType: "PENDING_ORDERS"
      });

      const poContractAddress = createPendingOrdersContractTx.logs[0].args.contractAddress;

      if (debug) console.log("contractPOAddress   :", poContractAddress);

      const factoryPOContractType = await deployedPendingOrdersFactory.FACTORY_CONTRACT_TYPE();
      if (debug) console.log("factoryPContractType:", factoryPOContractType.toString());

      expect(await deployedSuite.contracts(factoryPOContractType)).to.be.equals(poContractAddress);


      const deployedPendingOrders = await PendingOrders.at(
        poContractAddress
      );


      if (debug) console.log("pof address         :", deployedPendingOrdersFactory.address);
      if (debug) console.log("po gov              :", (await deployedPendingOrders.owner()));
      if (debug) console.log("po elc address      :", (await deployedPendingOrders._eventContractAddress()));

      assert.equal(deployedEventLifeCycle.address, await deployedPredictionPool._eventContractAddress());
      assert.equal(deployedSuiteFactory.address, await deployedPendingOrders.owner());

      expect(
        await deployedPendingOrders._ordersCount()
      ).to.be.bignumber.equal(new BN("0"));

      assert.equal(await deployedPendingOrders._collateralToken(), deployedCollateralToken.address);
      assert.equal(await deployedPendingOrders._predictionPool(), deployedPredictionPool.address);
      assert.equal(await deployedPendingOrders._eventContractAddress(), deployedEventLifeCycle.address);

      // -------------------------Leverage---------------------------------------
      await expectRevert(
        deployedLeverageFactory.createContract(
          _suites0,                                     // address suiteAddress,
        ), "Caller should be suite owner"
      );

      await expectRevert(
        deployedLeverageFactory.createContract(
          _suites0,                                     // address suiteAddress,
          { from: someUser1 }
        ), "Caller should be in White List"
      );

      await addToWhiteList(
        4, // "LEVERAGE",
        deployedLeverageFactory.address
      );

      const createLeverageContractTx = await deployedLeverageFactory.createContract(
        _suites0,                                       // address suiteAddress,
        { from: someUser1 }
      );

      const { logs: createLeverageContractTxLog } = createLeverageContractTx;

      assert.equal(createLeverageContractTxLog.length, eventCount, `triggers must be ${eventCount} event`);

      expectEvent.inLogs(createLeverageContractTxLog, 'ContractCreated', {
        suiteAddress: _suites0,
        contractType: "LEVERAGE"
      });

      const leverageContractAddress = createLeverageContractTx.logs[0].args.contractAddress;

      if (debug) console.log("contractLeverageAddress   :", leverageContractAddress);

      const factoryLeverageContractType = await deployedLeverageFactory.FACTORY_CONTRACT_TYPE();
      if (debug) console.log("factoryLeverageContractType:", factoryLeverageContractType.toString());

      expect(await deployedSuite.contracts(factoryLeverageContractType)).to.be.equals(leverageContractAddress);


      const deployedLeverage = await Leverage.at(
        leverageContractAddress
      );
      assert.equal(deployedSuiteFactory.address, await deployedLeverage.owner());

      return {
        suite: _suites0,
        deployedPredictionCollateralization: deployedPredictionCollateralization,
        deployedWhiteToken: deployedWhiteToken,
        deployedBlackToken: deployedBlackToken,
        deployedPredictionPool: deployedPredictionPool,
        deployedEventLifeCycle: deployedEventLifeCycle,
        deployedPendingOrders: deployedPendingOrders,
        deployedLeverage: deployedLeverage
      }
    }

    describe("Suite", () => {
      it('should create 50 suites for 7 users and print it', async () => {
        const firstUser = accounts[2];
        const secondUser = accounts[3];
        const thirdUser = accounts[4];

        await expectRevert(
          deployedSuiteList.getUserSuitesByPage(
            firstUser,
            0,
            new BN(maxPageSize.toString(10)),
            { from: firstUser }
          ), "Start index must be less than suites length"
        );

        await expectRevert(
          deployedSuiteFactory.deploySuite(
            "SomeSuiteOfFirstUser",
            deployedCollateralToken.address,
            { from: firstUser }
          ), "WhiteList address not defined"
        );

        expect(await deployedSuiteFactory._suiteList()).to.be.equals(deployedSuiteList.address);

        await deployedSuiteFactory.setSuiteList(deployedSuiteList.address)
        await deployedSuiteList.setWhiteList(deployedWhiteList.address)

        await deploySuite(firstUser, "SomeSuiteOfFirstUser1", deployedCollateralToken.address);
        await deploySuite(firstUser, "SomeSuiteOfFirstUser2", deployedCollateralToken.address);
        await deploySuite(secondUser, "SomeSuiteOfSecondUser1", deployedCollateralToken.address);
        await deploySuite(firstUser, "SomeSuiteOfFirstUser3", deployedCollateralToken.address);
        await deploySuite(thirdUser, "SomeSuiteOfThirdUser1", deployedCollateralToken.address);
        await deploySuite(secondUser, "SomeSuiteOfSecondUser2", deployedCollateralToken.address);
        await deploySuite(firstUser, "SomeSuiteOfFirstUser4", deployedCollateralToken.address);
        await deploySuite(thirdUser, "SomeSuiteOfThirdUser2", deployedCollateralToken.address);
        // await deploySuite(secondUser, "SomeSuiteOfSecondUser2", deployedCollateralToken.address);


        const getUserSuitesByPageFirstUser = await deployedSuiteList.getUserSuitesByPage(
          firstUser, 0, new BN(maxPageSize.toString(10))
        );
        if (debug) console.log("getUserSuitesByPageFirstUser  :", getUserSuitesByPageFirstUser);

        const getUserSuitesByPageSecondUser = await deployedSuiteList.getUserSuitesByPage(
          secondUser, 0, new BN(maxPageSize.toString(10))
        );
        if (debug) console.log("getUserSuitesByPageSecondUser :", getUserSuitesByPageSecondUser);

        const getUserSuitesByPageThirdUser = await deployedSuiteList.getUserSuitesByPage(
          thirdUser, 0, new BN(maxPageSize.toString(10))
        );
        if (debug) console.log("getUserSuitesByPageThirdUser :", getUserSuitesByPageThirdUser);

        // if (debug) console.log("getUserSuitesByPageSecondUser :", getUserSuitesByPageFirstUser[0]);

        if (debug) console.log("getUserSuitesCountFirstUser  :", (await deployedSuiteList.getUserSuitesCount(firstUser)).toString());
        if (debug) console.log("getUserSuitesCountSecondUser :", (await deployedSuiteList.getUserSuitesCount(secondUser)).toString());
        if (debug) console.log("getUserSuitesCountThirdUser  :", (await deployedSuiteList.getUserSuitesCount(thirdUser)).toString());



        // for (var i = 0; i < Number(getUserSuitesByPageSecondUser); i++) {
        for (var i = 0; i < Number((await deployedSuiteList.getUserSuitesCount(firstUser)).toString()); i++) {
          const x = await deployedSuiteList._suiteIndexesByUserMap(firstUser, i)
          if (debug) console.log("_suiteIndexesByUser1Map :",
            x.toString(),
            (await deployedSuiteList._suites(x)),
          );
        }

        for (var i = 0; i < Number((await deployedSuiteList.getUserSuitesCount(secondUser)).toString()); i++) {
          const x = await deployedSuiteList._suiteIndexesByUserMap(secondUser, i)
          if (debug) console.log("_suiteIndexesByUser2Map :",
            x.toString(),
            (await deployedSuiteList._suites(x)),
          );
        }

        for (var i = 0; i < Number((await deployedSuiteList.getUserSuitesCount(thirdUser)).toString()); i++) {
          const x = await deployedSuiteList._suiteIndexesByUserMap(thirdUser, i)
          if (debug) console.log("_suiteIndexesByUser3Map :",
            x.toString(),
            (await deployedSuiteList._suites(x)),
          );
        }

        const getSuitesCountBefore = await deployedSuiteList.getSuitesCount();
        if (debug) console.log("getSuitesCount:", getSuitesCountBefore.toString());


        for (var i = 0; i < Number(getSuitesCountBefore.toString()); i++) {
          const x = await deployedSuiteList._suites(i)
          if (debug) console.log(`_suites[${i}]:`, x);
        }

        for (var i = 0; i < Number((await deployedSuiteList.getUserSuitesCount(firstUser)).toString()); i++) {
          const x = await deployedSuiteList._suiteIndexesByUserMap(firstUser, i)
          if (debug) console.log("_suiteIndexesByUser1Map :",
            x.toString(),
            (await deployedSuiteList._suites(x)),
          );
        }

        for (var i = 0; i < Number((await deployedSuiteList.getUserSuitesCount(secondUser)).toString()); i++) {
          const x = await deployedSuiteList._suiteIndexesByUserMap(secondUser, i)
          if (debug) console.log("_suiteIndexesByUser2Map :",
            x.toString(),
            (await deployedSuiteList._suites(x)),
          );
        }

        for (var i = 0; i < Number((await deployedSuiteList.getUserSuitesCount(thirdUser)).toString()); i++) {
          const x = await deployedSuiteList._suiteIndexesByUserMap(thirdUser, i)
          if (debug) console.log("_suiteIndexesByUser3Map :",
            x.toString(),
            (await deployedSuiteList._suites(x)),
          );
        }

        const getSuitesCountAfter = await deployedSuiteList.getSuitesCount();
        if (debug) console.log("getSuitesCount:", getSuitesCountAfter.toString());


        for (var i = 0; i < Number(getSuitesCountAfter.toString()); i++) {
          const x = await deployedSuiteList._suites(i)
          if (debug) console.log(`_suites[${i}]:`, x);
        }

        const getUserSuitesByPageFirstUserAfterDelete = await deployedSuiteList.getUserSuitesByPage(
          firstUser, 0, new BN(maxPageSize.toString(10))
        );
        if (debug) console.log("getUserSuitesByPageFirstUser  :", getUserSuitesByPageFirstUserAfterDelete);

        const getUserSuitesByPageSecondUserAfterDelete = await deployedSuiteList.getUserSuitesByPage(
          secondUser, 0, new BN(maxPageSize.toString(10))
        );
        if (debug) console.log("getUserSuitesByPageSecondUser :", getUserSuitesByPageSecondUserAfterDelete);

        const getUserSuitesByPageThirdUserAfterDelete = await deployedSuiteList.getUserSuitesByPage(
          thirdUser, 0, new BN(maxPageSize.toString(10))
        );
        if (debug) console.log("getUserSuitesByPageThirdUser :", getUserSuitesByPageThirdUserAfterDelete);

        if (debug) console.log("getUserSuitesCountFirstUser  :", (await deployedSuiteList.getUserSuitesCount(firstUser)).toString());
        if (debug) console.log("getUserSuitesCountSecondUser :", (await deployedSuiteList.getUserSuitesCount(secondUser)).toString());
        if (debug) console.log("getUserSuitesCountThirdUser  :", (await deployedSuiteList.getUserSuitesCount(thirdUser)).toString());

      });




      it('should create 50 suites for 7 users and print it', async () => {

        const countSuitesForTest = 50;
        if (debug) console.log("acountSuitesForTest :", countSuitesForTest);
        if (debug) console.log("accounts.length     :", accounts.length);

        const maxAccountInUse = 6;
        const startAccountInUse = (maxAccountInUse / 2);// - 1;
        const endAccountInUse = accounts.length - (maxAccountInUse / 2);// + 1;
        let y = startAccountInUse;
        if (debug) console.log("startAccountInUse   :", startAccountInUse);
        if (debug) console.log("endAccountInUse     :", endAccountInUse);

        await expectRevert(
          deployedSuiteFactory.deploySuite(
            "SomeNameSuite",
            deployedCollateralToken.address,
            { from: accounts[1] }
          ), "WhiteList address not defined"
        );

        expect(await deployedSuiteFactory._suiteList()).to.be.equals(deployedSuiteList.address);

        await deployedSuiteFactory.setSuiteList(deployedSuiteList.address)
        await deployedSuiteList.setWhiteList(deployedWhiteList.address)

        for (let i = 0; i < countSuitesForTest; i++) {
          await deploySuite(accounts[y], "SomeNameSuite", deployedCollateralToken.address);
          y++;
          if (y >= endAccountInUse) y=startAccountInUse;
          else if (y <= startAccountInUse) y=endAccountInUse;
        }

        const iterations = Math.floor(countSuitesForTest / maxPageSize);
        if (debug) console.log("iterations          :", iterations);
        await Promise.all(
          [...Array(iterations).keys()].map(async (iteration) => {
            const getSuitesByPage = await deployedSuiteList.getSuitesByPage(new BN(iteration.toString(10)), new BN(maxPageSize.toString(10)));
            if (debug) console.log("getSuitesByPage     :", getSuitesByPage);
          })
        )

        const remain = countSuitesForTest % maxPageSize;
        if (remain > 0) {
          const getSuitesByPage = await deployedSuiteList.getSuitesByPage(new BN((countSuitesForTest-remain).toString(10)), new BN(remain.toString(10)));
          if (debug) console.log("getSuitesByPage     :", getSuitesByPage);
        }
        if (debug) console.log("iterationD          :", countSuitesForTest % maxPageSize);

        let i = startAccountInUse;
        for (i=startAccountInUse; i<=endAccountInUse; i++) {
          if (debug) console.log("i                   :", i);
          const getUserSuitesCount = await deployedSuiteList.getUserSuitesCount(accounts[i]);
          const userIterations = Math.floor(getUserSuitesCount / maxPageSize);
          await Promise.all(
            [...Array(userIterations).keys()].map(async (iteration) => {
              const getUserSuitesByPage = await deployedSuiteList.getUserSuitesByPage(accounts[i], new BN(iteration.toString(10)), new BN(maxPageSize.toString(10)));
              if (debug) console.log("getUserSuitesByPage :", getUserSuitesByPage);
            })
          )
          const userRemain = getUserSuitesCount % maxPageSize;
          if (userRemain > 0) {
            const getUserSuitesByPage = await deployedSuiteList.getUserSuitesByPage(accounts[i], new BN((getUserSuitesCount-userRemain).toString(10)), new BN(userRemain.toString(10)));
            if (debug) console.log("getUserSuitesByPage   :", getUserSuitesByPage);
          }
        }

      });

      it('should revert create suite if WhiteList address not defined', async () => {
        await expectRevert(
          deployedSuiteFactory.deploySuite(
            "SomeNameSuite",
            deployedCollateralToken.address,
            { from: accounts[9] }
          ), "WhiteList address not defined"
        );
      })

      it('should revert create suite if parameter suiteName is null', async () => {
        await setWhiteList(
          "PREDICTION_COLLATERAL",
          deployedPredictionCollateralFactory.address
        );

        await expectRevert(
          deployedSuiteFactory.deploySuite(
            "",
            deployedCollateralToken.address,
            { from: accounts[9] }
          ), "Parameter suiteName is null"
        );
      })

      it('should revert create suite if don`t have enough commission tokens', async () => {
        await setWhiteList(
          "PREDICTION_COLLATERAL",
          deployedPredictionCollateralFactory.address
        );

        await expectRevert(
          deployedSuiteFactory.deploySuite(
            "SomeNameSuite",
            deployedCollateralToken.address,
            { from: accounts[9] }
          ), "You don't have enough commission tokens for the action"
        );
      })

      it('should revert create suite if not enough delegated commission tokens', async () => {
        await deployedPolToken.transfer(
          accounts[9],                    // address recipient
          ntob(commissionForCreateSuite), // uint256 amount
          { from: deployerAddress }
        )

        await setWhiteList(
          "PREDICTION_COLLATERAL",
          deployedPredictionCollateralFactory.address
        );

        await expectRevert(
          deployedSuiteFactory.deploySuite(
            "SomeNameSuite",
            deployedCollateralToken.address,
            { from: accounts[9] }
          ), "Not enough delegated commission tokens for the action"
        );
      })
    });

    describe("PredictionCollateral, PredictionPool, EventLifeCycle, PendingOrders and Leverage Factories", () => {
      it('should change PredictionPool fee proportions', async () => {
        await setWhiteList();

        await addToWhiteList(
          0, // "PREDICTION_COLLATERAL",
          deployedPredictionCollateralFactory.address
        );

        const deployedSuiteAddress = await deploySuite(
          someUser1,
          "SomeNameSuite",
          deployedCollateralToken.address
        );

        const _suites0 = await deployedSuiteList._suites(0);

        await deployedPredictionPoolFactory.changeProxyAddress(deployedPredictionPoolProxy.address);
        await deployedPredictionPoolProxy.setDeployer(deployedPredictionPoolFactory.address);

        const createCollateralContractTx = await deployedPredictionCollateralFactory.createContract(
          _suites0,                           // address suiteAddress,
          "testWhiteName",                    // string memory whiteName,
          "testWhiteSymbol",                  // string memory whiteSymbol,
          "testBlackName",                    // string memory blackName,
          "testBlackSymbol",                  // string memory blackSymbol
          { from: someUser1 }
        );

        const { logs: createCollateralContractTxLog } = createCollateralContractTx;
        const eventCount = 1;
        assert.equal(createCollateralContractTxLog.length, eventCount, `triggers must be ${eventCount} event`);

        expectEvent.inLogs(createCollateralContractTxLog, 'ContractCreated', {
          suiteAddress: _suites0,
          contractType: "PREDICTION_COLLATERAL"
        });

        await addToWhiteList(
          1, // "PREDICTION_POOL",
          deployedPredictionPoolFactory.address
        );

        expect(await deployedPredictionPoolFactory._governanceFee()).to.be.bignumber.equal(ntob(0.3));
        expect(await deployedPredictionPoolFactory._controllerFee()).to.be.bignumber.equal(ntob(0.35));
        expect(await deployedPredictionPoolFactory._bwAdditionFee()).to.be.bignumber.equal(ntob(0.35));

        await deployedPredictionPoolFactory.changeFeeProportion(
          ntob(0.2),                // uint256 governanceFee,
          ntob(0.33),               // uint256 controllerFee,
          ntob(0.37),               // uint256 bwAdditionFee
        );

        expect(await deployedPredictionPoolFactory._governanceFee()).to.be.bignumber.equal(ntob(0.2));
        expect(await deployedPredictionPoolFactory._controllerFee()).to.be.bignumber.equal(ntob(0.33));
        expect(await deployedPredictionPoolFactory._bwAdditionFee()).to.be.bignumber.equal(ntob(0.37));

        const createPoolContractTx = await deployedPredictionPoolFactory.createContract(
          _suites0,                                       // address suiteAddress,
          new BN("500000000000000000"),                   // uint256 whitePrice
          new BN("500000000000000000"),                   // uint256 blackPrice
          { from: someUser1 }
        );

        const { logs: createPoolContractTxLog } = createPoolContractTx;

        assert.equal(createPoolContractTxLog.length, eventCount, `triggers must be ${eventCount} event`);

        expectEvent.inLogs(createPoolContractTxLog, 'ContractCreated', {
          suiteAddress: _suites0,
          contractType: "PREDICTION_POOL"
        });

        const poolContractAddress = createPoolContractTx.logs[0].args.contractAddress;


        const deployedPredictionPool = await PredictionPool.at(
          poolContractAddress
        );

        await addToWhiteList(
          2, // "EVENT_LIFE_CYCLE",
          deployedEventLifeCycleFactory.address
        );
        await deployedEventLifeCycleFactory.createContract(
          _suites0,                                       // address suiteAddress,
          someUser1,                                      // address oracleAddress
          { from: someUser1 }
        );

        await deployedPredictionPoolFactory.initPredictionPool(
          _suites0,                             // address suiteAddress
          ntob(0.002),
          { from: someUser1 }
        )

        expect(await deployedPredictionPool.FEE()).to.be.bignumber.equal(ntob(0.002));
        expect(await deployedPredictionPool._governanceFee()).to.be.bignumber.equal(ntob(0.2));
        expect(await deployedPredictionPool._controllerFee()).to.be.bignumber.equal(ntob(0.33));
        expect(await deployedPredictionPool._bwAdditionFee()).to.be.bignumber.equal(ntob(0.37));
      });

      it('should create PredictionCollateral, PredictionPool, EventLifeCycle and PendingOrders contracts and add its to user`s suite', async () => {
        const deployedContracts = await deployFactoryContracts();

        const buyPayment = mntob(5, multiplier);
        const initialBlackOrWhitePrice = mntob(0.5, multiplier);
        await buyTokens(deployedContracts, false, buyPayment, initialBlackOrWhitePrice);
        await buyTokens(deployedContracts, true, buyPayment, initialBlackOrWhitePrice);
      });

      it('should create PredictionCollateral, PredictionPool, EventLifeCycle, PendingOrders and Leverage contracts and add its to user`s suite', async () => {
        const {
          suite,
          deployedPredictionCollateralization,
          deployedWhiteToken,
          deployedBlackToken,
          deployedPredictionPool,
          deployedEventLifeCycle,
          deployedPendingOrders,
          deployedLeverage
        } = await deployFactoryContracts();

        const eventDuration = time.duration.seconds(5);

        await expectRevert(
          deployedSuiteFactory.enableLeverage(
            suite
          ), "Caller should be suite owner"
        );

        await deployedSuiteFactory.enablePendingOrders(
          suite,
          { from: someUser1 }
        );

        await deployedSuiteFactory.enableLeverage(
          suite,
          { from: someUser1 }
        );

        await addLiquidityToPrediction(deployedPredictionPool, deployedPredictionCollateralization, 50000);

        expect(await deployedEventLifeCycle._useLeverage()).to.be.equals(true);
        expect(await deployedEventLifeCycle._leverage()).to.be.equals(deployedLeverage.address);

        const user = accounts[4];

        const collateralAmount = mntob(20, multiplier);
        const maxLossUserDefined = ntob(0.25);
        const userSelectedEventId = new BN("100");

        const liquidityAmount = mntob(2000, multiplier);
        const thresholdAmount = mntob(1600, multiplier);

        expect(await deployedLeverage.getLpRatio()).to.be.bignumber.equal(ntob(1));

        if (debug) console.log("collateralAmount:  ", collateralAmount.toString())
        if (debug) console.log("maxLossUserDefined:", maxLossUserDefined.toString())
        if (debug) console.log("liquidityAmount:   ", liquidityAmount.toString())

        await expectRevert(
          deployedLeverage.createOrder(
            collateralAmount,     // uint256 amount
            true,                 // bool isWhite,
            ntob(25),             // uint256 maxLoss,
            userSelectedEventId,  // uint256 eventId
          ), "MAX LOSS PERCENT IS VERY BIG"
        );

        await expectRevert(
          deployedLeverage.createOrder(
            collateralAmount,     // uint256 amount
            true,                 // bool isWhite,
            maxLossUserDefined,   // uint256 maxLoss,
            userSelectedEventId,  // uint256 eventId
            { from: user }
          ), "NOT ENOUGH COLLATERAL IN USER ACCOUNT"
        );

        expect(await deployedCollateralToken.balanceOf(user)).to.be.bignumber.equal(new BN("0"));

        await deployedCollateralToken.transfer(user, collateralAmount, { from: deployerAddress })

        expect(await deployedCollateralToken.balanceOf(user)).to.be.bignumber.equal(collateralAmount);

        await expectRevert(
          deployedLeverage.createOrder(
            collateralAmount,     // uint256 amount
            true,                 // bool isWhite,
            maxLossUserDefined,   // uint256 maxLoss,
            userSelectedEventId,  // uint256 eventId
            { from: user }
          ), "NOT ENOUGHT DELEGATED TOKENS"
        );

        await deployedCollateralToken.approve(deployedLeverage.address, collateralAmount, { from: user })

        expect(
          await deployedCollateralToken.balanceOf(deployedLeverage.address)
        ).to.be.bignumber.equal(new BN("0"));

        await deployedCollateralToken.approve(deployedLeverage.address, liquidityAmount, { from: deployerAddress })

        expect(
          await deployedLeverage.allowedBorrowTotal()
        ).to.be.bignumber.equal(new BN("0"));

        expect(
          await deployedLeverage.allowedBorrowLeft()
        ).to.be.bignumber.equal(new BN("0"));

        if (debug) console.log("======threshold0:   ", (await deployedLeverage.allowedBorrowTotal()).toString())
        if (debug) console.log("======threshold0:   ", (await deployedLeverage.allowedBorrowLeft()).toString())

        await expectRevert(
          deployedLeverage.createOrder(
            collateralAmount,     // uint256 amount
            true,                 // bool isWhite,
            maxLossUserDefined,   // uint256 maxLoss,
            userSelectedEventId,  // uint256 eventId
            { from: user }
          ), "NOT ENOUGH COLLATERAL BALANCE FOR BORROW"
        );

        await deployedLeverage.addLiquidity(liquidityAmount, { from: deployerAddress })

        expect(
          await deployedCollateralToken.balanceOf(deployedLeverage.address)
        ).to.be.bignumber.equal(liquidityAmount);

        expect(
          await deployedLeverage.allowedBorrowTotal()
        ).to.be.bignumber.equal(thresholdAmount);

        expect(
          await deployedLeverage.allowedBorrowLeft()
        ).to.be.bignumber.equal(thresholdAmount);

        if (debug) console.log("======threshold1:   ", (await deployedLeverage.allowedBorrowTotal()).toString())
        if (debug) console.log("======threshold1:   ", (await deployedLeverage.allowedBorrowLeft()).toString())

        await expectRevert(
          deployedLeverage.createOrder(
            collateralAmount,     // uint256 amount
            true,                 // bool isWhite,
            ntob(0),             // uint256 maxLoss,
            userSelectedEventId,  // uint256 eventId
            { from: user }
          ), "MAX LOSS PERCENT CANNOT BE 0"
        );

        await deployedLeverage.approve(deployedLeverage.address, liquidityAmount);
        await deployedLeverage.withdrawLiquidity(mntob(1800, multiplier))

        expect(
          await deployedLeverage.allowedBorrowTotal()
        ).to.be.bignumber.equal(mntob(160, multiplier));

        expect(
          await deployedLeverage.allowedBorrowLeft()
        ).to.be.bignumber.equal(mntob(160, multiplier));

        await expectRevert(
          deployedSuiteFactory.leverageChangeMaxUsageThreshold(
            suite,
            ntob(0.1)
          ), "Caller should be suite owner"
        );

        await deployedSuiteFactory.leverageChangeMaxUsageThreshold(
          suite,
          ntob(0.1),
          { from: someUser1 }
        );

        expect(
          await deployedLeverage.allowedBorrowTotal()
        ).to.be.bignumber.equal(mntob(20, multiplier));

        expect(
          await deployedLeverage.allowedBorrowLeft()
        ).to.be.bignumber.equal(mntob(20, multiplier));

        if (debug) console.log("======threshold1:   ", (await deployedLeverage.allowedBorrowTotal()).toString())
        if (debug) console.log("======threshold1:   ", (await deployedLeverage.allowedBorrowLeft()).toString())

        await expectRevert(
          deployedLeverage.createOrder(
            collateralAmount,     // uint256 amount
            true,                 // bool isWhite,
            ntob(0.49),           // uint256 maxLoss,
            userSelectedEventId,  // uint256 eventId
            { from: user }
          ), "NOT ENOUGH COLLATERAL BALANCE FOR BORROW"
        );

        await expectRevert(
          deployedSuiteFactory.leverageChangeMaxUsageThreshold(
            suite,
            ntob(0.8)
          ), "Caller should be suite owner"
        );

        await deployedSuiteFactory.leverageChangeMaxUsageThreshold(
          suite,
          ntob(0.8),
          { from: someUser1 }
        );

        expect(
          await deployedLeverage.allowedBorrowTotal()
        ).to.be.bignumber.equal(mntob(160, multiplier));

        expect(
          await deployedLeverage.allowedBorrowLeft()
        ).to.be.bignumber.equal(mntob(160, multiplier));

        if (debug) console.log("======threshold1:   ", (await deployedLeverage.allowedBorrowTotal()).toString())
        if (debug) console.log("======threshold1:   ", (await deployedLeverage.allowedBorrowLeft()).toString())

        await deployedCollateralToken.approve(deployedLeverage.address, mntob(1800, multiplier));
        await deployedLeverage.addLiquidity(mntob(1800, multiplier), { from: deployerAddress })

        const _collateralTokensLiquidity = new bigDecimal(
          (await deployedLeverage._collateralTokens()).toString()
        );

        await deployedLeverage.createOrder(
          collateralAmount,     // uint256 amount
          true,                 // bool isWhite,
          maxLossUserDefined,   // uint256 maxLoss,
          userSelectedEventId,  // uint256 eventId
          { from: user }
        )

        const firstOrder = getLogs(await deployedLeverage._orders(0));

        expect(firstOrder.orderer).to.be.equals(user);
        expect(firstOrder.cross).to.be.bignumber.equal('5000000000000000000');
        expect(firstOrder.ownAmount).to.be.bignumber.equal(mntob(20, multiplier));
        expect(firstOrder.borrowedAmount).to.be.bignumber.equal(mntob(80, multiplier));
        expect(firstOrder.isWhite).to.be.equals(true);
        expect(firstOrder.eventId).to.be.bignumber.equal(userSelectedEventId);

        if (debug) console.log("firstOrder:", firstOrder);
        if (debug) console.log("_orders(0):", getLogs(await deployedLeverage._orders(0)))

        expect(
          await deployedLeverage._borrowedCollateral()
        ).to.be.bignumber.equal(mntob(80, multiplier));

        expect(
          await deployedLeverage.allowedBorrowTotal()
        ).to.be.bignumber.equal(thresholdAmount);

        expect(
          await deployedLeverage.allowedBorrowLeft()
        ).to.be.bignumber.equal(thresholdAmount.sub(mntob(80, multiplier)));

        if (debug) console.log("======threshold2:   ", (await deployedLeverage.allowedBorrowTotal()).toString())
        if (debug) console.log("======threshold2:   ", (await deployedLeverage.allowedBorrowLeft()).toString())

        if (debug) console.log("_ordersOfUser:", getLogs(await deployedLeverage._ordersOfUser(user, 0)))

        expect((await deployedPendingOrders.ordersOfUser(deployedLeverage.address)).length).to.be.equals(0);

        await expectRevert(
          deployedLeverage.cancelOrder(0),
          "NOT YOUR ORDER"
        );

        const cancelOrder = await deployedLeverage.cancelOrder(0, { from: user });

        const { logs: cancelOrderLog } = cancelOrder;
        const eventCount = 2;
        assert.equal(cancelOrderLog.length, eventCount, `triggers must be ${eventCount} event`);
        expectEvent.inLogs(cancelOrderLog, 'Transfer', {
          from: deployedLeverage.address,
          to: user,
          value: collateralAmount
        });

        expectEvent.inLogs(cancelOrderLog, 'OrderCanceled', {
          id: '0',
          user: user
        });

        expect(
          await deployedLeverage._borrowedCollateral()
        ).to.be.bignumber.equal(new BN("0"));

        expect(
          await deployedLeverage.allowedBorrowTotal()
        ).to.be.bignumber.equal(thresholdAmount);

        expect(
          await deployedLeverage.allowedBorrowLeft()
        ).to.be.bignumber.equal(thresholdAmount);

        expect(
          await deployedCollateralToken.balanceOf(deployedLeverage.address)
        ).to.be.bignumber.equal(liquidityAmount);

        if (debug) console.log("======threshold3:   ", (await deployedLeverage.allowedBorrowTotal()).toString())
        if (debug) console.log("======threshold3:   ", (await deployedLeverage.allowedBorrowLeft()).toString())

        if (debug) console.log("balanceOf only liquidity:", ( await deployedCollateralToken.balanceOf(deployedLeverage.address)).toString())

        // await expectRevert(
        //   addAndStartEvent(
        //     deployedEventLifeCycle,
        //     userSelectedEventId,
        //     time.duration.seconds(5),
        //     new BN("50000000000000000")
        //   ),
        //   "PENDING ORDERS DISABLED"
        // );

        await expectRevert(
          deployedEventLifeCycle.setPendingOrders(
            deployedPendingOrders.address,
            true,
            { from: deployerAddress }
          ), "Caller should be Governance"
        );

        await expectRevert(
          deployedSuiteFactory.enablePendingOrders(
            suite
          ), "Caller should be suite owner"
        );

        await expectRevert(
          deployedSuiteFactory.enablePendingOrders(
            suite,
            { from: someUser1 }
          ), "The action is not available while there are orders in the PredictionPool"
        );

        await addAndStartEvent(
          deployedEventLifeCycle,
          userSelectedEventId,
          time.duration.seconds(5),
          new BN("50000000000000000")
        );

        await time.increase(eventDuration);

        if (debug) console.log("START EVENT");

        if (debug) console.log("totalBorrowed      :   ", getLogs(await deployedLeverage._events(userSelectedEventId)));
        if (debug) console.log("_borrowedCollateral:   ", (await deployedLeverage._borrowedCollateral()).toString());

        expect(
          await deployedLeverage._borrowedCollateral()
        ).to.be.bignumber.equal(new BN("0"));

        expect(
          await deployedLeverage.allowedBorrowTotal()
        ).to.be.bignumber.equal(thresholdAmount);

        expect(
          await deployedLeverage.allowedBorrowLeft()
        ).to.be.bignumber.equal(thresholdAmount);

        await expectRevert(
          deployedEventLifeCycle.endEvent(
            new BN("0")
          ),
          "Caller should be Oracle"
        );

        await deployedEventLifeCycle.endEvent(
          new BN("0"),
          { from: someUser1 } // this is suiteOwner
        );

        if (debug) console.log("END EVENT");

        await deployedLeverage.withdrawCollateral(accounts[4]);

        if (debug) console.log("======threshold4:   ", (await deployedLeverage.allowedBorrowTotal()).toString())
        if (debug) console.log("======threshold4:   ", (await deployedLeverage.allowedBorrowLeft()).toString())

        const events = [
          { id: "102", priceChangePart: '50000000000000000', duration: 5, result: '1' },
          { id: "103", priceChangePart: '50000000000000000', duration: 15, result: '0' },
          { id: "104", priceChangePart: '50000000000000000', duration: 25, result: '-1' },
          { id: "105", priceChangePart: '50000000000000000', duration: 35, result: '1' }
        ]

        const orders = [                                                                                // ifWhiteWin | ifBlackWin
          { user: 1, ownAmount: 160, isWhite: false, maxLoss: 0.13, eventId: '102' }, // 2,6 -- 416     - 139,2       |
          { user: 1, ownAmount: 22,  isWhite: true,  maxLoss: 0.24, eventId: '102' }, // 4,8 -- 105,6   -
          { user: 3, ownAmount: 100, isWhite: false, maxLoss: 0.37, eventId: '102' }, // 7,4 -- 740     - 63          |
          { user: 4, ownAmount: 56,  isWhite: true,  maxLoss: 0.42, eventId: '102' }, // 8,4 -- 470,4   -
          { user: 4, ownAmount: 55,  isWhite: false, maxLoss: 0.11, eventId: '102' }, // 2,2 -- 121     - 48,95       |
          { user: 5, ownAmount: 34,  isWhite: true,  maxLoss: 0.09, eventId: '102' }, // 1,8 -- 61,2    -

          { user: 4, ownAmount: 34,  isWhite: true,  maxLoss: 0.09, eventId: '103' }, // 1,8 -- 61,2
          { user: 3, ownAmount: 340, isWhite: false, maxLoss: 0.09, eventId: '104' }, // 1,8 -- 612
        ]

        const nowEvent = events[0];

        const currentOrders = orders.filter(el => el.eventId === nowEvent.id)

        const ownAmountSum = currentOrders
          .map((el) => { return mntob(el.ownAmount, multiplier); })
          .reduce((prev, curr) => prev.add(curr), new BN('0'));

        if (debug) console.log(`ownAmountSum  :`, ownAmountSum.toString())

        const calcTotal = (el) => {
          const maxLossBD = new bigDecimal(el.maxLoss.toString(10)).multiply(new bigDecimal(BONE.toString(10)));
          const crossBD = maxLossBD.divide(new bigDecimal(nowEvent.priceChangePart), 18)
          const ownAmountBD = new bigDecimal(mntob(el.ownAmount, multiplier).toString());
          const totalAmountBD = ownAmountBD.multiply(crossBD);
          el.borrowedAmount = new BN(totalAmountBD.subtract(ownAmountBD).getValue());
          el.total = new BN(totalAmountBD.getValue());
          return el;
        }

        const totalAmountSum = currentOrders
          .map(calcTotal)
          .reduce((prev, curr) => prev.add(curr.total), new BN('0'));

        const crossAmountSum = totalAmountSum.sub(ownAmountSum);

        if (debug) console.log(`totalAmountSum:`, totalAmountSum.toString())
        if (debug) console.log(`crossAmountSum:`, crossAmountSum.toString())

        let _borrowedCollateral = new BN("0");
        let allowedBorrowLeft = await deployedLeverage.allowedBorrowLeft();

        for (const i of [...Array(currentOrders.length).keys()]) {
          await leverageCreateOrder(
            deployedLeverage,
            accounts[currentOrders[i].user],                // user
            mntob(currentOrders[i].ownAmount, multiplier),  // collateralAmount
            currentOrders[i].isWhite,                       // isWhite
            ntob(currentOrders[i].maxLoss),                 // maxLoss
            currentOrders[i].eventId                        // eventId
          );

          const total = new BN(new bigDecimal(ntob(currentOrders[i].maxLoss).toString()).divide(
            new bigDecimal(ntob(0.05).toString())
          ).multiply(
            new bigDecimal(mntob(currentOrders[i].ownAmount, multiplier).toString())
          ).getValue())

          if (debug) console.log(`ownAmnt: `, mntob(currentOrders[i].ownAmount, multiplier).toString())
          if (debug) console.log(`total:   `, total.toString())
          const borrowed = total.sub(mntob(currentOrders[i].ownAmount, multiplier))
          allowedBorrowLeft = allowedBorrowLeft.sub(borrowed)
          if (debug) console.log(`borrowed:`, borrowed.toString())

          _borrowedCollateral = _borrowedCollateral.add(borrowed)

          expect(
            await deployedLeverage._borrowedCollateral()
          ).to.be.bignumber.equal(_borrowedCollateral);

          expect(
            await deployedLeverage.allowedBorrowTotal()
          ).to.be.bignumber.equal(thresholdAmount);

          expect(
            await deployedLeverage.allowedBorrowLeft()
          ).to.be.bignumber.equal(allowedBorrowLeft);

          if (debug) console.log(`======threshold5-${i}:   `, (await deployedLeverage.allowedBorrowTotal()).toString())
          if (debug) console.log(`======threshold5-${i}:   `, (await deployedLeverage.allowedBorrowLeft()).toString())
        }

        expect(
          await deployedCollateralToken.balanceOf(deployedLeverage.address)
        ).to.be.bignumber.equal(ownAmountSum.add(liquidityAmount));

        if (debug) console.log("balanceOf after post orders:", ( await deployedCollateralToken.balanceOf(deployedLeverage.address)).toString())

        const pendingOrdersCountOfLeverageBeforeStart = await deployedPendingOrders.ordersOfUser(deployedLeverage.address);

        if (debug) console.log("ordersOfLeverageBeforeStart:", pendingOrdersCountOfLeverageBeforeStart)

        expect(pendingOrdersCountOfLeverageBeforeStart.length).to.equal(0);

        if (debug) console.log("_events:", getLogs(await deployedLeverage._events(nowEvent.id)))

        await expectRevert(
          addAndStartEvent(
            deployedEventLifeCycle,
            nowEvent.id,
            time.duration.seconds(nowEvent.duration),
            ntob(0.03)
          ),
          "WRONG PRICE CHANGE PART"
        );

        await addAndStartEvent(
          deployedEventLifeCycle,
          nowEvent.id,
          time.duration.seconds(nowEvent.duration),
          nowEvent.priceChangePart
        );

        if (debug) console.log("balanceOf              :   ", (await deployedCollateralToken.balanceOf(deployedLeverage.address)).toString());
        if (debug) console.log("_collateralTokens      :   ", (await deployedLeverage._collateralTokens()).toString());
        if (debug) console.log("_lpTokens              :   ", (await deployedLeverage._lpTokens()).toString());

        await expectRevert(
          deployedLeverage.withdrawLiquidity(mntob(2001, multiplier)),
          "NOT ENOUGH LIQUIDITY TOKENS ON THE USER BALANCE"
        );

        await expectRevert(
          deployedLeverage.withdrawLiquidity(mntob(2000, multiplier)),
          "NOT ENOUGH COLLATERAL IN THE CONTRACT"
        );
        await deployedLeverage.withdrawLiquidity(mntob(512.8, multiplier))
        await deployedCollateralToken.approve(deployedLeverage.address, mntob(512.8, multiplier));
        await deployedLeverage.addLiquidity(mntob(512.8, multiplier), { from: deployerAddress })

        await expectRevert(
          deployedLeverage.cancelOrder(1),
          "NOT YOUR ORDER"
        );

        await expectRevert(
          deployedLeverage.cancelOrder(1, { from: accounts[1]}),
          "EVENT IN PROGRESS"
        );

        const pendingOrdersCountOfLeverageAfterStart = await deployedPendingOrders.ordersOfUser(deployedLeverage.address);

        if (debug) console.log(
          "ordersOfLeverageAfterStart:",
          pendingOrdersCountOfLeverageAfterStart.map((el) => { return el.toString()})
        )
        expect(pendingOrdersCountOfLeverageAfterStart.length).to.equal(2);

        expect(
          await deployedCollateralToken.balanceOf(deployedLeverage.address)
        ).to.be.bignumber.equal(
          ownAmountSum.add(liquidityAmount).sub(totalAmountSum)
        );

        expect(
          await deployedCollateralToken.balanceOf(deployedLeverage.address)
        ).to.be.bignumber.equal(liquidityAmount.sub(crossAmountSum));

        if (debug) console.log("balanceOf after start event:", (await deployedCollateralToken.balanceOf(deployedLeverage.address)).toString())

        await time.increase(eventDuration);

        await expectRevert(
          deployedEventLifeCycle.endEvent(
            nowEvent.result
          ),
          "Caller should be Oracle"
        );

        const endEvent = await deployedEventLifeCycle.endEvent(
          nowEvent.result,
          { from: someUser1 } // this is suiteOwner
        );

        if (debug) console.log("_events:", (await deployedLeverage._events(nowEvent.id)).orders)
        if (debug) console.log("_events:", getLogs(await deployedLeverage._events(nowEvent.id)))

        if (debug) console.log("balanceOf:", ( await deployedCollateralToken.balanceOf(deployedLeverage.address)).toString())

        if (debug) console.log("_whitePrice:", ( await deployedPredictionPool._whitePrice()).toString())
        if (debug) console.log("_blackPrice:", ( await deployedPredictionPool._blackPrice()).toString())

        const resultAmountSum = currentOrders
          .map(calcTotal)
          .reduce(
            (prev, curr) => prev.add(curr.total), new BN('0')
          );

        if (debug) console.log("resultAmountSum:", resultAmountSum.toString())

        const resultAmountSumBlack = currentOrders
          .filter(el => el.isWhite === false)
          .map(calcTotal)
          .reduce((prev, curr) => prev.add(curr.total), new BN('0'));

        const resultAmountSumWhite = currentOrders
          .filter(el => el.isWhite === true)
          .map(calcTotal)
          .reduce(
            (prev, curr) => prev.add(curr.total), new BN('0')
          );

        const eventInfo = await deployedLeverage._events(nowEvent.id);
        if (debug) console.log("resultAmountSumBlack:", resultAmountSumBlack.toString())
        if (debug) console.log("resultAmountSumWhite:", resultAmountSumWhite.toString())
        if (debug) console.log("balanceOf after end event  :", (await deployedCollateralToken.balanceOf(deployedLeverage.address)).toString())
        if (debug) console.log("_events:", getLogs(eventInfo))

        expect(eventInfo.blackCollateral).to.be.bignumber.equal(resultAmountSumBlack);
        expect(eventInfo.whiteCollateral).to.be.bignumber.equal(resultAmountSumWhite);

        // ? resultAmountSum

        const fee = new bigDecimal(
          (await deployedPredictionPool.FEE()).toString())
            .divide(new bigDecimal(BONE.toString(10)), 18);

        const whitePriceBefore = new bigDecimal(eventInfo.whitePriceBefore.toString())
            .divide(new bigDecimal(BONE.toString(10)), 18);
        const blackPriceBefore = new bigDecimal(eventInfo.blackPriceBefore.toString())
          .divide(new bigDecimal(BONE.toString(10)), 18);

        const whitePriceAfter = new bigDecimal(eventInfo.whitePriceAfter.toString())
            .divide(new bigDecimal(BONE.toString(10)), 18);
        const blackPriceAfter = new bigDecimal(eventInfo.blackPriceAfter.toString())
          .divide(new bigDecimal(BONE.toString(10)), 18);

        const xxx = (el) => {
          const amountBDb = new bigDecimal(el.total);
          const f = amountBDb.multiply(fee);
          const a = amountBDb.subtract(f);
          const n1 = a.divide(el.isWhite ? whitePriceBefore : blackPriceBefore, 18).round();
          const x = n1.multiply(el.isWhite ? whitePriceAfter : blackPriceAfter)
          const aFeeBD = x.multiply(fee).round();
          const collateralToSend = x.subtract(aFeeBD).round();
          el.collateralToSend = new BN(collateralToSend.getValue());
          return el;
        }

        const tmpUsers = currentOrders
          .map((el) => {
            return el.user;
          })
        const users = tmpUsers.filter(function(item, pos) {
          return tmpUsers.indexOf(item) == pos;
        })

        if (debug) console.log("users:", users);

        const withdraw = async (account) => {

          if (debug) console.log("account :", account);
          if (debug) console.log("currentOrders :", currentOrders.filter(el => el.user === account).map(el => getLogs(el)));

          const expectedWithdrawAmountByUser = currentOrders
            .filter(el => el.user === account)
            .map(calcTotal)
            .map(xxx)
            .reduce(
              (prev, curr) => prev.add(curr.collateralToSend.sub(curr.borrowedAmount)), new BN('0')
            );
          if (debug) console.log("expectedWithdrawAmountByUser :", expectedWithdrawAmountByUser.toString());

          const userBalanceBeforeWithdraw = await deployedCollateralToken.balanceOf(accounts[account]);

          if (debug) console.log("balanceOf before withdraw  :", account, userBalanceBeforeWithdraw.toString());

          if (debug) console.log("balanceOf before withdraw  :", (await deployedCollateralToken.balanceOf(deployedLeverage.address)).toString())

          const resWithdrawCollateral = await deployedLeverage.withdrawCollateral(accounts[account]);

          const { logs: resWithdrawCollateralLog } = resWithdrawCollateral;
          const withdrawEventCount = 2;
          assert.equal(
            resWithdrawCollateralLog.length,
            withdrawEventCount,
            `triggers must be ${withdrawEventCount} event`
          );

          expectEvent.inLogs(resWithdrawCollateralLog, 'CollateralWithdrew', {
            amount: expectedWithdrawAmountByUser, /* Temporary disabled */
            user: accounts[account],
            caller: deployerAddress
          });

          expectEvent.inLogs(resWithdrawCollateralLog, 'Transfer', {
            from: deployedLeverage.address,
            to: accounts[account],
            value: expectedWithdrawAmountByUser /* Temporary disabled */
          });

          const userBalanceAfterWithdraw = await deployedCollateralToken.balanceOf(accounts[account]);
          expect(userBalanceAfterWithdraw).to.be.bignumber.equal(
            userBalanceBeforeWithdraw.add(expectedWithdrawAmountByUser)
          );
          if (debug) console.log("balanceOf after withdraw   :", (await deployedCollateralToken.balanceOf(deployedLeverage.address)).toString())
          if (debug) console.log("balanceOf after withdraw   :", account, userBalanceAfterWithdraw.toString())
        }

        for (let user of users) {
          if (debug) console.log("user:", user, accounts[user]);
          const ordersOfUser = await deployedLeverage.ordersOfUser(accounts[user]);


          expect(ordersOfUser.length).to.equal(currentOrders.filter(el => el.user === user).length);
          if (debug) console.log(`ordersOfUser[${user}]:`, ordersOfUser.map(el => el.toString()));
          await withdraw(user);
        }

        await expectRevert(
          deployedLeverage.withdrawCollateral(accounts[0]),
          "ACCOUNT HAS NO ORDERS"
        );

        if (debug) console.log("balanceOf after all done   :", (await deployedCollateralToken.balanceOf(deployedLeverage.address)).toString())

        const _ordersCounter = await deployedLeverage._ordersCounter();
        if (debug) console.log("_ordersCounter:", _ordersCounter.toNumber());

        for (let orderId of [...Array(_ordersCounter.toNumber()).keys()]) {
          const order = await deployedLeverage._orders(orderId);
          if (debug) console.log("_orders:", getLogs(order));
          expect(order.orderer).to.equal('0x0000000000000000000000000000000000000000');
          expect(order.cross).to.be.bignumber.equal(new BN("0"));
          expect(order.ownAmount).to.be.bignumber.equal(new BN("0"));
          expect(order.borrowedAmount).to.be.bignumber.equal(new BN("0"));
          expect(order.isWhite).to.equal(false);
          expect(order.eventId).to.be.bignumber.equal(new BN("0"));
          expect(order.isPending).to.equal(false);
        }

        const _leverageFee = await deployedLeverage._leverageFee();

        const leverageFee = new bigDecimal(_borrowedCollateral.toString()).multiply(
          new bigDecimal(_leverageFee.toString())
            .divide(new bigDecimal(BONE.toString(10)), 18)
        )

        if (debug) console.log("totalBorrowed:", _borrowedCollateral.toString());
        if (debug) console.log("_leverageFee:", _leverageFee.toString());
        if (debug) console.log("leverageFee:", leverageFee.getValue());

        const _lpTokens = new bigDecimal(
          (await deployedLeverage._lpTokens()).toString()
        );

        const expectedLpRatio = new BN(_collateralTokensLiquidity
          .add(leverageFee)
          .divide(_lpTokens, 18)
          .multiply(new bigDecimal(BONE.toString(10)))
          .getValue());

        if (debug) console.log("expectedLpRatio:", expectedLpRatio.toString());

        const _eventsById = await deployedLeverage._events(nowEvent.id);
        if (debug) console.log("_eventsById:", getLogs(_eventsById));

        if (debug) console.log("totalBorrowed      :   ", getLogs(await deployedLeverage._events(userSelectedEventId)));
        if (debug) console.log("_borrowedCollateral:   ", (await deployedLeverage._borrowedCollateral()).toString());

        if (debug) console.log("getLpRatio:   ", (await deployedLeverage.getLpRatio()).toString());
        expect(await deployedLeverage.getLpRatio()).to.be.bignumber.equal(expectedLpRatio);

        expect(
          await deployedLeverage._borrowedCollateral()
        ).to.be.bignumber.equal(new BN("0"));

        const _maxUsageThreshold = await deployedLeverage._maxUsageThreshold();

        const expectedAllowedBorrowTotal = new BN(_collateralTokensLiquidity
          .add(leverageFee)
          .multiply(new bigDecimal(_maxUsageThreshold.toString()).divide(new bigDecimal(BONE.toString(10)), 18))
          .getValue()
        );

        if (debug) console.log("expectedAllowedBorrowTotal:", expectedAllowedBorrowTotal.toString());

        expect(
          await deployedLeverage.allowedBorrowTotal()
        ).to.be.bignumber.equal(expectedAllowedBorrowTotal);

        expect(
          await deployedLeverage.allowedBorrowLeft()
        ).to.be.bignumber.equal(expectedAllowedBorrowTotal);

        if (debug) console.log("======threshold4:   ", (await deployedLeverage.allowedBorrowTotal()).toString())
        if (debug) console.log("======threshold4:   ", (await deployedLeverage.allowedBorrowLeft()).toString())
      });

      it('should create contracts and cant enable PendingOrders', async () => {
        const deployedContracts = await deployFactoryContracts();

        const buyPayment = mntob(5, multiplier);
        const initialBlackOrWhitePrice = mntob(0.5, multiplier);
        await buyTokens(deployedContracts, false, buyPayment, initialBlackOrWhitePrice);
        await buyTokens(deployedContracts, true, buyPayment, initialBlackOrWhitePrice);

        await expectRevert(
          deployedSuiteFactory.enablePendingOrders(
            deployedContracts.suite
          ), "Caller should be suite owner"
        );

        await expectRevert(
          deployedSuiteFactory.enablePendingOrders(
            deployedContracts.suite,
            { from: someUser1 }
          ), "The action is not available while there are orders in the PredictionPool"
        );
      });

      it('should create contracts and enable PendingOrders', async () => {
        const deployedContracts = await deployFactoryContracts();

        await expectRevert(
          deployedSuiteFactory.enablePendingOrders(
            deployedContracts.suite
          ), "Caller should be suite owner"
        );

        await deployedSuiteFactory.enablePendingOrders(
          deployedContracts.suite,
          { from: someUser1 }
        );

        const buyPayment = new BN("5000000000000000000");
        const initialBlackOrWhitePrice = new BN("500000000000000000");

        await expectRevert(
          deployedContracts.deployedPredictionPool.buyWhite(
            initialBlackOrWhitePrice,
            buyPayment,
            { from: someUser3 }
          ), "Incorrerct orderer"
        );
        await expectRevert(
          deployedContracts.deployedPredictionPool.buyBlack(
            initialBlackOrWhitePrice,
            buyPayment,
            { from: someUser3 }
          ), "Incorrerct orderer"
        );
      });

      it('should create contracts and enable PendingOrders', async () => {
        const deployedContracts = await deployFactoryContracts();

        await expectRevert(
          deployedSuiteFactory.enablePendingOrders(
            deployedContracts.suite
          ), "Caller should be suite owner"
        );

        await deployedSuiteFactory.enablePendingOrders(
          deployedContracts.suite,
          { from: someUser1 }
        );

        const buyPayment = new BN("5000000000000000000");
        const initialBlackOrWhitePrice = new BN("500000000000000000");

        await expectRevert(
          deployedContracts.deployedPredictionPool.buyWhite(
            initialBlackOrWhitePrice,
            buyPayment,
            { from: someUser3 }
          ), "Incorrerct orderer"
        );
        await expectRevert(
          deployedContracts.deployedPredictionPool.buyBlack(
            initialBlackOrWhitePrice,
            buyPayment,
            { from: someUser3 }
          ), "Incorrerct orderer"
        );
      });
    });

    const sellTokens = async (deployedContracts, isWhite, buyPayment, initialBlackOrWhitePrice) => {
      const {
        deployedPredictionCollateralization,
        deployedWhiteToken,
        deployedBlackToken,
        deployedPredictionPool,
        deployedEventLifeCycle,
        deployedPendingOrders
      } = deployedContracts;

      if (isWhite) {
        await deployedWhiteToken.approve(
          deployedPredictionCollateralization.address,  // address spender,
          new BN("9980000000000000000"),                // uint256 value
          { from: someUser3 }
        )
      } else {
        await deployedBlackToken.approve(
          deployedPredictionCollateralization.address,  // address spender,
          new BN("9980000000000000000"),                // uint256 value
          { from: someUser3 }
        )
      }

      const eventCountForSellAndBuy = 4;
      const MIN_HOLD = ntob(2);

      const sellTokenResult = isWhite ? await deployedPredictionPool.sellWhite(
        new BN("9980000000000000000").sub(MIN_HOLD),
        initialBlackOrWhitePrice,
        { from: someUser3 }
      ) : await deployedPredictionPool.sellBlack(
        new BN("9980000000000000000").sub(MIN_HOLD),
        initialBlackOrWhitePrice,
        { from: someUser3 }
      );
      const { logs: sellTokenLog } = sellTokenResult;
      assert.equal(sellTokenLog.length, eventCountForSellAndBuy, `triggers must be ${eventCountForSellAndBuy} event`);
    }

    const buyTokens = async (deployedContracts, isWhite, buyPayment, initialBlackOrWhitePrice) => {
      const {
        deployedPredictionCollateralization,
        deployedWhiteToken,
        deployedBlackToken,
        deployedPredictionPool,
        deployedEventLifeCycle,
        deployedPendingOrders
      } = deployedContracts;

      let collateralTokenUserBalance = await deployedCollateralToken.balanceOf(someUser3);

      expect(collateralTokenUserBalance).to.be.bignumber.at.equal(new BN("0"));

      const collateralTokenAllowance = await deployedCollateralToken.allowance(
        someUser3,                                    // address owner,
        deployedPredictionCollateralization.address   // address spender
      )
      if (debug) console.log("collTokenAllowance  :", collateralTokenAllowance.toString());

      if (isWhite) {
        await expectRevert(
          deployedPredictionPool.buyWhite(
            initialBlackOrWhitePrice,
            buyPayment,
            { from: someUser3 }
          ), "Not enough delegated tokens"
        );
      } else {
        await expectRevert(
          deployedPredictionPool.buyBlack(
            initialBlackOrWhitePrice,
            buyPayment,
            { from: someUser3 }
          ), "Not enough delegated tokens"
        );
      }

      await deployedCollateralToken.approve(
        deployedPredictionCollateralization.address,  // address spender,
        buyPayment,                                   // uint256 value
        { from: someUser3 }
      )

      expect(await deployedCollateralToken.allowance(
        someUser3,                                    // address owner,
        deployedPredictionCollateralization.address   // address spender
      )).to.be.bignumber.equal(collateralTokenAllowance.add(buyPayment));


      if (isWhite) {
        await expectRevert(
          deployedPredictionPool.buyWhite(
            initialBlackOrWhitePrice,
            buyPayment,
            { from: someUser3 }
          ), "SafeMath: subtraction overflow"
        ); // No balance on user account
      } else {
        await expectRevert(
          deployedPredictionPool.buyBlack(
            initialBlackOrWhitePrice,
            buyPayment,
            { from: someUser3 }
          ), "SafeMath: subtraction overflow"
        ); // No balance on user account
      }

      await deployedCollateralToken.transfer(someUser3, buyPayment);

      collateralTokenUserBalance = await deployedCollateralToken.balanceOf(someUser3);

      expect(collateralTokenUserBalance).to.be.bignumber.at.least(buyPayment);

      const eventCountForSellAndBuy = 4;

      const buyTokenResult = isWhite ? await deployedPredictionPool.buyWhite(
        initialBlackOrWhitePrice,
        buyPayment,
        { from: someUser3 }
      ) : await deployedPredictionPool.buyBlack(
        initialBlackOrWhitePrice,
        buyPayment,
        { from: someUser3 }
      );
      const { logs: buyTokenLog } = buyTokenResult;
      assert.equal(buyTokenLog.length, eventCountForSellAndBuy, `triggers must be ${eventCountForSellAndBuy} event`);



      if (isWhite) {
        const whiteBought = new BN("9980000000000000000");
        expectEvent.inLogs(buyTokenLog, 'BuyWhite', {
          user: someUser3,
          amount: whiteBought,
          price: initialBlackOrWhitePrice
        });
        expect(
          await deployedWhiteToken.balanceOf(someUser3)
        ).to.be.bignumber.equal(whiteBought);
      } else {
        const blackBought = new BN("9980000000000000000");
        expectEvent.inLogs(buyTokenLog, 'BuyBlack', {
          user: someUser3,
          amount: blackBought,
          price: initialBlackOrWhitePrice
        });
        expect(
          await deployedBlackToken.balanceOf(someUser3)
        ).to.be.bignumber.equal(blackBought);

      }
    }

    const addLiquidityToPrediction = async (deployedPredictionPool, deployedPredictionCollateralization, amount) => {
      const buyPayment = mntob(amount, multiplier);

      const collateralTokenDeployerBalance = await deployedCollateralToken.balanceOf(deployerAddress);
      if (debug) console.log("buyPayment                        :", buyPayment.toString())
      if (debug) console.log("collateralTokenDeployerBalance    :", collateralTokenDeployerBalance.toString())
      const collateralTokenDeployerAllowance = await deployedCollateralToken.allowance(deployerAddress, deployedPredictionPool.address);
      if (debug) console.log("collateralTokenDeployerAllowance  :", collateralTokenDeployerAllowance.toString())
      expect(collateralTokenDeployerBalance).to.be.bignumber.at.least(buyPayment);

      const collateralTokenPpBefore = await deployedCollateralToken.balanceOf(deployedPredictionPool.address);
      const collateralTokenPcBefore = await deployedCollateralToken.balanceOf(deployedPredictionCollateralization.address);
      const _whiteBoughtBefore = await deployedPredictionPool._whiteBought();
      const _blackBoughtBefore = await deployedPredictionPool._blackBought();

      await deployedCollateralToken.approve(deployedPredictionPool.address, buyPayment)

      expect(
        await deployedCollateralToken.allowance(deployerAddress, deployedPredictionPool.address)
      ).to.be.bignumber.at.least(buyPayment);
      if (debug) console.log("collateralTokenDeployerAllowance  :", (await deployedCollateralToken.allowance(deployerAddress, deployedPredictionPool.address)).toString())

      const addLiquidity = await deployedPredictionPool.addLiquidity(buyPayment);
      const { logs: addLiquidityLog } = addLiquidity;

      const wPrice = await deployedPredictionPool._whitePrice();
      const bPrice = await deployedPredictionPool._blackPrice();

      const sPrice = new bigDecimal(wPrice.toString()).add(new bigDecimal(bPrice.toString()));

      const bwAmount = new bigDecimal(buyPayment.toString())
        .divide(sPrice, 18)
        .multiply(new bigDecimal(BONE.toString(10)))
        .getValue();

      if (debug) console.log("collateralTokenPpBefore  :", collateralTokenPpBefore.toString())
      if (debug) console.log("collateralTokenPcBefore  :", collateralTokenPcBefore.toString())
      if (debug) console.log("wPrice  :", wPrice.toString())
      if (debug) console.log("bPrice  :", bPrice.toString())
      if (debug) console.log("sPrice  :", sPrice.getValue())
      if (debug) console.log("bwAmount:", bwAmount)

      expectEvent.inLogs(addLiquidityLog, 'AddLiquidity', {
        user: deployerAddress,
        whitePrice: wPrice,
        blackPrice: bPrice,
        bwAmount: bwAmount,
        colaterallAmount: buyPayment
      });

      const _whiteBoughtExpected = new bigDecimal(_whiteBoughtBefore.toString())
        .add(new bigDecimal(bwAmount))
        .getValue();

      const _blackBoughtExpected = new bigDecimal(_blackBoughtBefore.toString())
        .add(new bigDecimal(bwAmount))
        .getValue();

      const collateralTokenPpExpected = new bigDecimal(collateralTokenPpBefore.toString())
        .add(new bigDecimal(buyPayment))
        .getValue();

      expect(await deployedPredictionPool._whiteBought()).to.be.bignumber.equal(_whiteBoughtExpected);
      expect(await deployedPredictionPool._blackBought()).to.be.bignumber.equal(_blackBoughtExpected);

      if (debug) console.log(
        "collateralTokenPcBefore  :",
        (await deployedCollateralToken.balanceOf(
          deployedPredictionCollateralization.address
        )).toString()
      )

      expect(
        await deployedCollateralToken.balanceOf(deployedPredictionCollateralization.address)
      ).to.be.bignumber.equal(collateralTokenPpExpected);
    }

    const addAndStartEvent = async (deployedEventLifeCycle, eventId, duration, priceChangePart) => {
      const eventStartExpected = await time.latest();
      const eventEndExpected = eventStartExpected.add(duration);

      const suiteOwner = someUser1;

      const eventTx = await deployedEventLifeCycle.addAndStartEvent(
        priceChangePart,
        eventStartExpected,
        eventEndExpected,
        "Test Black team",
        "Test White team",
        "Test event type",
        "Test event series",
        "test event name ",
        eventId,
        { from: suiteOwner }
      );
      return eventTx;
    }

    const leverageCreateOrder = async (deployedLeverage, user, collateralAmount, isWhite, maxLoss, eventId) => {
      await deployedCollateralToken.transfer(user, collateralAmount, { from: deployerAddress });

      await deployedCollateralToken.approve(deployedLeverage.address, collateralAmount, { from: user });

      const order = await deployedLeverage.createOrder(
        collateralAmount,     // uint256 amount
        isWhite,              // bool isWhite,
        maxLoss,              // uint256 maxLoss,
        eventId,              // uint256 eventId
        { from: user }
      )

      const { logs: orderLog } = order;
      const eventCount = 3;
      assert.equal(orderLog.length, eventCount, `triggers must be ${eventCount} event`);

      expectEvent.inLogs(orderLog, 'Transfer', {
        from: user,
        to: deployedLeverage.address,
        value: collateralAmount
      });

      expectEvent.inLogs(orderLog, 'Approval', {
        owner: user,
        spender: deployedLeverage.address
      });

      const _priceChangePart = await deployedLeverage._priceChangePart();

      expectEvent.inLogs(orderLog, 'OrderCreated', {
        user: user,
        maxLoss: maxLoss,
        priceChangePart: _priceChangePart,
        ownAmount: collateralAmount,
        isWhite: isWhite,
        eventId: eventId
      });
    }

    describe("SuiteList", () => {
      it('getSuitesByPage test', async () => {
        await expectRevert(
          deployedSuiteList.getSuitesByPage(new BN("10"), new BN("31")), "Count must be less than 30"
        );

        await expectRevert(
          deployedSuiteList.getSuitesByPage(new BN("10"), new BN("5")), "Start index must be less than suites length"
        );

        await expectRevert(
          deployedSuiteFactory.deploySuite(
            "SomeNameSuite",
            deployedCollateralToken.address,
            { from: accounts[1] }
          ), "WhiteList address not defined"
        );

        expect(await deployedSuiteFactory._suiteList()).to.be.equals(deployedSuiteList.address);

        // await deployedSuiteFactory.setSuiteList(deployedSuiteList.address)
        await deployedSuiteList.setWhiteList(deployedWhiteList.address)

        const countSuitesForTest = 10;
        for (let i = 0; i < countSuitesForTest; i++) {
          await deploySuite(accounts[1], "SomeNameSuite", deployedCollateralToken.address);
        }

        if (debug) console.log("getSuitesByPage      :", await deployedSuiteList.getSuitesByPage(new BN("9"), new BN("5")));

        await expectRevert(
          deployedSuiteList.getSuitesByPage(new BN("10"), new BN("5")), "Start index must be less than suites length"
        );
      });

      it('should assert isSuiteExists equal false on start and true after create suite', async () => {
        const isSuiteExists = await deployedSuiteList.isSuiteExists(accounts[6]); // some address
        if (debug) console.log("isSuiteExists       :", isSuiteExists);
        expect(isSuiteExists).to.be.equals(false);

        await setWhiteList(
          "PREDICTION_COLLATERAL",
          deployedPredictionCollateralFactory.address
        );

        const deployedSuiteAddress = await deploySuite(
          someUser1,
          "SomeNameSuite",
          deployedCollateralToken.address
        );

        const _suites0 = await deployedSuiteList._suites(0);
        expect(_suites0).to.be.equals(deployedSuiteAddress);
        const _suiteIndexes = await deployedSuiteList._suiteIndexes(deployedSuiteAddress);
        const isSuiteExistsAfterCreate = await deployedSuiteList.isSuiteExists(deployedSuiteAddress);
        if (debug) console.log("_suites0            :", _suites0);
        if (debug) console.log("_suiteIndexes      :", _suiteIndexes.toString());
        if (debug) console.log("isSuiteExistsAfterCreate      :", isSuiteExistsAfterCreate);

        expect(isSuiteExistsAfterCreate).to.be.equals(true);
      });

      it('should assert balance of deployer`s Pol tokens equal total supply', async () => {
        const balance = await deployedPolToken.balanceOf(deployerAddress);
        if (debug) console.log("balance             :", balance.toString(10));
        expect(balance).to.be.bignumber.equal(ntob(polTokenSupply));
      });
    });
  });

})

const {
  BN,           // Big Number support
  time,
  constants,    // Common constants, like the zero address and largest integers
  expectEvent,  // Assertions for emitted events
  expectRevert, // Assertions for transactions that should fail
  snapshot
} = require('@openzeppelin/test-helpers');

const chai = require('chai');
const expect = require('chai').expect;

const { deployContracts, ntob, BONE } = require('./../utils.js');

const TokenTemplate = artifacts.require('TokenTemplate');
const ContractType = artifacts.require('ContractType');
const WhiteList = artifacts.require('WhiteList');
const SuiteFactory = artifacts.require('SuiteFactory');
const Suite = artifacts.require('Suite');
const SuiteList = artifacts.require('SuiteList');
const PredictionCollateralFactory = artifacts.require('PredictionCollateralFactory');
const PredictionPoolFactory = artifacts.require('PredictionPoolFactory');
const EventLifeCycleFactory = artifacts.require('EventLifeCycleFactory');
const PendingOrdersFactory = artifacts.require('PendingOrdersFactory');
const PredictionCollateralization = artifacts.require('PredictionCollateralization');
const PredictionPool = artifacts.require('PredictionPool');
const EventLifeCycle = artifacts.require('EventLifeCycle');
const PendingOrders = artifacts.require('PendingOrders');

const debug = 0;
// const debug = 1;
const maxPageSize = 30;
const polTokenSupply = 1000000000;
const commissionForCreateSuite = 1; // 1$

contract("DEV: Factories", (accounts) => {
  "use strict";

  const [ deployerAddress, someUser1, someUser2, factoryAccount, someUser3 ] = accounts;

  const approveValue = constants.MAX_UINT256;

  let deployedPolToken;
  let deployedCollateralToken;
  let deployedContractType;
  let deployedWhiteList;
  let deployedSuiteFactory;
  let deployedSuiteList;
  let deployedPredictionCollateralFactory;
  let deployedPredictionPoolFactory;
  let deployedEventLifeCycleFactory;
  let deployedPendingOrdersFactory;

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
      new BN("18"),             // uint8 decimals,
      deployerAddress,          // address beneficiary,
      ntob(polTokenSupply),     // uint256 supply
      { from: deployerAddress }
    );

    deployedContractType = await ContractType.new(
      { from: deployerAddress }
    );

    deployedWhiteList = await WhiteList.new(
      { from: deployerAddress }
    );

    deployedSuiteFactory = await SuiteFactory.new(
      deployedPolToken.address,
      ntob(commissionForCreateSuite), // 1$ commission
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

    deployedPredictionPoolFactory = await PredictionPoolFactory.new(
      { from: deployerAddress }
    );

    deployedEventLifeCycleFactory = await EventLifeCycleFactory.new(
      { from: deployerAddress }
    );

    deployedPendingOrdersFactory = await PendingOrdersFactory.new(
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

  describe("Suite", () => {
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

  describe("PredictionCollateral, PredictionPool and EventLifeCycle Factories", () => {
    it('should create PredictionCollateral, PredictionPool and EventLifeCycle contracts and add its to user`s suite', async () => {
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

      await expectRevert(
        deployedPendingOrdersFactory.createContract(
          _suites0,                                       // address suiteAddress,
          { from: someUser1 }
        ), "You must create Prediction Pool before PendingOrders contract"
      );

      await expectRevert(
        deployedEventLifeCycleFactory.createContract(
          _suites0,                                       // address suiteAddress,
          someUser1,                                      // address oracleAddress
          { from: someUser1 }
        ), "You must create Prediction Pool before EventLifeCycle contract"
      );

      await expectRevert(
        deployedPredictionPoolFactory.createContract(
          _suites0,                                       // address suiteAddress,
          new BN("500000000000000000"),                   // uint256 whitePrice
          new BN("500000000000000000"),                   // uint256 blackPrice
          { from: someUser1 }
        ), "You must create Prediction Collateralization before PredictionPool contract"
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

      await expectRevert(
        deployedPredictionCollateralFactory.createContract(
          _suites0,                           // address suiteAddress,
          "testWhiteName",                    // string memory whiteName,
          "testWhiteSymbol",                  // string memory whiteSymbol,
          "testBlackName",                    // string memory blackName,
          "testBlackSymbol",                  // string memory blackSymbol
          { from: someUser1 }
        ), "Contract already exist"
      );
    });

    it('should create PredictionCollateral, PredictionPool and EventLifeCycle contracts and add its to user`s suite', async () => {
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
      if (debug) console.log("factoryContractType :", factoryCollateralContractType);
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
      await expectRevert(
        deployedPredictionPoolFactory.createContract(
          _suites0,                                     // address suiteAddress,
          new BN("500000000000000000"),                 // uint256 whitePrice
          new BN("500000000000000000")                  // uint256 blackPrice
        ), "Caller should be suite owner"
      );

      await expectRevert(
        deployedPredictionPoolFactory.createContract(
          _suites0,                                     // address suiteAddress,
          new BN("500000000000000000"),                 // uint256 whitePrice
          new BN("500000000000000000"),                 // uint256 blackPrice
          { from: someUser1 }
        ), "Caller should be in White List"
      );

      await addToWhiteList(
        1, // "PREDICTION_POOL",
        deployedPredictionPoolFactory.address
      );

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

      if (debug) console.log("contractPoolAddress :", poolContractAddress);

      const factoryPoolContractType = await deployedPredictionPoolFactory.FACTORY_CONTRACT_TYPE();
      if (debug) console.log("factoryPContractType:", factoryPoolContractType);

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
          suiteOwner, suiteOwner, suiteOwner
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
      if (debug) console.log("factoryEContractType:", factoryELCContractType);

      expect(await deployedSuite.contracts(factoryELCContractType)).to.be.equals(elcContractAddress);


      const deployedEventLifeCycle = await EventLifeCycle.at(
        elcContractAddress
      );

      expect(
        await deployedEventLifeCycle._governanceAddress()
      ).to.be.equals(await deployedSuiteFactory.owner());

      await expectRevert(
        deployedPredictionPoolFactory.initPredictionPool(
          _suites0,                           // address suiteAddress
        ), "Caller should be suite owner"
      );

      if (debug) console.log("deployerAddress     :", deployerAddress);
      if (debug) console.log("suiteOwner          :", suiteOwner);
      if (debug) console.log("ppf address         :", deployedPredictionPoolFactory.address);
      if (debug) console.log("elc address         :", (await deployedPredictionPool._eventContractAddress()));
      if (debug) console.log("elc gov             :", (await deployedEventLifeCycle._governanceAddress()));
      if (debug) console.log("pp gov              :", (await deployedPredictionPool._governanceAddress()));

      await deployedPredictionPoolFactory.initPredictionPool(
        _suites0,                             // address suiteAddress
        { from: suiteOwner }
      )

      if (debug) console.log("deployerAddress     :", deployerAddress);
      if (debug) console.log("suiteOwner          :", suiteOwner);
      if (debug) console.log("ppf address         :", deployedPredictionPoolFactory.address);
      if (debug) console.log("elc gov             :", (await deployedEventLifeCycle._governanceAddress()));
      if (debug) console.log("elc address         :", (await deployedPredictionPool._eventContractAddress()));
      if (debug) console.log("pp gov              :", (await deployedPredictionPool._governanceAddress()));

      expect(await deployedPredictionPool.inited()).to.be.equals(true);

      assert.equal(deployedEventLifeCycle.address, await deployedPredictionPool._eventContractAddress());
      assert.equal(await deployedSuiteFactory.owner(), await deployedPredictionCollateralization._governanceAddress());
      assert.equal(await deployedSuiteFactory.owner(), await deployedEventLifeCycle._governanceAddress());
      assert.equal(await deployedSuiteFactory.owner(), await deployedPredictionPool._governanceAddress());

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
      if (debug) console.log("factoryPContractType:", factoryPOContractType);

      expect(await deployedSuite.contracts(factoryPOContractType)).to.be.equals(poContractAddress);


      const deployedPendingOrders = await PendingOrders.at(
        poContractAddress
      );


      if (debug) console.log("pof address         :", deployedPendingOrdersFactory.address);
      if (debug) console.log("po gov              :", (await deployedPendingOrders.owner()));
      if (debug) console.log("po elc address      :", (await deployedPendingOrders._eventContractAddress()));

      assert.equal(deployedEventLifeCycle.address, await deployedPredictionPool._eventContractAddress());
      assert.equal(await deployedSuiteFactory.owner(), await deployedPendingOrders.owner());

      expect(
        await deployedPendingOrders._ordersCount()
      ).to.be.bignumber.equal(new BN("0"));

      assert.equal(await deployedPendingOrders._collateralToken(), deployedCollateralToken.address);
      assert.equal(await deployedPendingOrders._predictionPool(), deployedPredictionPool.address);
      assert.equal(await deployedPendingOrders._eventContractAddress(), deployedEventLifeCycle.address);

      //  ---------------------------buyBlack-----------------------------------
      const addForWhiteAmount = new BN("5000000000000000000");
      const addForBlackAmount = new BN("3000000000000000000");

      const buyPayment = new BN("5000000000000000000");
      const initialBlackOrWhitePrice = new BN("500000000000000000");

      let collateralTokenAllowance = await deployedCollateralToken.allowance(
        someUser3,                                    // address owner,
        deployedPredictionCollateralization.address   // address spender
      )
      if (debug) console.log("collTokenAllowance  :", collateralTokenAllowance.toString());

      await deployedCollateralToken.approve(
        deployedPredictionCollateralization.address,  // address spender,
        buyPayment,                                   // uint256 value
        { from: someUser3 }
      )

      expect(await deployedCollateralToken.allowance(
        someUser3,                                    // address owner,
        deployedPredictionCollateralization.address   // address spender
      )).to.be.bignumber.equal(collateralTokenAllowance.add(buyPayment));

      await expectRevert(
        deployedPredictionPool.buyBlack(
          initialBlackOrWhitePrice,
          buyPayment,
          { from: someUser3 }
        ), "SafeMath: subtraction overflow"
      ); // No balance on user account

      await deployedCollateralToken.transfer(someUser3, buyPayment);

      let collateralTokenUserBalance = await deployedCollateralToken.balanceOf(someUser3);

      expect(collateralTokenUserBalance).to.be.bignumber.at.least(buyPayment);

      const buyBlack = await deployedPredictionPool.buyBlack(
        initialBlackOrWhitePrice,
        buyPayment,
        { from: someUser3 }
      );
      const { logs: buyBlackLog } = buyBlack;

      assert.equal(buyBlackLog.length, eventCount, `triggers must be ${eventCount} event`);

      const blackBought = new BN("9970000000000000000");

      expectEvent.inLogs(buyBlackLog, 'BuyBlack', {
        user: someUser3,
        amount: blackBought,
        price: initialBlackOrWhitePrice
      });

      expect(
        await deployedBlackToken.balanceOf(someUser3)
      ).to.be.bignumber.equal(blackBought);

      //  --------------------------buyWhite-----------------------------------\

      collateralTokenUserBalance = await deployedCollateralToken.balanceOf(someUser3);

      expect(collateralTokenUserBalance).to.be.bignumber.at.equal(new BN("0"));

      collateralTokenAllowance = await deployedCollateralToken.allowance(
        someUser3,                                    // address owner,
        deployedPredictionCollateralization.address   // address spender
      )
      if (debug) console.log("collTokenAllowance  :", collateralTokenAllowance.toString());

      await expectRevert(
        deployedPredictionPool.buyWhite(
          initialBlackOrWhitePrice,
          buyPayment,
          { from: someUser3 }
        ), "Not enough delegated tokens"
      );

      await deployedCollateralToken.approve(
        deployedPredictionCollateralization.address,  // address spender,
        buyPayment,                                   // uint256 value
        { from: someUser3 }
      )

      expect(await deployedCollateralToken.allowance(
        someUser3,                                    // address owner,
        deployedPredictionCollateralization.address   // address spender
      )).to.be.bignumber.equal(collateralTokenAllowance.add(buyPayment));

      await expectRevert(
        deployedPredictionPool.buyWhite(
          initialBlackOrWhitePrice,
          buyPayment,
          { from: someUser3 }
        ), "SafeMath: subtraction overflow"
      ); // No balance on user account

      await deployedCollateralToken.transfer(someUser3, buyPayment);

      collateralTokenUserBalance = await deployedCollateralToken.balanceOf(someUser3);

      expect(collateralTokenUserBalance).to.be.bignumber.at.least(buyPayment);

      const buyWhite = await deployedPredictionPool.buyWhite(
        initialBlackOrWhitePrice,
        buyPayment,
        { from: someUser3 }
      );
      const { logs: buyWhiteLog } = buyWhite;


      assert.equal(buyWhiteLog.length, eventCount, `triggers must be ${eventCount} event`);

      const whiteBought = new BN("9970000000000000000");

      expectEvent.inLogs(buyWhiteLog, 'BuyWhite', {
        user: someUser3,
        amount: whiteBought,
        price: initialBlackOrWhitePrice
      });

      expect(
        await deployedWhiteToken.balanceOf(someUser3)
      ).to.be.bignumber.equal(whiteBought);
    });
  });

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

    it('should delete suite from SuiteList, by Suite owner and SuiteList owner', async () => {
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

      await expectRevert(
        deployedSuiteList.deleteSuite(
          deployedSuiteAddress,
          { from: accounts[9] }
        ), "only Gov or suite owner can call"
      );

      const deleteSuiteByGov = await deployedSuiteList.deleteSuite(
        deployedSuiteAddress,
        { from: accounts[0] }
      );

      const isSuiteExistsAfterDelete = await deployedSuiteList.isSuiteExists(deployedSuiteAddress);

      const deployedSuiteAddress2 = await deploySuite(
        someUser1,
        "SomeNameSuite",
        deployedCollateralToken.address
      );
      const isSuiteExists2 = await deployedSuiteList.isSuiteExists(deployedSuiteAddress2);
      if (debug) console.log("isSuiteExists2      :", isSuiteExists2);

      expect(isSuiteExists2).to.be.equals(true);
      const deleteSuiteByOwner = await deployedSuiteList.deleteSuite(
        deployedSuiteAddress2,
        { from: someUser1 }
      );
      const isSuiteExistsAfterDeleteSuiteByOwner = await deployedSuiteList.isSuiteExists(deployedSuiteAddress2);
      if (debug) console.log("isSuiteExists2      :", isSuiteExistsAfterDeleteSuiteByOwner);

      expect(isSuiteExistsAfterDeleteSuiteByOwner).to.be.equals(false);

    });

    it('should assert balance of deployer`s Pol tokens equal total supply', async () => {
      const balance = await deployedPolToken.balanceOf(deployerAddress);
      if (debug) console.log("balance             :", balance.toString(10));
      expect(balance).to.be.bignumber.equal(ntob(polTokenSupply));
    });

    it.skip('should assert ContractType count equal 0 on start', async () => {
      const _countBefore = await deployedContractType._count.call();
      expect(_countBefore).to.be.bignumber.equal(new BN("0"));

      await [
        "PredictionCollateralization",
        "PredictionPool"
      ].forEach(async (contract) => {
        const insertContract = await deployedContractType.insertContract(
          accounts[9],
          web3.utils.asciiToHex(contract),
          true,
          { from: accounts[9] }
        );
      });

      const _countAfter = await deployedContractType._count.call();
      expect(_countAfter).to.be.bignumber.equal(new BN("1"));
    });
  });

  describe.skip("ContractType", () => {
    it('should assert ContractType count equal 0 on start', async () => {
      const _count = await deployedContractType._count.call();
      expect(_count).to.be.bignumber.equal(new BN("0"));
    });

    it('should assert ContractType count equal 0 on start', async () => {
      const _countBefore = await deployedContractType._count.call();
      expect(_countBefore).to.be.bignumber.equal(new BN("0"));

      await [
        "PredictionCollateralization",
        "PredictionPool"
      ].forEach(async (contract) => {
        const insertContract = await deployedContractType.insertContract(
          accounts[9],
          web3.utils.asciiToHex(contract),
          true,
          { from: accounts[9] }
        );
      });

      const _countAfter = await deployedContractType._count.call();
      expect(_countAfter).to.be.bignumber.equal(new BN("1"));
    });
  });
});

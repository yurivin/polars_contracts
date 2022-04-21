const {
  BN,           // Big Number support
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
const PredictionCollateralization = artifacts.require('PredictionCollateralization');
const PredictionPool = artifacts.require('PredictionPool');
const EventLifeCycle = artifacts.require('EventLifeCycle');

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

    snapshotA = await snapshot();
  });

  afterEach(async () => {
    await snapshotA.restore()
  });

  describe("WhiteList", () => {
    it('should assert WhiteList add and remove allowance of factory', async () => {
      const keccakPCtype = web3.utils.keccak256("PREDICTION_COLLATERAL");

      let _allowedFactories = await deployedWhiteList._allowedFactories.call(
        keccakPCtype
      );
      expect(_allowedFactories).to.be.equals(
        "0x0000000000000000000000000000000000000000"
      );

      await deployedWhiteList.add(
        keccakPCtype,
        factoryAccount
      );
      _allowedFactories = await deployedWhiteList._allowedFactories.call(
        keccakPCtype
      );
      expect(_allowedFactories).to.be.equals(factoryAccount);

      await deployedWhiteList.remove(
        keccakPCtype
      );
      _allowedFactories = await deployedWhiteList._allowedFactories.call(
        keccakPCtype
      );
      expect(_allowedFactories).to.be.equals(
        "0x0000000000000000000000000000000000000000"
      );

      await expectRevert(
        deployedWhiteList.add(
          keccakPCtype,
          factoryAccount,
          { from: someUser1 }
        ), "Revert or exceptional halt"
      );

      _allowedFactories = await deployedWhiteList._allowedFactories.call(
        keccakPCtype
      );
      expect(_allowedFactories).to.be.equals(
        "0x0000000000000000000000000000000000000000"
      );

      await expectRevert(
        deployedWhiteList.remove(
          keccakPCtype,
          { from: someUser1 }
        ), "Revert or exceptional halt"
      );
    });

    it.skip('should assert WhiteList add and remove allowance of factory', async () => {
      let _allowedFactories = await deployedWhiteList._allowedFactories.call(0, factoryAccount);
      expect(_allowedFactories).to.be.equals(false);

      await deployedWhiteList.add(0, factoryAccount);
      _allowedFactories = await deployedWhiteList._allowedFactories.call(0, factoryAccount);
      expect(_allowedFactories).to.be.equals(true);

      await deployedWhiteList.remove(0, factoryAccount);
      _allowedFactories = await deployedWhiteList._allowedFactories.call(0, factoryAccount);
      expect(_allowedFactories).to.be.equals(false);

      await expectRevert(
        deployedWhiteList.add(
          0,
          factoryAccount,
          { from: someUser1 }
        ), "Revert or exceptional halt"
      );

      _allowedFactories = await deployedWhiteList._allowedFactories.call(0, factoryAccount);
      expect(_allowedFactories).to.be.equals(false);

      await expectRevert(
        deployedWhiteList.remove(
          0,
          factoryAccount,
          { from: someUser1 }
        ), "Revert or exceptional halt"
      );
    });
  });

  const deploySuite = async (user, suiteName) => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    await deployedPolToken.transfer(
      user,                               // address recipient
      ntob(commissionForCreateSuite),     // uint256 amount
      { from: deployerAddress }
    )
    await sleep(1000);
    await deployedPolToken.approve(
      deployedSuiteFactory.address,       // address spender
      ntob(commissionForCreateSuite*20),  // uint256 amount
      { from: user }
    )
    await sleep(1000);
    const deployedSuiteTx = await deployedSuiteFactory.deploySuite(
      suiteName,
      { from: user }
    );
    const deployedSuiteAddress = deployedSuiteTx.logs[2].args.suiteAddress;
    if (debug) console.log("deployedSuiteAddress:", deployedSuiteAddress);

    const deployedSuite = await Suite.at(deployedSuiteAddress);
    const suiteOwner = await deployedSuite.owner();

    if (debug) console.log("suiteOwner          :", suiteOwner);
    if (debug) console.log("user                :", user);

    expect(suiteOwner).to.be.equals(user);

    const getSuitesCount = await deployedSuiteList.getSuitesCount();
    if (debug) console.log("getSuitesCount      :", getSuitesCount.toString());


    return deployedSuiteAddress;
  }

  const addToWhiteList = async (type, factoryAddress) => {
    const keccakPCtype = web3.utils.keccak256(type);

    await deployedWhiteList.add(
      keccakPCtype,
      factoryAddress
    );

    const _allowedFactories = await deployedWhiteList._allowedFactories.call(
      keccakPCtype
    );
    expect(_allowedFactories).to.be.equals(factoryAddress);
  }

  const setWhiteList = async () => {
    expect(await deployedSuiteList._whiteList()).to.be.equals("0x0000000000000000000000000000000000000000");
    await deployedSuiteList.setWhiteList(deployedWhiteList.address);
    expect(await deployedSuiteList._whiteList()).to.be.equals(deployedWhiteList.address);
  }

  describe("Suite", () => {
    it.skip('should create 50 suites for 7 users and print it', async () => {
      // let deployedSuiteTx = await deployedSuiteFactory.deploySuite(
      //   { from: someUser1 }
      // );
      // let deployedSuiteAddress = deployedSuiteTx.logs[2].args.suiteAddress;
      // // console.log("deployedSuiteAddress:", deployedSuiteAddress);
      // console.log("deployedSuiteAddress:", deployedSuiteAddress);

      // let deployedSuite = await Suite.at(deployedSuiteAddress);
      // let suiteOwner = await deployedSuite.owner();
      // console.log("suiteOwner          :", suiteOwner);
      // console.log("someUser1           :", someUser1);

      // const deployedSuiteAddress = await deploySuite(someUser1);
      // let deployedSuite = await Suite.at(deployedSuiteAddress);

      // console.log("deployedSuiteList   :", deployedSuiteList.address);

      // // const addSuiteTx = await deployedSuiteList.addSuite(deployedSuiteAddress, suiteOwner);
      // // console.log("addSuiteTx          :", addSuiteTx);

      // const getSuitesByPage = await deployedSuiteList.getSuitesByPage(new BN("0"), new BN("10"));
      // console.log("getSuitesByPage     :", getSuitesByPage);

      // let deployedSuiteTx2 = await deployedSuiteFactory.deploySuite(
      //   { from: someUser2 }
      // );
      // let deployedSuiteAddress2 = deployedSuiteTx2.logs[2].args.suiteAddress;
      // console.log("deployedSuiteAddress:", deployedSuiteAddress2);
      // let deployedSuite2 = await Suite.at(deployedSuiteAddress2);
      // let suiteOwner2 = await deployedSuite2.owner();
      // console.log("suiteOwner          :", suiteOwner2);
      // console.log("someUser2           :", someUser2);

      // const deployedSuiteAddress2 = await deploySuite(someUser2);
      // let deployedSuite2 = await Suite.at(deployedSuiteAddress2);

      // const getSuitesByPage2 = await deployedSuiteList.getSuitesByPage(new BN("0"), new BN("10"));
      // console.log("getSuitesByPage2    :", getSuitesByPage2);

      // [...Array(50).keys()].forEach(async (element) => await deploySuite(someUser2));

      const countSuitesForTest = 2;
      // const countSuitesForTest = 10;
      // const countSuitesForTest = 50;
      console.log("acountSuitesForTest :", countSuitesForTest);
      console.log("accounts.length     :", accounts.length);

      const maxAccountInUse = 6;
      const startAccountInUse = (maxAccountInUse / 2);// - 1;
      const endAccountInUse = accounts.length - (maxAccountInUse / 2);// + 1;
      let y = startAccountInUse;
      console.log("startAccountInUse   :", startAccountInUse);
      console.log("endAccountInUse     :", endAccountInUse);
      // let y = accounts.length - (maxAccountInUse/2)
      // await Promise.all(
      //   [...Array(50).keys()].forEach(async (element) => {
      //     y++;
      //     if (y > 9) y=1;
      //     else if (y < 1) y=accounts.length;
      //     await deploySuite(accounts[y])
      //   })
      // )

      const sleep = async (ms) => new Promise(r => setTimeout(r, ms));
      await Promise.all(
        // [...Array(50).keys()].forEach(async (element) => await deploySuite(someUser2))
        [...Array(countSuitesForTest).keys()].map(async (element) => {

          console.log("y                   :", y);
          // await deploySuite(accounts[1]);
          console.log("x                   :", y);
          await sleep(1000);
          console.log("x                   :", y);
          await deploySuite(accounts[y]);
          await time.advanceBlock();
          // const getSuitesCount = await deployedSuiteList.getSuitesCount();
          // if (debug) console.log("getSuitesCount      :", getSuitesCount.toString());
          y++;
          if (y >= endAccountInUse) y=startAccountInUse;
          else if (y <= startAccountInUse) y=endAccountInUse;
        })
      )
      // await Promise.all(
      //   // [...Array(50).keys()].forEach(async (element) => await deploySuite(someUser2))
      //   [...Array(50).keys()].map(async (element) => {
      //     await deploySuite(someUser2);
      //     const getSuitesSize = await deployedSuiteList.getSuitesSize();
      //     console.log("getSuitesSize       :", getSuitesSize.toString());
      //   })
      // )
      const iterations = Math.floor(countSuitesForTest / maxPageSize);
      console.log("iterations          :", iterations);
      await Promise.all(
        [...Array(iterations).keys()].map(async (iteration) => {
          const getSuitesByPage = await deployedSuiteList.getSuitesByPage(new BN(iteration.toString(10)), new BN(maxPageSize.toString(10)));
          console.log("getSuitesByPage     :", getSuitesByPage);
        })
      )

      const remain = countSuitesForTest % maxPageSize;
      if (remain > 0) {
        const getSuitesByPage = await deployedSuiteList.getSuitesByPage(new BN((countSuitesForTest-remain).toString(10)), new BN(remain.toString(10)));
        console.log("getSuitesByPage     :", getSuitesByPage);
      }
      console.log("iterationD          :", countSuitesForTest % maxPageSize);
      // const getSuitesByPage = await deployedSuiteList.getSuitesByPage(new BN("0"), new BN("10"));
      // console.log("getSuitesByPage     :", getSuitesByPage);

      // const getUserSuitesCount = await deployedSuiteList.getUserSuitesCount(accounts[5]);
      // console.log("getUserSuitesCount  :", getUserSuitesCount.toNumber());
      // console.log("getUserSuitesCount  :", getUserSuitesCount.toString());

      // const _suiteIndexesByUserMap = await deployedSuiteList._suiteIndexesByUserMap(accounts[5], 0);
      // console.log("_suiteIndexes       :", _suiteIndexesByUserMap.toString());

      // await Promise.all(
      //   [...Array(getUserSuitesCount.toNumber()).keys()].map(async (index) => {
      //     const _suiteIndexesByUserMap = await deployedSuiteList._suiteIndexesByUserMap(accounts[5], index);
      //     const _suite = await deployedSuiteList._suites(_suiteIndexesByUserMap);
      //     console.log("_suiteIndexes       :", _suiteIndexesByUserMap.toString(), _suite);
      //   })
      // )
      let i = startAccountInUse;
      for (i=startAccountInUse; i<=endAccountInUse; i++) {
        console.log("i                   :", i);
        const getUserSuitesCount = await deployedSuiteList.getUserSuitesCount(accounts[i]);
        const userIterations = Math.floor(getUserSuitesCount / maxPageSize);
        // console.log("userIterations      :", userIterations);
        await Promise.all(
          [...Array(userIterations).keys()].map(async (iteration) => {
            const getUserSuitesByPage = await deployedSuiteList.getUserSuitesByPage(accounts[i], new BN(iteration.toString(10)), new BN(maxPageSize.toString(10)));
            console.log("getUserSuitesByPage :", getUserSuitesByPage);
          })
        )
        const userRemain = getUserSuitesCount % maxPageSize;
        if (userRemain > 0) {
          // console.log("userRemain          :", userRemain);
          // console.log("userRemain          :", getUserSuitesCount.toNumber());
          // console.log("userRemain          :", new BN((getUserSuitesCount.toNumber()-userRemain).toString(10)).toString());
          const getUserSuitesByPage = await deployedSuiteList.getUserSuitesByPage(accounts[i], new BN((getUserSuitesCount-userRemain).toString(10)), new BN(userRemain.toString(10)));
          console.log("getUserSuitesByPage   :", getUserSuitesByPage);
        }
      }

    });

    it('should revert create suite if WhiteList address not defined', async () => {


      await expectRevert(
        deployedSuiteFactory.deploySuite(
          // "SomeNameSuite",
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
          // "SomeNameSuite",
          { from: accounts[9] }
        ), "Parameter suiteName is null"
      );
    })

    it('should revert create suite if don`t have enough commission tokens', async () => {
      // const keccakPCtype = web3.utils.keccak256("PREDICTION_COLLATERAL");

      // await deployedWhiteList.add(
      //   keccakPCtype,
      //   factoryAccount
      // );

      // const _allowedFactories = await deployedWhiteList._allowedFactories.call(
      //   keccakPCtype
      // );
      // expect(_allowedFactories).to.be.equals(factoryAccount);

      // expect(await deployedSuiteList._whiteList()).to.be.equals("0x0000000000000000000000000000000000000000");
      // await deployedSuiteList.setWhiteList(deployedWhiteList.address);
      // expect(await deployedSuiteList._whiteList()).to.be.equals(deployedWhiteList.address);
      await setWhiteList(
        "PREDICTION_COLLATERAL",
        deployedPredictionCollateralFactory.address
      );

      await expectRevert(
        deployedSuiteFactory.deploySuite(
          "SomeNameSuite",
          { from: accounts[9] }
        ), "You don't have enough commission tokens for the action"
      );
    })

    it('should revert create suite if not enough delegated commission tokens', async () => {
      await deployedPolToken.transfer(
        accounts[9], // address recipient
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
          { from: accounts[9] }
        ), "Not enough delegated commission tokens for the action"
      );
    })
  });

  describe("PredictionCollateral, PredictionPool and EventLifeCycle Factories", () => {
    it('should create PredictionCollateral, PredictionPool and EventLifeCycle contracts and add its to user`s suite', async () => {
      await setWhiteList();

      await addToWhiteList(
        "PREDICTION_COLLATERAL",
        deployedPredictionCollateralFactory.address
      );

      const isSuiteExists = await deployedSuiteList.isSuiteExists(accounts[6]);
      if (debug) console.log("isSuiteExists       :", isSuiteExists);
      expect(isSuiteExists).to.be.equals(false);

      const deployedSuiteAddress = await deploySuite(someUser1, "SomeNameSuite");

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
          deployedCollateralToken.address,  // address collateralTokenAddress,
          "testWhiteName",                  // string memory whiteName,
          "testWhiteSymbol",                // string memory whiteSymbol,
          "testBlackName",                  // string memory blackName,
          "testBlackSymbol"                 // string memory blackSymbol
        ), "Caller should be suite owner"
      );

      const createCollateralContractTx = await deployedPredictionCollateralFactory.createContract(
        _suites0,                           // address suiteAddress,
        deployedCollateralToken.address,    // address collateralTokenAddress,
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
      // if (debug)
      if (debug) console.log("contractCollAddress:", collateralContractAddress);

      const factoryCollateralContractType = await deployedPredictionCollateralFactory.FACTORY_CONTRACT_TYPE();
      if (debug) console.log("factoryContractType :", factoryCollateralContractType);
      const deployedSuite = await Suite.at(_suites0);
      expect(await deployedSuite.contracts(factoryCollateralContractType)).to.be.equals(collateralContractAddress);


      const deployedPredictionCollateralization = await PredictionCollateralization.at(
        collateralContractAddress
      );

      if (debug) console.log("_poolAddress        :", (await deployedPredictionCollateralization._poolAddress()));
      assert.equal(deployedPredictionCollateralFactory.address, await deployedPredictionCollateralization._poolAddress());

      assert.equal(someUser1, await deployedPredictionCollateralization._governanceAddress());

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
          deployedCollateralToken.address,              // address collateralTokenAddress,
          new BN("500000000000000000"),                 // uint256 whitePrice
          new BN("500000000000000000")                  // uint256 blackPrice
        ), "Caller should be suite owner"
      );

      await expectRevert(
        deployedPredictionPoolFactory.createContract(
          _suites0,                                     // address suiteAddress,
          deployedCollateralToken.address,              // address collateralTokenAddress,
          new BN("500000000000000000"),                 // uint256 whitePrice
          new BN("500000000000000000"),                 // uint256 blackPrice
          { from: someUser1 }
        ), "Caller should be in White List"
      );

      await addToWhiteList(
        "PREDICTION_POOL",
        deployedPredictionPoolFactory.address
      );

      const createPoolContractTx = await deployedPredictionPoolFactory.createContract(
        _suites0,                                       // address suiteAddress,
        deployedCollateralToken.address,                // address collateralTokenAddress,
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

      expect(await deployedPredictionPool._thisCollateralization()).to.be.equals(deployedPredictionCollateralization.address);
      expect(await deployedPredictionPool._whiteToken()).to.be.equals(deployedWhiteToken.address);
      expect(await deployedPredictionPool._blackToken()).to.be.equals(deployedBlackToken.address);

      await deployedPredictionCollateralization.changePoolAddress(
        deployedPredictionPool.address,
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
        "EVENT_LIFE_CYCLE",
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

      await expectRevert(
        deployedPredictionPoolFactory.initPredictionPool(
          _suites0,                           // address suiteAddress
          suiteOwner,                         // address governanceWalletAddress
          suiteOwner                          // address controllerWalletAddress
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
        suiteOwner,                           // address governanceWalletAddress
        suiteOwner,                           // address controllerWalletAddress
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
      assert.equal(someUser1, await deployedPredictionCollateralization._governanceAddress());
      assert.equal(someUser1, await deployedEventLifeCycle._governanceAddress());
      assert.equal(someUser1, await deployedPredictionPool._governanceAddress());

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
    it('should assert isSuiteExists equal false on start and true after create suite', async () => {
      const isSuiteExists = await deployedSuiteList.isSuiteExists(accounts[6]); // some address
      if (debug) console.log("isSuiteExists       :", isSuiteExists);
      expect(isSuiteExists).to.be.equals(false);

      await setWhiteList(
        "PREDICTION_COLLATERAL",
        deployedPredictionCollateralFactory.address
      );

      const deployedSuiteAddress = await deploySuite(someUser1, "SomeNameSuite");

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

      const deployedSuiteAddress = await deploySuite(someUser1, "SomeNameSuite");

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

      const deployedSuiteAddress2 = await deploySuite(someUser1, "SomeNameSuite");
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

      // const insertContract = await deployedContractType.insertContract(
      //   accounts[9],
      //   web3.utils.asciiToHex("val"),
      //   true,
      //   { from: accounts[9] }
      // );

      // const { logs: insertContractLog } = insertContract;
      // const eventCount = 0;
      // assert.equal(insertContractLog.length, eventCount, `triggers must be ${eventCount} event`);

      // expectEvent.inLogs(insertContractLog, 'OrderCreated', {
      //   id: new BN("1")
      // });
      // insertContract(
      //   address factoryAddress,
      //   bytes32 nameType,
      //   bool enabled
      // )
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

      // const insertContract = await deployedContractType.insertContract(
      //   accounts[9],
      //   web3.utils.asciiToHex("val"),
      //   true,
      //   { from: accounts[9] }
      // );

      // const { logs: insertContractLog } = insertContract;
      // const eventCount = 0;
      // assert.equal(insertContractLog.length, eventCount, `triggers must be ${eventCount} event`);

      // expectEvent.inLogs(insertContractLog, 'OrderCreated', {
      //   id: new BN("1")
      // });
      // insertContract(
      //   address factoryAddress,
      //   bytes32 nameType,
      //   bool enabled
      // )
      const _countAfter = await deployedContractType._count.call();
      expect(_countAfter).to.be.bignumber.equal(new BN("1"));
    });
  });

  // it("should assert approveValue equal deployer's CollateralToken allowance count for PredictionCollateralization", async function () {
  //   return expect(
  //     await deployedCollateralToken.allowance(deployerAddress, deployedPredictionCollateralization.address)
  //   ).to.be.bignumber.equal(approveValue);
  // });

  // it("should assert approveValue equal deployer's CollateralToken allowance count for PredictionPool", async function () {
  //   return expect(
  //     await deployedCollateralToken.allowance(deployerAddress, deployedPredictionPool.address)
  //   ).to.be.bignumber.equal(approveValue);
  // });

  // it("should assert approveValue equal deployer's whiteToken allowance count for PredictionCollateralization", async function () {
  //   return expect(
  //     await deployedWhiteToken.allowance(deployerAddress, deployedPredictionCollateralization.address)
  //   ).to.be.bignumber.equal(approveValue);
  // });

  // it("should assert approveValue equal deployer's blackToken allowance count for PredictionCollateralization", async function () {
  //   return expect(
  //     await deployedBlackToken.allowance(deployerAddress, deployedPredictionCollateralization.address)
  //   ).to.be.bignumber.equal(approveValue);
  // });

  // it("should assert approveValue equal deployer's CollateralToken allowance count for PendingOrders", async function () {
  //   return expect(
  //     await deployedCollateralToken.allowance(deployerAddress, deployedPendingOrders.address)
  //   ).to.be.bignumber.equal(approveValue);
  // });
});

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

const debug = 0;
// const debug = 1;
const maxPageSize = 30;
const polTokenSupply = 1000000000;
const commissionForCreateSuite = 1; // 1$

// const polTokenSupply = 1000000000*1e18;

contract.only("DEV: Factories", (accounts) => {
  "use strict";

  const [ deployerAddress, someUser1, someUser2, factoryAccount ] = accounts;

  const approveValue = constants.MAX_UINT256;

  let deployedPolToken;
  let deployedCollateralToken;
  let deployedContractType;
  let deployedWhiteList;
  let deployedSuiteFactory;
  let deployedSuiteList;
  let deployedPredictionCollateralFactory;

  let snapshotA;

  before(async () => {

  });

  beforeEach(async () => {

    deployedPolToken = await TokenTemplate.new(
      "Polars", // string memory name,
      "POL", // string memory symbol,
      new BN("18"), // uint8 decimals,
      deployerAddress, // address beneficiary,
      ntob(polTokenSupply), // uint256 supply
      { from: deployerAddress }
    );

    deployedCollateralToken = await TokenTemplate.new(
      "Binance USD token", // string memory name,
      "BUSD", // string memory symbol,
      new BN("18"), // uint8 decimals,
      deployerAddress, // address beneficiary,
      ntob(polTokenSupply), // uint256 supply
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
  });

  const deploySuite = async (user, suiteName) => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    await deployedPolToken.transfer(
      user, // address recipient
      ntob(commissionForCreateSuite), // uint256 amount
      { from: deployerAddress }
    )
    await sleep(1000);
    await deployedPolToken.approve(
      deployedSuiteFactory.address, // address spender
      ntob(commissionForCreateSuite*20), // uint256 amount
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

  const setWhiteList = async (type, factoryAddress) => {
    const keccakPCtype = web3.utils.keccak256(type);

    await deployedWhiteList.add(
      keccakPCtype,
      factoryAddress
    );

    const _allowedFactories = await deployedWhiteList._allowedFactories.call(
      keccakPCtype
    );
    expect(_allowedFactories).to.be.equals(factoryAddress);

    expect(await deployedSuiteList._whiteList()).to.be.equals("0x0000000000000000000000000000000000000000");
    await deployedSuiteList.setWhiteList(deployedWhiteList.address);
    expect(await deployedSuiteList._whiteList()).to.be.equals(deployedWhiteList.address);
  }

  describe("Suite", () => {
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

  describe("PredictionCollateralFactory", () => {
    it('should create PredictionCollateral contract and add it to user`s suite', async () => {
      await setWhiteList(
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

      const createContractTx = await deployedPredictionCollateralFactory.createContract(
        _suites0,                         // address suiteAddress,
        deployedCollateralToken.address,  // address collateralTokenAddress,
        "testWhiteName",                  // string memory whiteName,
        "testWhiteSymbol",                // string memory whiteSymbol,
        "testBlackName",                  // string memory blackName,
        "testBlackSymbol",                // string memory blackSymbol
        { from: someUser1 }
      );
      // expect(1).to.be.equals(2);

      const { logs: createContractTxLog } = createContractTx;
      const eventCount = 1;
      assert.equal(createContractTxLog.length, eventCount, `triggers must be ${eventCount} event`);

      expectEvent.inLogs(createContractTxLog, 'ContractCreated', {
        suiteAddress: _suites0,
        // contractAddress:,
        contractType: "PREDICTION_COLLATERAL"
      });


      const contractAddress = createContractTx.logs[0].args.contractAddress;
      // if (debug)
      console.log("contractAddress     :", contractAddress);

      const factoryContractType = await deployedPredictionCollateralFactory.FACTORY_CONTRACT_TYPE();
      console.log("factoryContractType :", factoryContractType);
      const deployedSuite = await Suite.at(_suites0);
      expect(await deployedSuite.contracts(factoryContractType)).to.be.equals(contractAddress);
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

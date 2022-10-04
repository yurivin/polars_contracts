pragma solidity ^0.7.6;

// SPDX-License-Identifier: Apache License 2.0

import "./ISuite.sol";
import "./ISuiteFactory.sol";
import "./AbstractFactory.sol";
import "./IPredictionPoolProxy.sol";
import "../IPredictionPool.sol";
import "../iPredictionCollateralization.sol";

contract PredictionPoolFactory is AbstractFactory {
    /*
     *   "PREDICTION_POOL"
     *   id: 1
     */
    uint8 public constant FACTORY_CONTRACT_TYPE = 1;
    string public constant FACTORY_CONTRACT_NAME = "PREDICTION_POOL";
    address public _proxyAddress;

    uint256 public _governanceFee = 0.30 * 1e18;
    uint256 public _controllerFee = 0.35 * 1e18;
    uint256 public _bwAdditionFee = 0.35 * 1e18;

    modifier onlyGovernance() {
        address governance = IPredictionPoolProxy(_proxyAddress).owner();
        require(governance == msg.sender, "Caller should be governance");
        _;
    }

    constructor(address proxyAddress) {
        _proxyAddress = proxyAddress;
    }

    function changeProxyAddress(address proxyAddress) external onlyGovernance {
        _proxyAddress = proxyAddress;
    }

    function changeFeeProportion(
        uint256 governanceFee,
        uint256 controllerFee,
        uint256 bwAdditionFee
    ) external onlyGovernance {
        _governanceFee = governanceFee;
        _controllerFee = controllerFee;
        _bwAdditionFee = bwAdditionFee;
    }

    function createContract(
        address suiteAddress,
        uint256 whitePrice,
        uint256 blackPrice
    ) external noExist(suiteAddress, FACTORY_CONTRACT_TYPE)  {
        ISuite suite = ISuite(suiteAddress);
        require(suite.owner() == msg.sender, "Caller should be suite owner");

        address pp = IPredictionPoolProxy(_proxyAddress).createPredictionPool(
            suiteAddress,
            whitePrice,
            blackPrice
        );

        suite.addContract(FACTORY_CONTRACT_TYPE, pp);

        emit ContractCreated(suiteAddress, pp, FACTORY_CONTRACT_NAME);
    }

    function initPredictionPool(address suiteAddress, uint256 fee) external {
        ISuite suite = ISuite(suiteAddress);
        address suiteOwner = suite.owner();

        require(suiteOwner == msg.sender, "Caller should be suite owner");

        address predictionPoolAddress = suite.contracts(
            1 // id for PREDICTION_POOL
        );

        address eventLifeCycleAddress = suite.contracts(
            2 // id for EVENT_LIFE_CYCLE
        );

        require(
            predictionPoolAddress != address(0),
            "You must create PredictionPool contract"
        );

        require(
            eventLifeCycleAddress != address(0),
            "You must create EventLifeCycle contract"
        );

        IPredictionPool ipp = IPredictionPool(predictionPoolAddress);

        address globalOwner = address(suite._suiteFactoryAddress());

        ipp.init(
            /* solhint-disable prettier/prettier */
            globalOwner,            // governanceWalletAddress,
            eventLifeCycleAddress,
            suiteOwner,             // controllerWalletAddress
            suiteOwner,             // ordererAddress
            false                   // orderer enabled
            /* solhint-enable prettier/prettier */
        );

        // 0.1% min - 10% max (by Pool require)
        require(fee > 0.001 * 1e18, "Too low total fee");

        ipp.changeFees(fee, _governanceFee, _controllerFee, _bwAdditionFee);

        ipp.changeGovernanceAddress(globalOwner);
    }
}

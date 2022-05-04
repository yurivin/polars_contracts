pragma solidity ^0.7.6;

// SPDX-License-Identifier: Apache License 2.0

import "./ISuite.sol";
import "./ISuiteFactory.sol";
import "./AbstractFactory.sol";
import "../PredictionPool.sol";
import "../IPredictionPool.sol";
import "../iPredictionCollateralization.sol";

contract PredictionPoolFactory is AbstractFactory {
    /*
     *   keccak256("PREDICTION_POOL")
     *   0xe0adb0cc970f5fceb8dcd74884ef805feaaf050608733f0726801680146e1937
     */
    bytes32 public constant FACTORY_CONTRACT_TYPE =
        keccak256("PREDICTION_POOL");

    function createContract(
        address suiteAddress,
        uint256 whitePrice,
        uint256 blackPrice
    )
        public
        noExist(suiteAddress, FACTORY_CONTRACT_TYPE)
        returns (bool success)
    {
        ISuite _suite = ISuite(suiteAddress);
        require(_suite.owner() == msg.sender, "Caller should be suite owner");

        address predictionCollateralAddress = _suite.contracts(
            keccak256("PREDICTION_COLLATERAL")
        );

        require(
            predictionCollateralAddress != address(0),
            "You must create Prediction Collateralization before PredictionPool contract"
        );
        iPredictionCollateralization _ipc = iPredictionCollateralization(
            predictionCollateralAddress
        );

        PredictionPool _pp = new PredictionPool(
            /* solhint-disable prettier/prettier */
            predictionCollateralAddress,        // address thisCollateralizationAddress,
            _suite._collateralTokenAddress(),   // address collateralTokenAddress,
            _ipc.whiteToken(),                  // address whiteTokenAddress,
            _ipc.blackToken(),                  // address blackTokenAddress,
            whitePrice,                         // uint256 whitePrice,
            blackPrice                          // uint256 blackPrice
            /* solhint-enable prettier/prettier */
        );

        _suite.addContract(FACTORY_CONTRACT_TYPE, address(_pp));

        emit ContractCreated(suiteAddress, address(_pp), "PREDICTION_POOL");
        return true;
    }

    function initPredictionPool(address suiteAddress)
        public
        returns (bool success)
    {
        ISuite _suite = ISuite(suiteAddress);
        address suiteOwner = _suite.owner();

        require(suiteOwner == msg.sender, "Caller should be suite owner");

        address predictionPoolAddress = _suite.contracts(
            keccak256("PREDICTION_POOL")
        );

        address eventLifeCycleAddress = _suite.contracts(
            keccak256("EVENT_LIFE_CYCLE")
        );

        require(
            predictionPoolAddress != address(0),
            "You must create PredictionPool contract"
        );

        require(
            eventLifeCycleAddress != address(0),
            "You must create EventLifeCycle contract"
        );

        IPredictionPool _ipp = IPredictionPool(predictionPoolAddress);
        ISuiteFactory _isf = ISuiteFactory(_suite._suiteFactoryAddress());

        address globalOwner = _isf.owner();
        _ipp.init(
            globalOwner, // governanceWalletAddress,
            eventLifeCycleAddress,
            suiteOwner // controllerWalletAddress
        );

        _ipp.changeGovernanceAddress(globalOwner);
        return true;
    }
}

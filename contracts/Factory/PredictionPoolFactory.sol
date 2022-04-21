pragma solidity ^0.7.6;

// SPDX-License-Identifier: Apache License 2.0

import "./ISuite.sol";
import "./AbstractFactory.sol";
import "../PredictionPool.sol";
import "../IPredictionPool.sol";
import "../iPredictionCollateralization.sol";

contract PredictionPoolFactory is AbstractFactory {
    bytes32 public constant FACTORY_CONTRACT_TYPE =
        keccak256("PREDICTION_POOL");

    function createContract(
        address suiteAddress,
        address collateralTokenAddress,
        uint256 whitePrice,
        uint256 blackPrice
    ) public returns (bool success) {
        ISuite _suite = ISuite(suiteAddress);
        require(_suite.owner() == msg.sender, "Caller should be suite owner");

        address predictionCollateralAddress = _suite.contracts(
            keccak256("PREDICTION_COLLATERAL")
        );

        require(
            predictionCollateralAddress != address(0),
            "You must create Prediction Collateralization before PredictionPool contract"
        );
        iPredictionCollateralization _pc = iPredictionCollateralization(
            predictionCollateralAddress
        );

        PredictionPool _pp = new PredictionPool(
            /* solhint-disable prettier/prettier */
            predictionCollateralAddress,    // address thisCollateralizationAddress,
            collateralTokenAddress,         // address collateralTokenAddress,
            _pc.whiteToken(),               // address whiteTokenAddress,
            _pc.blackToken(),               // address blackTokenAddress,
            whitePrice,                     // uint256 whitePrice,
            blackPrice                      // uint256 blackPrice
            /* solhint-enable prettier/prettier */
        );

        _suite.addContract(FACTORY_CONTRACT_TYPE, address(_pp));

        emit ContractCreated(suiteAddress, address(_pp), "PREDICTION_POOL");
        return true;
    }

    function initPredictionPool(
        address suiteAddress,
        address governanceWalletAddress,
        address controllerWalletAddress
    ) public returns (bool success) {
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

        _ipp.init(
            governanceWalletAddress,
            eventLifeCycleAddress,
            controllerWalletAddress
        );
        _ipp.changeGovernanceAddress(suiteOwner);
        return true;
    }
}

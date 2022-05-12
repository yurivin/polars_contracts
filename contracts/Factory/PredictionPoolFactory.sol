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
     *   "PREDICTION_POOL"
     *   id: 1
     */
    uint8 public constant FACTORY_CONTRACT_TYPE = 1;
    string public constant FACTORY_CONTRACT_NAME = "PREDICTION_POOL";

    function createContract(
        address suiteAddress,
        uint256 whitePrice,
        uint256 blackPrice
    )
        public
        noExist(suiteAddress, FACTORY_CONTRACT_TYPE)
        returns (bool success)
    {
        ISuite suite = ISuite(suiteAddress);
        require(suite.owner() == msg.sender, "Caller should be suite owner");

        address predictionCollateralAddress = suite.contracts(
            0 // id for PREDICTION_COLLATERAL
        );

        require(
            predictionCollateralAddress != address(0),
            "You must create Prediction Collateralization before PredictionPool contract"
        );
        iPredictionCollateralization ipc = iPredictionCollateralization(
            predictionCollateralAddress
        );

        PredictionPool pp = new PredictionPool(
            /* solhint-disable prettier/prettier */
            predictionCollateralAddress,        // address thisCollateralizationAddress,
            suite._collateralTokenAddress(),    // address collateralTokenAddress,
            ipc.whiteToken(),                   // address whiteTokenAddress,
            ipc.blackToken(),                   // address blackTokenAddress,
            whitePrice,                         // uint256 whitePrice,
            blackPrice                          // uint256 blackPrice
            /* solhint-enable prettier/prettier */
        );

        suite.addContract(FACTORY_CONTRACT_TYPE, address(pp));

        emit ContractCreated(suiteAddress, address(pp), FACTORY_CONTRACT_NAME);
        return true;
    }

    function initPredictionPool(address suiteAddress)
        public
        returns (bool success)
    {
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
        ISuiteFactory isf = ISuiteFactory(suite._suiteFactoryAddress());

        address globalOwner = isf.owner();
        ipp.init(
            globalOwner, // governanceWalletAddress,
            eventLifeCycleAddress,
            suiteOwner // controllerWalletAddress
        );

        ipp.changeGovernanceAddress(globalOwner);
        return true;
    }
}

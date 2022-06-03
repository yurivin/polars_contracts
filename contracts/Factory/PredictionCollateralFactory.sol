pragma solidity ^0.7.6;

// SPDX-License-Identifier: Apache License 2.0

import "./ISuite.sol";
import "./ISuiteFactory.sol";
import "./AbstractFactory.sol";
import "../PredictionCollateralization.sol";
import "../iPredictionCollateralization.sol";

contract PredictionCollateralFactory is AbstractFactory {
    /*
     *   "PREDICTION_COLLATERAL"
     *   id: 0
     */
    uint8 public constant FACTORY_CONTRACT_TYPE = 0;
    string public constant FACTORY_CONTRACT_NAME = "PREDICTION_COLLATERAL";

    function createContract(
        address suiteAddress,
        string memory whiteName,
        string memory whiteSymbol,
        string memory blackName,
        string memory blackSymbol
    )
        public
        noExist(suiteAddress, FACTORY_CONTRACT_TYPE)
    {
        ISuite suite = ISuite(suiteAddress);
        require(suite.owner() == msg.sender, "Caller should be suite owner");

        // ISuiteFactory isf = ISuiteFactory(suite._suiteFactoryAddress());

        /* suite.owner() or isf.owner() */
        PredictionCollateralization pc = new PredictionCollateralization(
            /* solhint-disable prettier/prettier */
            address(this),                      // address governanceAddress,
            // msg.sender,                      // address governanceAddress,
            // isf.owner(),                     // address governanceAddress,
            suite._collateralTokenAddress(),    // address collateralTokenAddress,
            whiteName,                          // string memory whiteName,
            whiteSymbol,                        // string memory whiteSymbol,
            blackName,                          // string memory blackName,
            blackSymbol                         // string memory blackSymbol
            /* solhint-enable prettier/prettier */
        );
        suite.addContract(FACTORY_CONTRACT_TYPE, address(pc));

        emit ContractCreated(suiteAddress, address(pc), FACTORY_CONTRACT_NAME);
    }

    function changePoolAddress(address suiteAddress) public {
        ISuite suite = ISuite(suiteAddress);
        address suiteOwner = suite.owner();

        require(suiteOwner == msg.sender, "Caller should be suite owner");

        address predictionCollateralAddress = suite.contracts(
            0 // id for PREDICTION_COLLATERAL
        );

        require(
            predictionCollateralAddress != address(0),
            "You must create Prediction Collateralization before this action"
        );

        address predictionPoolAddress = suite.contracts(
            1 // id for PREDICTION_POOL
        );

        require(
            predictionPoolAddress != address(0),
            "You must create PredictionPool contract"
        );
        iPredictionCollateralization ipc = iPredictionCollateralization(
            predictionCollateralAddress
        );

        ipc.changePoolAddress(predictionPoolAddress);

        ISuiteFactory isf = ISuiteFactory(suite._suiteFactoryAddress());

        ipc.changeGovernanceAddress(isf.owner());
    }
}

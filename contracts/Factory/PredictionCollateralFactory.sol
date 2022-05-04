pragma solidity ^0.7.6;

// SPDX-License-Identifier: Apache License 2.0

import "./ISuite.sol";
import "./ISuiteFactory.sol";
import "./AbstractFactory.sol";
import "../PredictionCollateralization.sol";
import "../iPredictionCollateralization.sol";

contract PredictionCollateralFactory is AbstractFactory {
    /*
     *   keccak256("PREDICTION_COLLATERAL")
     *   0x6970334e9daa4058d3614c6c589cf69978f96a8e36faa0c6ff7211b86a56c624
     */
    bytes32 public constant FACTORY_CONTRACT_TYPE =
        keccak256("PREDICTION_COLLATERAL");

    function createContract(
        address suiteAddress,
        string memory whiteName,
        string memory whiteSymbol,
        string memory blackName,
        string memory blackSymbol
    )
        public
        noExist(suiteAddress, FACTORY_CONTRACT_TYPE)
        returns (bool success)
    {
        ISuite _suite = ISuite(suiteAddress);
        require(_suite.owner() == msg.sender, "Caller should be suite owner");

        // ISuiteFactory _isf = ISuiteFactory(_suite._suiteFactoryAddress());

        /* _suite.owner() or _isf.owner() */
        PredictionCollateralization _pc = new PredictionCollateralization(
            /* solhint-disable prettier/prettier */
            address(this),                         // address governanceAddress,
            // msg.sender,                         // address governanceAddress,
            // _isf.owner(),                       // address governanceAddress,
            _suite._collateralTokenAddress(),   // address collateralTokenAddress,
            whiteName,                          // string memory whiteName,
            whiteSymbol,                        // string memory whiteSymbol,
            blackName,                          // string memory blackName,
            blackSymbol                         // string memory blackSymbol
            /* solhint-enable prettier/prettier */
        );
        _suite.addContract(FACTORY_CONTRACT_TYPE, address(_pc));

        emit ContractCreated(
            suiteAddress,
            address(_pc),
            "PREDICTION_COLLATERAL"
        );
        return true;
    }

    function changePoolAddress(address suiteAddress)
        public
        returns (bool success)
    {
        ISuite _suite = ISuite(suiteAddress);
        address suiteOwner = _suite.owner();

        require(suiteOwner == msg.sender, "Caller should be suite owner");

        address predictionCollateralAddress = _suite.contracts(
            keccak256("PREDICTION_COLLATERAL")
        );

        require(
            predictionCollateralAddress != address(0),
            "You must create Prediction Collateralization before this action"
        );

        address predictionPoolAddress = _suite.contracts(
            keccak256("PREDICTION_POOL")
        );

        require(
            predictionPoolAddress != address(0),
            "You must create PredictionPool contract"
        );
        iPredictionCollateralization _ipc = iPredictionCollateralization(
            predictionCollateralAddress
        );

        _ipc.changePoolAddress(predictionPoolAddress);

        ISuiteFactory _isf = ISuiteFactory(_suite._suiteFactoryAddress());

        _ipc.changeGovernanceAddress(_isf.owner());

        return true;
    }
}

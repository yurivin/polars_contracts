pragma solidity ^0.7.6;

// SPDX-License-Identifier: Apache License 2.0

import "./ISuite.sol";
import "./AbstractFactory.sol";
import "../SafeMath.sol";
import "../PredictionCollateralization.sol";

contract PredictionCollateralFactory is AbstractFactory {
    bytes32 public constant FACTORY_CONTRACT_TYPE =
        keccak256("PREDICTION_COLLATERAL");

    function createContract(
        address suiteAddress,
        address collateralTokenAddress,
        string memory whiteName,
        string memory whiteSymbol,
        string memory blackName,
        string memory blackSymbol
    ) public returns (bool success) {
        ISuite _suite = ISuite(suiteAddress);
        require(_suite.owner() == msg.sender, "Caller should be suite owner");

        PredictionCollateralization _pc = new PredictionCollateralization(
            msg.sender, // address governanceAddress,
            collateralTokenAddress, // address collateralTokenAddress,
            whiteName, // string memory whiteName,
            whiteSymbol, // string memory whiteSymbol,
            blackName, // string memory blackName,
            blackSymbol // string memory blackSymbol
        );
        _suite.addContract(FACTORY_CONTRACT_TYPE, address(_pc));

        emit ContractCreated(
            suiteAddress,
            address(_pc),
            "PREDICTION_COLLATERAL"
        );
        return true;
    }
}

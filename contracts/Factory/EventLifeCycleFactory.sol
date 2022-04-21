pragma solidity ^0.7.6;

// SPDX-License-Identifier: Apache License 2.0

import "./ISuite.sol";
import "./AbstractFactory.sol";
import "../EventLifeCycle.sol";
import "../IPredictionPool.sol";

contract EventLifeCycleFactory is AbstractFactory {
    bytes32 public constant FACTORY_CONTRACT_TYPE =
        keccak256("EVENT_LIFE_CYCLE");

    function createContract(address suiteAddress, address oracleAddress)
        public
        returns (bool success)
    {
        ISuite _suite = ISuite(suiteAddress);
        require(_suite.owner() == msg.sender, "Caller should be suite owner");

        address predictionPoolAddress = _suite.contracts(
            keccak256("PREDICTION_POOL")
        );

        require(
            predictionPoolAddress != address(0),
            "You must create Prediction Pool before EventLifeCycle contract"
        );

        EventLifeCycle _elc = new EventLifeCycle(
            /* solhint-disable prettier/prettier */
            msg.sender,             // address governanceAddress,
            oracleAddress,          // address oracleAddress,
            predictionPoolAddress   // address predictionPoolAddress
            /* solhint-enable prettier/prettier */
        );

        _suite.addContract(FACTORY_CONTRACT_TYPE, address(_elc));

        emit ContractCreated(suiteAddress, address(_elc), "EVENT_LIFE_CYCLE");
        return true;
    }
}

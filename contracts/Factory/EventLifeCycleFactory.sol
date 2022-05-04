pragma solidity ^0.7.6;

// SPDX-License-Identifier: Apache License 2.0

import "./ISuite.sol";
import "./ISuiteFactory.sol";
import "./AbstractFactory.sol";
import "../EventLifeCycle.sol";

contract EventLifeCycleFactory is AbstractFactory {
    /*
     *   keccak256("EVENT_LIFE_CYCLE")
     *   0x324de064bf1fe44405ff9f415e6eae2f73fc125102342142a7bb43ef46869f4d
     */
    bytes32 public constant FACTORY_CONTRACT_TYPE =
        keccak256("EVENT_LIFE_CYCLE");

    function createContract(address suiteAddress, address oracleAddress)
        public
        noExist(suiteAddress, FACTORY_CONTRACT_TYPE)
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

        ISuiteFactory _isf = ISuiteFactory(_suite._suiteFactoryAddress());

        EventLifeCycle _elc = new EventLifeCycle(
            /* solhint-disable prettier/prettier */
            _isf.owner(),           // address governanceAddress,
            oracleAddress,          // address oracleAddress,
            predictionPoolAddress   // address predictionPoolAddress
            /* solhint-enable prettier/prettier */
        );

        _suite.addContract(FACTORY_CONTRACT_TYPE, address(_elc));

        emit ContractCreated(suiteAddress, address(_elc), "EVENT_LIFE_CYCLE");
        return true;
    }
}

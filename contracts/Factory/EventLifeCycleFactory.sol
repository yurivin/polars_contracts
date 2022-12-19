pragma solidity ^0.7.6;

// SPDX-License-Identifier: Apache License 2.0

import "./ISuite.sol";
import "./ISuiteFactory.sol";
import "./AbstractFactory.sol";
import "../EventLifeCycle.sol";

contract EventLifeCycleFactory is AbstractFactory {
    /*
     *   "EVENT_LIFE_CYCLE"
     *   id: 2
     */
    uint8 public constant FACTORY_CONTRACT_TYPE = 2;
    string public constant FACTORY_CONTRACT_NAME = "EVENT_LIFE_CYCLE";

    function createContract(address suiteAddress, address oracleAddress)
        public
        noExist(suiteAddress, FACTORY_CONTRACT_TYPE)
    {
        ISuite suite = ISuite(suiteAddress);
        require(suite.owner() == msg.sender, "Caller should be suite owner");

        address predictionPoolAddress = suite.contracts(
            1 // id for PREDICTION_POOL
        );

        require(
            predictionPoolAddress != address(0),
            "You must create Prediction Pool before EventLifeCycle contract"
        );

        EventLifeCycle elc = new EventLifeCycle(
            /* solhint-disable prettier/prettier */
            address(
                suite._suiteFactoryAddress()
            ),                      // address governanceAddress,
            oracleAddress,          // address oracleAddress,
            predictionPoolAddress   // address predictionPoolAddress
            /* solhint-enable prettier/prettier */
        );

        emit ContractCreated(suiteAddress, address(elc), FACTORY_CONTRACT_NAME);

        suite.addContract(FACTORY_CONTRACT_TYPE, address(elc));
    }
}

pragma solidity ^0.7.6;

// SPDX-License-Identifier: Apache License 2.0

import "./ISuite.sol";
import "./ISuiteFactory.sol";
import "./AbstractFactory.sol";
import "../PendingOrders.sol";

contract PendingOrdersFactory is AbstractFactory {
    /*
     *   "PENDING_ORDERS"
     *   id: 3
     */
    uint8 public constant FACTORY_CONTRACT_TYPE = 3;
    string public constant FACTORY_CONTRACT_NAME = "PENDING_ORDERS";

    function createContract(address suiteAddress)
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
            "You must create Prediction Pool before PendingOrders contract"
        );

        address eventContractAddress = suite.contracts(
            2 // id for EVENT_LIFE_CYCLE
        );

        require(
            eventContractAddress != address(0),
            "You must create Event Life Cycle before PendingOrders contract"
        );

        PendingOrders poc = new PendingOrders(
            /* solhint-disable prettier/prettier */
            predictionPoolAddress,              // address predictionPoolAddress,
            suite._collateralTokenAddress(),    // address collateralTokenAddress,
            eventContractAddress                // address eventContractAddress
            /* solhint-enable prettier/prettier */
        );

        poc.transferOwnership(address(suite._suiteFactoryAddress()));

        suite.addContract(FACTORY_CONTRACT_TYPE, address(poc));

        emit ContractCreated(suiteAddress, address(poc), FACTORY_CONTRACT_NAME);
    }
}

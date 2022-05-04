pragma solidity ^0.7.6;

// SPDX-License-Identifier: Apache License 2.0

import "./ISuite.sol";
import "./AbstractFactory.sol";
import "../PendingOrders.sol";

contract PendingOrdersFactory is AbstractFactory {
    /*
     *   keccak256("PENDING_ORDERS")
     *   0xe4ebe61b5154be65502ffd10f19bbd557c590ef2ce56d0959d42d567662e4e7f
     */
    bytes32 public constant FACTORY_CONTRACT_TYPE = keccak256("PENDING_ORDERS");

    function createContract(address suiteAddress)
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
            "You must create Prediction Pool before PendingOrders contract"
        );

        address eventContractAddress = _suite.contracts(
            keccak256("EVENT_LIFE_CYCLE")
        );

        require(
            eventContractAddress != address(0),
            "You must create Event Life Cycle before PendingOrders contract"
        );

        PendingOrders _poc = new PendingOrders(
            /* solhint-disable prettier/prettier */
            predictionPoolAddress,              // address predictionPoolAddress,
            _suite._collateralTokenAddress(),   // address collateralTokenAddress,
            eventContractAddress                // address eventContractAddress
            /* solhint-enable prettier/prettier */
        );
        _poc.transferOwnership(_suite.owner());

        _suite.addContract(FACTORY_CONTRACT_TYPE, address(_poc));

        emit ContractCreated(suiteAddress, address(_poc), "PENDING_ORDERS");
        return true;
    }
}

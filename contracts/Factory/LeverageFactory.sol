pragma solidity ^0.7.6;

// SPDX-License-Identifier: Apache License 2.0

import "./ISuite.sol";
import "./ISuiteFactory.sol";
import "./AbstractFactory.sol";
import "../Leverage.sol";

contract LeverageFactory is AbstractFactory {
    /*
     *   "LEVERAGE"
     *   id: 4
     */
    uint8 public constant FACTORY_CONTRACT_TYPE = 4;
    string public constant FACTORY_CONTRACT_NAME = "LEVERAGE";

    function createContract(address suiteAddress)
        public
        noExist(suiteAddress, FACTORY_CONTRACT_TYPE)
    {
        ISuite suite = ISuite(suiteAddress);
        require(suite.owner() == msg.sender, "Caller should be suite owner");

        address pendingOrdersAddress = suite.contracts(
            3 // id for PENDING_ORDERS
        );

        require(
            pendingOrdersAddress != address(0),
            "You must create Pending Orders before Leverage contract"
        );

        Leverage lc = new Leverage(
            /* solhint-disable prettier/prettier */
            suite._collateralTokenAddress(),    // address collateralTokenAddress
            pendingOrdersAddress                // address pendingOrdersAddress
            /* solhint-enable prettier/prettier */
        );

        lc.transferOwnership(address(suite._suiteFactoryAddress()));

        suite.addContract(FACTORY_CONTRACT_TYPE, address(lc));

        emit ContractCreated(suiteAddress, address(lc), FACTORY_CONTRACT_NAME);
    }
}

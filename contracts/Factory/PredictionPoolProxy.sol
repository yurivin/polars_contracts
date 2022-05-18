pragma solidity ^0.7.4;
// "SPDX-License-Identifier: MIT"

import "./ISuite.sol";
import "../PredictionPool.sol";

contract PredictionPoolProxy {
    function createPredictionPool(
        address suiteAddress,
        uint256 whitePrice,
        uint256 blackPrice
    ) external returns (address) {
    // ) external onlyGovernance {
        ISuite suite = ISuite(suiteAddress);
        // require(suite.owner() == msg.sender, "Caller should be suite owner");

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
        pp.changeGovernanceAddress(msg.sender);
        return address(pp);
    }
}

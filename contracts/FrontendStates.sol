// SPDX-License-Identifier: GNU General Public License v3.0 or later

pragma solidity ^0.7.4;
pragma abicoder v2;

import "./Common/Ownable.sol";
import "./IPredictionPool.sol";
import "./IOracleEventManager.sol";
import "./SafeMath.sol";

contract FrontendStates is Ownable {
    using SafeMath for uint256;

    constructor(
        address oracleEventManagerAddress
    ) {
        _oracleEventManager = IOracleEventManager(oracleEventManagerAddress);
    }

    event OracleEventManagerChanged(address oracleEventManagerAddress);

    IOracleEventManager public _oracleEventManager;

    function allowPrepare() public view returns (bool) {
        IPredictionPool _predictionPool = IPredictionPool(
            _oracleEventManager._predictionPool.address
        );

        if (_predictionPool._eventStarted() == true) {
            return false;
        }

        IOracleEventManager.GameEvent memory gameEvent = _oracleEventManager._gameEvent();

        uint256 eventStartTimeExpected = gameEvent.eventStartTimeExpected;

        uint256 _checkPeriod = _oracleEventManager._checkPeriod();

        uint256 createdAt = gameEvent.createdAt;

        uint256 x = eventStartTimeExpected.add(_checkPeriod.div(2));

        if ((block.timestamp > x) || (createdAt == 0)) {
            return true;
        } else {
            return false;
        }
    }

    function allowStart() public view returns (bool) {
        IPredictionPool _predictionPool = IPredictionPool(
            _oracleEventManager._predictionPool.address
        );

        if (_predictionPool._eventStarted() == true) {
            return false;
        }

        uint256 nowTime = block.timestamp;

        IOracleEventManager.GameEvent memory gameEvent = _oracleEventManager._gameEvent();

        uint256 eventStartTimeExpected = gameEvent.eventStartTimeExpected;

        uint256 _checkPeriod = _oracleEventManager._checkPeriod();

        uint256 x = eventStartTimeExpected.sub(_checkPeriod.div(2));
        uint256 y = eventStartTimeExpected.add(_checkPeriod.div(2));

        uint256 startedAt = gameEvent.startedAt;

        if (
            (startedAt != 0) ||
            (eventStartTimeExpected == 0) ||
            (nowTime <= x)
        ) {
            return false;
        }

        if ((gameEvent.createdAt < nowTime) && (nowTime < y)) {
            return true;
        } else {
            return false;
        }
    }

    function allowFinalize() public view returns (bool) {
        IPredictionPool _predictionPool = IPredictionPool(
            _oracleEventManager._predictionPool.address
        );

        if (_predictionPool._eventStarted() == false) {
            return false;
        }

        IOracleEventManager.GameEvent memory gameEvent = _oracleEventManager._gameEvent();

        if (gameEvent.startedAt == 0) {
            return false;
        }

        if (
            (gameEvent.startedAt != 0) &&
            (block.timestamp >= gameEvent.eventEndTimeExpected)
        ) {
            if (gameEvent.endedAt == 0) {
                return true;
            } else {
                return false;
            }
        } else {
            return false;
        }
    }

    function changeOracleEventManagerAddress(address _oracleEventManagerAddress)
        public
        onlyOwner
    {
        require(
            _oracleEventManagerAddress != address(0),
            "New pool address should be not null"
        );
        _oracleEventManager = IOracleEventManager(_oracleEventManagerAddress);
        emit OracleEventManagerChanged(_oracleEventManagerAddress);
    }
}

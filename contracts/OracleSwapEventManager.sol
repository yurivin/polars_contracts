// SPDX-License-Identifier: GNU General Public License v3.0 or later

pragma solidity ^0.7.4;

import "./OracleEventManager.sol";
// import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "./ERC20Detailed.sol";
import "./IPancake.sol";

contract OracleSwapEventManager is OracleEventManager {
    // address public _pairAddress;
    IPancakePair public _pair;
    uint8 public _primaryToken;
    address internal tokenA;
    address internal tokenB;
    string internal aTokenSym;
    string internal bTokenSym;

    int8 internal lastGameResult = 0;

    struct RoundData {
        int256 price;
        uint256 providerTimeStamp;
    }

    RoundData public _startRoundData;
    RoundData public _endRoundData;

    event LatestRound(int256 price, uint256 timeStamp);
    event PairAddressChanged(address);

    constructor(
        address eventLifeCycleAddress,
        address predictionPoolAddress,
        uint256 priceChangePart,
        uint256 eventStartTimeOutExpected,
        uint256 eventEndTimeOutExpected
    )
        OracleEventManager(
            eventLifeCycleAddress,
            predictionPoolAddress,
            priceChangePart,
            eventStartTimeOutExpected,
            eventEndTimeOutExpected
        )
    {
        _config._eventType = string("Crypto");
    }

    function bdiv(uint256 a, uint256 b) internal pure returns (uint256) {
        // solhint-disable-next-line var-name-mixedcase
        uint256 BONE = 10**18;
        require(b != 0, "ERR_DIV_ZERO");
        uint256 c0 = a * BONE;
        require(a == 0 || c0 / a == BONE, "ERR_DIV_INTERNAL"); // bmul overflow
        uint256 c1 = c0 + (b / 2);
        require(c1 >= c0, "ERR_DIV_INTERNAL"); //  badd require
        uint256 c2 = c1 / b;
        return c2;
    }

    function getCurrentPrice()
        public
        view
        returns (int256 price, uint256 providerTimeStamp)
    {
        (
            uint112 _reserve0,
            uint112 _reserve1,
            uint32 _blockTimestampLast
        ) = _pair.getReserves();

        if (_primaryToken == 0) {
            price = int256(bdiv(_reserve1, _reserve0));
        } else {
            price = int256(bdiv(_reserve0, _reserve1));
        }

        providerTimeStamp = _blockTimestampLast;
    }

    function getExternalEventStartData()
        internal
        override
        returns (string memory eventName)
    {
        uint256 providerTimeStamp = 0;
        int256 price = 0;

        (price, providerTimeStamp) = getCurrentPrice();

        emit LatestRound(price, providerTimeStamp);

        eventName = string(
            abi.encodePacked(
                _config._eventSeries,
                " ",
                toString(uint256(price))
            )
        );
        _startRoundData.price = price;
    }

    function getExternalEventEndData() internal override {
        uint256 providerTimeStamp = 0;
        int256 price = 0;

        (price, providerTimeStamp) = getCurrentPrice();

        emit LatestRound(price, providerTimeStamp);
        _endRoundData.price = price;
    }

    function calculateEventResult()
        internal
        view
        override
        returns (int8 gameResult)
    {
        gameResult = 0;

        if (_primaryToken == 0) {
            if (_startRoundData.price < _endRoundData.price) {
                if (_lastEventId % 2 == 0) {
                    gameResult = 1;
                } else {
                    gameResult = -1;
                }
            }
            if (_startRoundData.price > _endRoundData.price) {
                if (_lastEventId % 2 == 0) {
                    gameResult = -1;
                } else {
                    gameResult = 1;
                }
            }
        } else {
            if (_startRoundData.price > _endRoundData.price) {
                if (_lastEventId % 2 == 0) {
                    gameResult = 1;
                } else {
                    gameResult = -1;
                }
            }
            if (_startRoundData.price < _endRoundData.price) {
                if (_lastEventId % 2 == 0) {
                    gameResult = -1;
                } else {
                    gameResult = 1;
                }
            }
        }
    }

    function finalizeEvent() external override {
        require(_predictionPool._eventStarted() == true, "Event not started");

        GameEvent memory gameEvent = _gameEvent;

        require((gameEvent.startedAt != 0), "Event not started");
        require(
            (gameEvent.startedAt != 0) &&
                (block.timestamp >= gameEvent.eventEndTimeExpected),
            "Too early end"
        );

        if (gameEvent.endedAt == 0) {
            getExternalEventEndData();
            lastGameResult = calculateEventResult();

            gameEvent.endedAt = block.number;
        } else {
            require(
                (gameEvent.endedAt < block.number),
                "Finalize event in next block"
            ); // May be no need

            getExternalEventEndData();

            // Black won -1, 1 means white-won, 0 means draw.
            int8 gameResult = calculateEventResult();

            if (lastGameResult != gameResult) {
                lastGameResult = 0;
            }
            _eventLifeCycle.endEvent(lastGameResult);

            gameEvent.endedAt = block.timestamp;

            emit AppEnded(
                gameEvent.endedAt,
                gameEvent.eventEndTimeExpected,
                lastGameResult
            );

            _config._eventName = _config._eventSeries;
        }
        _gameEvent = gameEvent;
    }

    function addDex(address pairAddress, uint8 primaryToken) public onlyOwner {
        require(
            (primaryToken == 0) || (primaryToken == 1),
            "Primary Token must equal 0 or 1"
        );
        require(
            pairAddress != address(0),
            "New pair address should be not null"
        );

        _pair = IPancakePair(pairAddress);
        _primaryToken = primaryToken;

        if (_primaryToken == 0) {
            tokenA = _pair.token0();
            tokenB = _pair.token1();
        } else {
            tokenA = _pair.token1();
            tokenB = _pair.token0();
        }
        OracleConfig memory config = _config;

        aTokenSym = ERC20Detailed(tokenA).symbol();
        bTokenSym = ERC20Detailed(tokenB).symbol();
        config._downTeam = string(abi.encodePacked(aTokenSym, "-DOWN"));
        config._upTeam = string(abi.encodePacked(aTokenSym, "-UP"));
        config._eventName = string(abi.encodePacked(aTokenSym, "-", bTokenSym));
        config._eventSeries = string(
            abi.encodePacked(aTokenSym, "-", bTokenSym)
        );

        _config = config;
        emit PairAddressChanged(pairAddress);
    }
}

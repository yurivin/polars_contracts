// SPDX-License-Identifier: MIT
pragma solidity ^0.7.4;

import "./Common/chainlink/v0.7/ChainlinkClient.sol";
import "./Common/IERC20.sol";
import "./Common/Ownable.sol";

/**
 * Request testnet LINK and ETH here: https://faucets.chain.link/
 * Find information on LINK Token Contracts and get the latest ETH and LINK faucets here: https://docs.chain.link/docs/link-token-contracts/
 */

contract ChainlinkAPIConsumer is ChainlinkClient, Ownable {
    using Chainlink for Chainlink.Request;

    mapping(address => bool) public _oracleAddresses;

    uint256 public lastPrice;
    uint256 public lastTime;

    address private oracle;
    bytes32 private jobId;
    uint256 private fee;

    event LatestData(uint256 lastPrice, uint256 lastTime);
    event OracleAddressAdded(address oracle);
    event OracleAddressExcluded(address oracle);

    constructor(
        address _oracle,
        bytes32 _jobId,
        uint256 _fee
    ) {
        setPublicChainlinkToken();
        oracle = _oracle;
        jobId = _jobId;
        fee = _fee;
    }

    modifier onlyOracle() {
        require(
            _oracleAddresses[msg.sender] == true,
            "Caller should be Oracle"
        );
        _;
    }

    /**
     * Create a Chainlink request to retrieve API response, find the target
     * data, then multiply by 1000000000000000000 (to remove decimal places from data).
     */
    function requestPriceData(string calldata ticker)
        public
        onlyOracle
        returns (bytes32 requestId)
    {
        Chainlink.Request memory request = buildChainlinkRequest(
            jobId,
            address(this),
            this.fulfill.selector
        );

        string
            memory url = "https://api.binance.com/api/v3/ticker/price?symbol=";

        string memory requestUrl = string(abi.encodePacked(url, ticker));

        // Set the URL to perform the GET request on
        request.add("get", requestUrl);

        /**
         * Set the path to find the desired data in the API response,
         * where the response format is:
         * {
         *     "symbol": "BNBUSDT",
         *     "price": "417.50000000"
         * }
         */
        request.add("path", "price");

        // Multiply the result by 1000000000000000000 to remove decimals
        int256 timesAmount = 10**18;
        request.addInt("times", timesAmount);

        // Sends the request
        return sendChainlinkRequestTo(oracle, request, fee);
    }

    /**
     * Receive the response in the form of uint256
     */
    function fulfill(bytes32 _requestId, uint256 _lastPrice)
        public
        recordChainlinkFulfillment(_requestId)
    {
        lastPrice = _lastPrice;
        lastTime = block.timestamp;
        emit LatestData(lastPrice, lastTime);
    }

    function withdrawLink() external onlyOwner {
        address linkAddress = chainlinkTokenAddress();
        IERC20 linkToken = IERC20(linkAddress);

        uint256 balance = linkToken.balanceOf(address(this));
        require(balance > 0, "No link tokens on this contract");

        linkToken.transfer(msg.sender, balance);
    }

    function latestRoundData() external view returns (int256, uint256) {
        return (int256(lastPrice), lastTime);
    }

    function addOracleAddress(address oracleAddress) public onlyOwner {
        require(
            oracleAddress != address(0),
            "New oracle address should be not null"
        );
        _oracleAddresses[oracleAddress] = true;
        emit OracleAddressAdded(oracleAddress);
    }

    function excludeOracleAddress(address oracleAddress) public onlyOwner {
        require(
            oracleAddress != address(0),
            "Oracle address should be not null"
        );
        delete _oracleAddresses[oracleAddress];
        emit OracleAddressExcluded(oracleAddress);
    }
}

const {
  BN,           // Big Number support
  time,
  constants,    // Common constants, like the zero address and largest integers
  expectEvent,  // Assertions for emitted events
  expectRevert, // Assertions for transactions that should fail
} = require('@openzeppelin/test-helpers');

const chai = require('chai');
const expect = require('chai').expect;

const EventLifeCycle = artifacts.require("EventLifeCycle");
const PredictionPool = artifacts.require("PredictionPool");

const priceChangePart = new BN("50000000000000000");

/*
 * uncomment accounts to access the test accounts made available by the
 * Ethereum client
 * See docs: https://www.trufflesuite.com/docs/truffle/testing/writing-tests-in-javascript
 */
contract("EventLifeCycle", (accounts) => {
  "use strict";

  const deployerAddress = accounts[0];

  let deployedPredictionPool;
  let deployedEventLifeCycle;

  before(async () => {
    deployedPredictionPool = await PredictionPool.deployed();
    // deployedPredictionCollateralization = await PredictionCollateralization.deployed();
    deployedEventLifeCycle = await EventLifeCycle.deployed();
  })

  it("should assert EventLifeCycle address equal PredictionPool._eventContractAddress()", async () => {
    return assert.equal(deployedEventLifeCycle.address, await deployedPredictionPool._eventContractAddress());
  });

  it("should assert EventLifeCycle address equal PredictionPool._eventContractAddress()", async () => {
    const timestamp = await time.latest();
    const duration = time.duration.seconds(1000);
    const eventEndTimeExpected = timestamp.add(duration);

    const addAndStartEvent = await deployedEventLifeCycle.addAndStartEvent(
      priceChangePart,
      timestamp,
      eventEndTimeExpected,
      "black team",
      "White team",
      "Test type",
      "Test series",
      "Test name",
      timestamp
    );

    const expectedTimestamp = await time.latest();

    const { logs: addAndStartEventLog } = addAndStartEvent;

    const eventCount = 1;
    assert.equal(addAndStartEventLog.length, eventCount, `triggers must be ${eventCount} event`);

    expectEvent.inLogs(addAndStartEventLog, 'GameEventStarted', {
      // time: expectedTimestamp, // Need fix timestamp
      eventId: timestamp
    });

    const ongoingEvent = await deployedEventLifeCycle._ongoingEvent();
    // // assertEquals(priceChangePart, ongoingEvent.priceChangePart());
    // // assert.equal(priceChangePart, ongoingEvent.priceChangePart);
    expect(ongoingEvent.priceChangePart).to.be.bignumber.equal(priceChangePart);
    expect(ongoingEvent.eventStartTimeExpected).to.be.bignumber.equal(timestamp);
    expect(ongoingEvent.eventEndTimeExpected).to.be.bignumber.equal(eventEndTimeExpected);
    expect(ongoingEvent.eventId).to.be.bignumber.equal(timestamp);

    // uint256 priceChangePart;       // in percent
    // uint eventStartTimeExpected; // in seconds since 1970
    // uint eventEndTimeExpected;   // in seconds since 1970
    // string blackTeam;
    // string whiteTeam;
    // string eventType;
    // string eventSeries;
    // string eventName;
    // uint eventId;

    // var timestamp = new BigInteger(String.valueOf(Instant.now().getEpochSecond()));
    // var eventEndTimeExpected = new BigInteger(String.valueOf(Instant.now().getEpochSecond() + 1000));
    // eventlifeCycle.addAndStartEvent(
    //   priceChangePart,
    //   timestamp,
    //   eventEndTimeExpected,
    //   "black team",
    //   "White team",
    //           "Test type",
    //   "Test series",
    //   "Test name",
    //   timestamp
    //   ).send();
    // var ongoingEvent = eventlifeCycle._ongoingEvent().send();
    // assertEquals(priceChangePart, ongoingEvent.component1());
    // assertEquals(timestamp, ongoingEvent.component2());
    // assertEquals(eventEndTimeExpected, ongoingEvent.component3());
    // assertEquals(timestamp, ongoingEvent.component9());

    // var eventResult = new BigInteger("1");
    // eventlifeCycle.endEvent(eventResult).send();

    // assertFalse("Event not ended, but should be ended", bettingPool._eventStarted().send());
    // assertFalse(eventlifeCycle.eventIsInProgress().send());

    // var blackPriceAfterEvent = bettingPool._blackPrice().send();
    // var whitePriceAfterEvent = bettingPool._whitePrice().send();
    // log.info("Black & White prices after event: " + blackPriceAfterEvent + " " + whitePriceAfterEvent);
    // assertTrue(blackPriceAfterEvent.compareTo(whitePriceAfterEvent) < 0);
    // return assert.equal(deployedEventLifeCycle.address, await deployedBettingPool._eventContractAddress());
  });

});

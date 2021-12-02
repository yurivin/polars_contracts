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

contract("EventLifeCycle", (accounts) => {
  "use strict";

  const deployerAddress = accounts[0];

  let deployedPredictionPool;
  let deployedEventLifeCycle;

  before(async () => {
    deployedPredictionPool = await PredictionPool.deployed();
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
      // time: expectedTimestamp, // TODO: Need fix timestamp
      eventId: timestamp
    });

    const ongoingEvent = await deployedEventLifeCycle._ongoingEvent();
    expect(ongoingEvent.priceChangePart).to.be.bignumber.equal(priceChangePart);
    expect(ongoingEvent.eventStartTimeExpected).to.be.bignumber.equal(timestamp);
    expect(ongoingEvent.eventEndTimeExpected).to.be.bignumber.equal(eventEndTimeExpected);
    expect(ongoingEvent.eventId).to.be.bignumber.equal(timestamp);
  });

});

pragma solidity ^0.8.0;
// "SPDX-License-Identifier: MIT"

interface iVotingEscrow {
    
    function create_lock_for_origin(uint256 _value, uint256 _unlock_time) external; 
      
}

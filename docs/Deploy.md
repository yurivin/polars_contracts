## Deploy

Make a copy of file `env.json.example` named `.env.json`.
Remove if exists ```deployed``` folder from root for clean installation.


If you want to create own test instance of Polars contracts, follow the next steps:

First, for tests, we must have test tokens for manage pool and price oracles.
Run in console deploy of three tokens (created automated inside scripts)
```
npm run deploy:tokens:rinkeby     // Tokens for work on Rinkeby
```
Now, if deployment no has errors, in root folder will appear `deployment` folder.
Inside `deployment` folder will appear file with name (for example):
`1_rinkeby_test_tokens_addresses.json`
where parts mean:
`1`: number of migration
`rinkeby`: used network
`test_tokens_addresses`: name of file.

Inside this file you can find json content same as:
```
{
  "tokenA": "0x28A764fB5eBECcf68d0Ea7Ee3eF8eb6799E347df",
  "tokenB": "0x5f2D7d7bB5dB2AE909C6deA0a7E16F034D1E5f91",
  "collateralToken": "0xC495b2cE43e88366ADc74fFAEA5B12a2Df7Eb5d9"
}
```
This is your deployed tokens.
If you already have test tokens or use mainnet, you can ignore this step.

```
npm run deploy:prediction:rinkeby // Prediction contracts on Rinkeby
npm run deploy:elc:rinkeby        // EventLifeCycle contract on Rinkeby
npm run deploy:pending:rinkeby    // PendingOrders contract on Rinkeby
```

All scripts automatically check the addresses specified in the files from `deployed` folder for the existence of contract addresses, and skip creating new ones if the contract exists.
Therefore, if you want to create a new instance of a contract, you first need to remove the address from the file in `deployed` folder.

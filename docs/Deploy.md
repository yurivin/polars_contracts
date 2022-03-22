## Deploy

Make a copy of file `env.json.example` named `.env.json`.<br>
Remove if exists ```deployed``` folder from root for clean installation.


If you want to create own test instance of Polars contracts, follow the next steps:
_________________
First, for tests, we must have test tokens for manage pool and price oracles.<br>
Run in console deploy of three tokens (created automatically inside scripts)
```
npm run deploy:tokens:rinkeby     // Tokens for work on Rinkeby
```
Now, if deployment no has errors, in root folder will appear `deployment` folder.

Inside `deployment` folder will appear file with name (for example):

`1_rinkeby_test_tokens_addresses.json`
where parts mean:
 - `1`: number of migration
 - `rinkeby`: used network
 - `test_tokens_addresses`: name of file.

Inside this file you can find json content same as:
```
{
  "tokenA": "0x28A764fB5eBECcf68d0Ea7Ee3eF8eb6799E347df",
  "tokenB": "0x5f2D7d7bB5dB2AE909C6deA0a7E16F034D1E5f91",
  "collateralToken": "0xC495b2cE43e88366ADc74fFAEA5B12a2Df7Eb5d9"
}
```
This is your deployed tokens.
If you already have test tokens or use mainnet, you can ignore this step and create this file manually.

_________________
Second step is deploy main contracts of Polars.
Run in console:
```
npm run deploy:prediction:rinkeby // Prediction contracts on Rinkeby
```
This command will create Prediction pool, and file `2_rinkeby_main_contracts_addresses.json`
where parts mean:
 - `2`: number of migration
 - `rinkeby`: used network
 - `main_contracts_addresses`: name of file.

Inside this file, at now, you can find json content same as:
```
{
  "predictionCollateralization": "0xCeBe515559d908E2AbC9E80c074657b070411A0F",
  "predictionPool": "0x35Ef88603B39F22E58836BD3cB7f7812409c83f9"
}
```
This is your deployed Prediction Collateralization and Prediction Pool addresses.

_________________
Third step, deploy Event Life Cycle contract.

This contract need for run and finalize events. <br>
Run in console:
```
npm run deploy:elc:rinkeby        // EventLifeCycle contract on Rinkeby
```
Inside `2_rinkeby_main_contracts_addresses.json` file will appear new strings:
```
{
  "predictionCollateralization": "0xCeBe515559d908E2AbC9E80c074657b070411A0F",
  "predictionPool": "0x35Ef88603B39F22E58836BD3cB7f7812409c83f9",
  "eventLifeCycle": "0x19E22f8C385a7BAE38B14484E7Fc79d527938e8f" // <-- new
}
```
_________________
Fourth step, deploy Pending Orders contract. <br>
Run in console:
```
npm run deploy:pending:rinkeby    // PendingOrders contract on Rinkeby
```
Inside `2_rinkeby_main_contracts_addresses.json` file will appear new strings:
```
{
  "predictionCollateralization": "0xCeBe515559d908E2AbC9E80c074657b070411A0F",
  "predictionPool": "0x35Ef88603B39F22E58836BD3cB7f7812409c83f9",
  "eventLifeCycle": "0x19E22f8C385a7BAE38B14484E7Fc79d527938e8f"
  "pendingOrders": "0xaA100e701B80837117907A6403Ee25228fda4526", // <-- new
}
```
_________________

All scripts automatically check the addresses specified in the files from `deployed` folder for the existence of contract addresses, and skip creating new ones if the contract exists.
Therefore, if you want to create a new instance of a contract, you first need to remove the address from the file in `deployed` folder.

# polars_contracts

## Install and run ganache client
```
npm install -g ganache-cli
```

Start ganache client in a separate terminal
```
ganache-cli
```

## Install Vyper
```
sudo apt install python3-pip
pip install vyper==0.2.12
```

## Install dependencies
```
npm install -g truffle mocha solhint
npm install -g dotenv
npm install
```

Make a copy of file `env.json.example` named `.env.json`.
Remove if exists ```deployed``` folder from root for clean installation.

## Deploy
```
npm run deploy:tokens:rinkeby     // Tokens for work on Rinkeby
npm run deploy:prediction:rinkeby // Prediction contracts on Rinkeby
npm run deploy:elc:rinkeby        // EventLifeCycle contract on Rinkeby
npm run deploy:pending:rinkeby    // PendingOrders contract on Rinkeby
```

## Run tests
### On local ganache instance:
Start ganache-cli with some account count
```
ganache-cli -a 10  // 10 accounts by default
```
If you want, you can use ganache in fork mode:
```
ganache-cli -a 10 -m "admit topple burger tomorrow protect pill jaguar tell congress direct finish path" --fork https://rinkeby.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161  // 10 accounts by default, same mnemonic and seed address of rinkeby testnet
```

Start dev tests
```
truffle test --stacktrace-extra --network development -g "DEV:"  // grep tests with "DEV" suffix
```
or run
```
npm run test:dev // equivalent
```

## Start live tests
Start tests can only after deployed on same network
```
ganache-cli -m "admit topple burger tomorrow protect pill jaguar tell congress direct finish path" --fork https://rinkeby.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161
```
```
npm run test:live:rinkeby
```

## Run coverage
```
truffle run coverage
```
or run
```
npm run coverage // equivalent
```

## Run tests in docker
```
docker-compose up --exit-code-from truffle
```

## Use linter

Install
```
npm install -g solhint-plugin-prettier
```

Run from the project root directory
```
solhint contracts/*.sol
```

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

Run tests
```
truffle test --stacktrace-extra --network=development
```

or
## Run tests in docker
```
docker-compose up --exit-code-from truffle
```

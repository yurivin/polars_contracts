/**
 * Use this file to configure your truffle project. It's seeded with some
 * common settings for different networks and features like migrations,
 * compilation and testing. Uncomment the ones you need or modify
 * them to suit your project as necessary.
 *
 * More information about configuration can be found at:
 *
 * trufflesuite.com/docs/advanced/configuration
 *
 * To deploy via Infura you'll need a wallet provider (like @truffle/hdwallet-provider)
 * to sign your transactions before they're sent to a remote public node. Infura accounts
 * are available for free at: infura.io/register.
 *
 * You'll also need a mnemonic - the twelve word phrase the wallet uses to generate
 * public/private key pairs. If you're publishing your code to GitHub make sure you load this
 * phrase from a file you've .gitignored so it doesn't accidentally become public.
 *
 */

const HDWalletProvider = require('@truffle/hdwallet-provider');

const {
  PRIVATE_KEY,
  ETHER_SCAN_API_KEY,
  BSC_SCAN_API_KEY,
  HECO_SCAN_API_KEY,
  POLY_SCAN_API_KEY,
  SEED_ADDRESS_BSC,
  SEED_ADDRESS_KOVAN,
  SEED_ADDRESS_RINKEBY,
  SEED_ADDRESS_HECO,
  SEED_ADDRESS_MUMBAI,
  mnemonic
} = require('./.env.json');

//
// const fs = require('fs');
// const mnemonic = fs.readFileSync(".secret").toString().trim();

function getProvider(rpc) {
  return function() {
    const provider = new web3.providers.WebsocketProvider(rpc);
    return new HDWalletProvider(process.env.DEPLOYMENT_KEY, provider);
  };
}

module.exports = {
  /**
   * Networks define how you connect to your ethereum client and let you set the
   * defaults web3 uses to send transactions. If you don't specify one truffle
   * will spin up a development blockchain for you on port 9545 when you
   * run `develop` or `test`. You can ask a truffle command to use a specific
   * network from the command line, e.g
   *
   * $ truffle test --network <network-name>
   */

  networks: {
    // Useful for testing. The `development` name is special - truffle uses it by default
    // if it's defined here and no other network is specified at the command line.
    // You should run a client (like ganache-cli, geth or parity) in a separate terminal
    // tab if you use this network and you must also set the `host`, `port` and `network_id`
    // options below to some value.
    //
    development: {
     // provider: () => new HDWalletProvider(PRIVATE_KEY, "http://localhost:8545"),
     // provider: () => new HDWalletProvider(mnemonic, `https://data-seed-prebsc-1-s1.binance.org:8545`),
     host: "127.0.0.1",     // Localhost (default: none)
     port: 8545,            // Standard Ethereum port (default: none)
     network_id: "*",       // Any network (default: none)
    },
    coverage: {
     host: 'localhost',
     network_id: '*',
     port: 8555,
     gas: 0xfffffffffff,
     gasPrice: 0x01,
    },
    bsc_testnet_fork: {
     provider: () => new HDWalletProvider(
      mnemonic, 'http://localhost:8545',
     ),
     network_id: 97,
     timeoutBlocks: 200,
     confirmations: 1,
     skipDryRun: true,
    },
    bsc_testnet: {
     provider: () => new HDWalletProvider(
      mnemonic, SEED_ADDRESS_BSC,
     ),
     network_id: 97,
     port: 8545,
     networkCheckTimeout: 10000,
     timeoutBlocks: 200,
     confirmations: 1,
     gasPrice: 50e9, // 1 gwei
     gasLimit: 50 * 1e6, // 8,000,000
     skipDryRun: true,
     production: true    // Treats this network as if it was a public net. (default: false)
    },
    heco_testnet: {
     provider: () => new HDWalletProvider(
      mnemonic, SEED_ADDRESS_HECO,
     ),
     network_id: 256,
     port: 8545,
     timeoutBlocks: 200,
     confirmations: 5,
     skipDryRun: true,
     production: true    // Treats this network as if it was a public net. (default: false)
    },
    rinkeby_fork: {
     provider: () => new HDWalletProvider(
      mnemonic, 'http://localhost:8545',
     ),
     gasPrice: 1e9, // 1 gwei
     gasLimit: 8 * 1e6, // 8,000,000
     network_id: 4,
     skipDryRun: true,
    },
    rinkeby: {
     provider: () => new HDWalletProvider(
      mnemonic, SEED_ADDRESS_RINKEBY,
     ),
     // gasPrice: 5e9, // 5 gwei
     timeoutBlocks: 200,
     // gasLimit: 8 * 1e6, // 8,000,000
     network_id: 4,
     confirmations: 1,
     skipDryRun: true,
     production: true
    },
    mumbai: {
     provider: () => new HDWalletProvider(
      mnemonic, SEED_ADDRESS_MUMBAI,
     ),
     gasPrice: 60e9, // 60 gwei
     gasLimit: 12 * 1e6, // 12,000,000
     timeoutBlocks: 200,
     network_id: 80001,
     confirmations: 0,
     skipDryRun: true,
     production: true
    },
    kovan: {
     provider: () => new HDWalletProvider(
      mnemonic, SEED_ADDRESS_KOVAN,
     ),
     network_id: 42,
     gasPrice: 1e9, // 1 gwei
     gasLimit: 8 * 1e6, // 8,000,000
     skipDryRun: true,
    },
    heco: {
      provider: () => new HDWalletProvider(
        mnemonic, SEED_ADDRESS_HECO,
      ),
      network_id: 256,
      gasPrice: 10e9,
      skipDryRun: true,
    },
    // Another network with more advanced options...
    // advanced: {
    // port: 8777,             // Custom port
    // network_id: 1342,       // Custom network
    // gas: 8500000,           // Gas sent with each transaction (default: ~6700000)
    // gasPrice: 20000000000,  // 20 gwei (in wei) (default: 100 gwei)
    // from: <address>,        // Account to send txs from (default: accounts[0])
    // websocket: true        // Enable EventEmitter interface for web3 (default: false)
    // },
    // Useful for deploying to a public network.
    // NB: It's important to wrap the provider as a function.
    // ropsten: {
    // provider: () => new HDWalletProvider(mnemonic, `https://ropsten.infura.io/v3/YOUR-PROJECT-ID`),
    // network_id: 3,       // Ropsten's id
    // gas: 5500000,        // Ropsten has a lower block limit than mainnet
    // confirmations: 2,    // # of confs to wait between deployments. (default: 0)
    // timeoutBlocks: 200,  // # of blocks before a deployment times out  (minimum/default: 50)
    // skipDryRun: true     // Skip dry run before migrations? (default: false for public nets )
    // },
    // Useful for private networks
    // private: {
    // provider: () => new HDWalletProvider(mnemonic, `https://network.io`),
    // network_id: 2111,   // This network is yours, in the cloud.
    // production: true    // Treats this network as if it was a public net. (default: false)
    // }
  },

  plugins: [
    "solidity-coverage",
    "truffle-contract-size",
    "truffle-plugin-verify"
  ],

  api_keys: {
    bscscan: BSC_SCAN_API_KEY,
    etherscan: ETHER_SCAN_API_KEY,
    hecoinfo: HECO_SCAN_API_KEY,
    // optimistic_etherscan: 'MY_API_KEY',
    // arbiscan: 'MY_API_KEY',
    // bscscan: 'MY_API_KEY',
    // snowtrace: 'MY_API_KEY',
    polygonscan: POLY_SCAN_API_KEY,
    // ftmscan: 'MY_API_KEY',
    // moonscan: 'MY_API_KEY'
  },

  // Set default mocha options here, use special reporters etc.
  mocha: {
    // timeout: 100000
    useColors: true,
    // reporter: 'eth-gas-reporter',
    // reporterOptions : { excludeContracts: ['Migrations'] }
  },

  // Configure your compilers
  compilers: {
    solc: {
      version: "0.7.6",    // Fetch exact version from solc-bin (default: truffle's version)
      // docker: true,        // Use "0.5.1" you've installed locally with docker (default: false)
      settings: {          // See the solidity docs for advice about optimization and evmVersion
       optimizer: {
         enabled: true,
         // enabled: false,
         // runs: 1
         runs: 200
       },
      //  evmVersion: "byzantium"
      }
    }
  },

  // Truffle DB is currently disabled by default; to enable it, change enabled: false to enabled: true
  //
  // Note: if you migrated your contracts prior to enabling this field in your Truffle project and want
  // those previously migrated contracts available in the .db directory, you will need to run the following:
  // $ truffle migrate --reset --compile-all

  db: {
    enabled: false
  }
};

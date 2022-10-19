# rainbowkit-plugin
Rainbowkit plugin for the [Sequence](https://sequence.xyz/) wallet.

## install

```js
  npm install 0xsequence/rainbowkit-plugin
```

## Params
### chains
Chains supported by app.

### shimDisconnect (optional)
Simulates the disconnect behavior by keeping track of connection status in storage. Defaults to true.

### connect (optional)
Connect options of the Sequence wallet, includes the name of the app and default network id.

## Example of usage

```js
import { sequenceWallet } from '0xsequence/rainbowkit-plugin'
...other imports

const connectors = connectorsForWallets([
  {
    groupName: 'Recommended',
    wallets: [
      sequenceWallet({
        chains,
        shimDisconnect: true,
        connect: {
          app: 'My app',
          networkId: 137
        }
      }),
      ...otherRainbowKitWallets
    ]
  }
])

export const wagmiClient = createClient({
  autoConnect: true,
  connectors,
  provider
})
```

A full demo is available at: https://github.com/0xsequence/demo-dapp-rainbowkit